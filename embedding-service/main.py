"""
Embedding Service for VideoCopilot
Generates embeddings for project transcripts and stores them in Pinecone
"""

import asyncio
import os
import re
from typing import List, Dict, Any
from io import StringIO

import asyncpg
import boto3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from pinecone import Pinecone
import tiktoken
from contextlib import asynccontextmanager

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Initialize clients
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))


# Ollama API embedding setup
OLLAMA_MODEL = "qllama/bge-small-en-v1.5"
OLLAMA_API_URL = "http://localhost:11434/api/embed"

# For token counting (using tiktoken for better accuracy)
encoding = tiktoken.get_encoding("cl100k_base")

# Pydantic models
class GenerateEmbeddingsRequest(BaseModel):
    project_id: str

class GenerateEmbeddingsResponse(BaseModel):
    success: bool
    project_id: str
    transcripts_processed: int
    chunks_created: int
    embeddings_generated: int
    text_length: int

class EmbeddingService:
    def __init__(self):
        self.bucket_name = os.getenv('AWS_S3_BUCKET')
        self.pinecone_index_name = os.getenv('PINECONE_INDEX_NAME', 'vidwise-embeddings')
        self.db_pool = None
        
    async def connect(self):
        """Initialize database connection pool"""
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        self.db_pool = await asyncpg.create_pool(database_url)
        print("✅ Connected to PostgreSQL database")
        
    async def disconnect(self):
        """Close database connection pool"""
        if self.db_pool:
            await self.db_pool.close()
        print("✅ Disconnected from database")
        
    async def generate_embeddings_for_project(self, project_id: str) -> Dict[str, Any]:
        """
        Main function to generate embeddings for a project
        
        Args:
            project_id: The project ID to process
            
        Returns:
            Dict containing status and metadata
        """
        try:
            print(f"🚀 Starting embedding generation for project {project_id}")
            
            # Step 1: Fetch all English transcript records for this project
            transcripts = await self._fetch_english_transcripts(project_id)
            if not transcripts:
                raise HTTPException(status_code=404, detail="No English transcripts found for this project")
            
            print(f"📝 Found {len(transcripts)} English transcripts")
            
            # Step 2: Download and concatenate all TXT files
            combined_text = await self._download_and_combine_transcripts(transcripts)
            if not combined_text.strip():
                raise HTTPException(status_code=400, detail="No text content found in transcripts")
            
            print(f"📄 Combined text length: {len(combined_text)} characters")
            
            # Step 3: Split text into chunks
            chunks = self._split_into_chunks(combined_text, max_tokens=500)
            print(f"✂️ Split into {len(chunks)} chunks")
            
            # Step 4: Generate embeddings for each chunk
            embeddings = await self._generate_embeddings(chunks)
            print(f"🧠 Generated {len(embeddings)} embeddings")
            
            # Step 5: Store vectors in Pinecone
            await self._store_in_pinecone(project_id, chunks, embeddings)
            print(f"📊 Stored embeddings in Pinecone namespace: {project_id}")
            
            # Step 6: Upsert into Embedding table
            await self._upsert_embedding_record(project_id)
            print(f"💾 Updated Embedding table for project {project_id}")
            
            # Step 7: Update project status to COMPLETED
            await self._update_project_status(project_id)
            print(f"✅ Updated project {project_id} status to COMPLETED")
            
            return {
                "success": True,
                "project_id": project_id,
                "transcripts_processed": len(transcripts),
                "chunks_created": len(chunks),
                "embeddings_generated": len(embeddings),
                "text_length": len(combined_text)
            }
            
        except Exception as e:
            print(f"❌ Error generating embeddings for project {project_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")
    
    async def _fetch_english_transcripts(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch English transcripts from database for the given project"""
        query = """
        SELECT t.id, t."txtUrl", t."videoId", v."projectId"
        FROM "Transcript" t
        JOIN "Video" v ON t."videoId" = v.id
        WHERE v."projectId" = $1 AND t.language = 'en'
        """
        
        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(query, project_id)
                
                transcripts = []
                for row in rows:
                    transcripts.append({
                        'id': row['id'],
                        'txtUrl': row['txtUrl'],
                        'videoId': row['videoId'],
                        'projectId': row['projectId']
                    })
                
                print(f"🔍 Found {len(transcripts)} English transcripts for project {project_id}")
                return transcripts
                
        except Exception as e:
            print(f"❌ Error fetching transcripts from database: {str(e)}")
            return []
    
    async def _download_and_combine_transcripts(self, transcripts: List[Dict[str, Any]]) -> str:
        """Download all TXT files from S3 and combine them"""
        combined_text = StringIO()
        
        for transcript in transcripts:
            try:
                # Extract S3 key from txtUrl (format: s3://bucket/key)
                s3_key = transcript['txtUrl'].replace(f's3://{self.bucket_name}/', '')
                
                print(f"📥 Downloading transcript: {s3_key}")
                
                # Download file from S3
                response = s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
                content = response['Body'].read().decode('utf-8')
                
                # Add content with separator
                combined_text.write(f"\n\n--- Video {transcript['videoId']} ---\n\n")
                combined_text.write(content)
                combined_text.write("\n\n")
                
            except Exception as e:
                print(f"⚠️ Failed to download transcript {transcript['id']}: {str(e)}")
                continue
        
        return combined_text.getvalue()
    
    def _split_into_chunks(self, text: str, max_tokens: int = 500) -> List[str]:
        """Split text into chunks of approximately max_tokens"""
        # Clean and normalize text
        text = re.sub(r'\\s+', ' ', text).strip()
        
        # Split into sentences for better chunk boundaries
        sentences = re.split(r'(?<=[.!?])\\s+', text)
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for sentence in sentences:
            sentence_tokens = len(encoding.encode(sentence))
            
            # If adding this sentence would exceed max_tokens, start a new chunk
            if current_tokens + sentence_tokens > max_tokens and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_tokens = sentence_tokens
            else:
                current_chunk.append(sentence)
                current_tokens += sentence_tokens
        
        # Add the last chunk if it has content
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    async def _generate_embeddings(self, chunks: List[str]) -> List[List[float]]:
        """Generate embeddings for each chunk using Ollama API"""
        import httpx
        embeddings = []
        for i, chunk in enumerate(chunks):
            print(f"🧠 Generating embedding {i+1}/{len(chunks)} (Ollama API)")
            payload = {"model": OLLAMA_MODEL, "input": chunk}
            try:
                response = httpx.post(OLLAMA_API_URL, json=payload, timeout=10)
                response.raise_for_status()
                data = response.json()
                embedding_list = data.get("embeddings")
                embedding = embedding_list[0] if embedding_list and len(embedding_list) > 0 else []
                if not embedding:
                    print(f"❌ Ollama API did not return embedding for chunk {i+1}")
                    embeddings.append([])
                else:
                    embeddings.append(embedding)
            except Exception as e:
                print(f"❌ Ollama API error for chunk {i+1}: {e}")
                embeddings.append([])
        return embeddings
    
    async def _store_in_pinecone(self, project_id: str, chunks: List[str], embeddings: List[List[float]]):
        """Store embeddings in Pinecone with namespace = project_id"""
        # Ensure index exists
        await self._ensure_pinecone_index()
        
        # Get index
        index = pc.Index(self.pinecone_index_name)
        
        # Prepare vectors for upsert
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vector_id = f"{project_id}_{i}"
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "project_id": project_id,
                    "chunk_index": i,
                    "text": chunk[:1000],  # Store first 1000 chars of text as metadata
                    "text_length": len(chunk)
                }
            })
        
        # Upsert vectors with namespace
        index.upsert(vectors=vectors, namespace=project_id)
        
        print(f"📊 Upserted {len(vectors)} vectors to Pinecone namespace '{project_id}'")
    
    async def _ensure_pinecone_index(self):
        """Ensure Pinecone index exists"""
        try:
            # Check if index exists
            existing_indexes = [index.name for index in pc.list_indexes()]
            
            if self.pinecone_index_name not in existing_indexes:
                print(f"🔧 Creating Pinecone index: {self.pinecone_index_name}")
                pc.create_index(
                    name=self.pinecone_index_name,
                    dimension=384,  # BAAI/bge-small-en embedding dimension
                    metric="cosine",
                    spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
                )
                print(f"✅ Created Pinecone index: {self.pinecone_index_name}")
            else:
                print(f"✅ Pinecone index already exists: {self.pinecone_index_name}")
                
        except Exception as e:
            error_msg = str(e)
            if "pod quota" in error_msg.lower():
                print(f"❌ Pinecone quota exceeded. Please either:")
                print(f"   1. Use an existing index by updating PINECONE_INDEX_NAME in .env")
                print(f"   2. Upgrade your Pinecone plan for more pod quota")
                print(f"   Available indexes: {[index.name for index in pc.list_indexes()]}")
                raise HTTPException(status_code=503, detail="Pinecone quota exceeded. Please use an existing index or upgrade your plan.")
            else:
                print(f"❌ Error with Pinecone index: {error_msg}")
                raise
    
    async def _upsert_embedding_record(self, project_id: str):
        """Upsert embedding record in database"""
        query = """
        INSERT INTO "Embedding" ("id", "pineconeId", "projectId", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, NOW())
        ON CONFLICT ("projectId") 
        DO UPDATE SET "pineconeId" = $1, "createdAt" = NOW()
        """
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(query, project_id, project_id)
                print(f"📝 Upserted embedding record for project {project_id}")
        except Exception as e:
            print(f"❌ Error upserting embedding record: {str(e)}")
            raise
    
    async def _update_project_status(self, project_id: str):
        """Update project status to COMPLETED"""
        query = """
        UPDATE "Project" 
        SET status = 'COMPLETED'
        WHERE id = $1
        """
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(query, project_id)
                print(f"✅ Updated project {project_id} status to COMPLETED")
        except Exception as e:
            print(f"❌ Error updating project status: {str(e)}")
            raise

# Global service instance
embedding_service = EmbeddingService()

# FastAPI app setup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await embedding_service.connect()
    print("🚀 Embedding Service connected to database")
    yield
    # Shutdown
    await embedding_service.disconnect()
    print("👋 Embedding Service disconnected from database")

app = FastAPI(
    title="VideoCopilot Embedding Service",
    description="Generate and store embeddings for video transcripts",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/generate-embeddings", response_model=GenerateEmbeddingsResponse)
async def generate_embeddings(request: GenerateEmbeddingsRequest):
    """Generate embeddings for a project"""
    result = await embedding_service.generate_embeddings_for_project(request.project_id)
    return GenerateEmbeddingsResponse(**result)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "embedding-service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)