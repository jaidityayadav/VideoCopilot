"""
Intelligence Service for VideoCopilot
Provides intelligent RAG chat functionality with project-specific context retrieval using LangChain and Groq
"""

import asyncio
import json
import os
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

import asyncpg
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pinecone import Pinecone

# LangChain imports
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from transformers import AutoTokenizer, AutoModel
import torch
from langchain_pinecone import PineconeVectorStore
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferWindowMemory
from langchain.schema import BaseMessage, HumanMessage, AIMessage, Document
from langchain.schema.retriever import BaseRetriever
from langchain.prompts import PromptTemplate

import httpx
import logging

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "vidwise-embeddings")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)

# Initialize embedding model for user queries
MODEL_NAME = "BAAI/bge-small-en"

# Load embedding model and tokenizer (same as embedding-service)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
embedding_model = AutoModel.from_pretrained(MODEL_NAME)

class CustomEmbeddings:
    """Custom embedding class that matches the embedding-service implementation"""
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents"""
        embeddings = []
        for text in texts:
            embeddings.append(self.embed_query(text))
        return embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query using the same approach as embedding-service"""
        logger.info(f"CustomEmbeddings: Generating embedding for query: '{text[:30]}...'")
        
        # Handle empty text
        if text.strip() == "":
            return [0.0] * 384
            
        # Tokenize and encode with same parameters as embedding-service
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        
        # Generate embeddings
        with torch.no_grad():
            outputs = embedding_model(**inputs)
            # Use mean pooling of last hidden states - simple approach
            embedding = outputs.last_hidden_state.mean(dim=1).squeeze().numpy()
            
            # Always normalize vectors for cosine similarity
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            embedding_list = embedding.tolist()
        
        logger.info(f"CustomEmbeddings: Generated normalized embedding vector of length {len(embedding_list)}")
        
        return embedding_list

# Pydantic models
class ProjectInfo(BaseModel):
    id: str
    name: str
    status: str
    total_videos: int
    processed_videos: int

class ChatMessage(BaseModel):
    message: str
    timestamp: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[str] = []
    timestamp: Optional[str] = None

class ConnectionManager:
    """Manages WebSocket connections and chat histories"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.chat_histories: Dict[str, List[Dict[str, str]]] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket connection established: {connection_id}")
    
    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.chat_histories:
            del self.chat_histories[connection_id]
        logger.info(f"WebSocket connection closed: {connection_id}")
    
    async def send_message(self, connection_id: str, message: dict):
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            await websocket.send_text(json.dumps(message))
    
    def get_chat_history(self, connection_id: str) -> List[Dict[str, str]]:
        return self.chat_histories.get(connection_id, [])
    
    def add_to_history(self, connection_id: str, role: str, message: str):
        if connection_id not in self.chat_histories:
            self.chat_histories[connection_id] = []
        self.chat_histories[connection_id].append({"role": role, "content": message})
        
        # Keep only last 10 messages to manage memory
        if len(self.chat_histories[connection_id]) > 20:
            self.chat_histories[connection_id] = self.chat_histories[connection_id][-20:]

class IntelligenceService:
    def __init__(self):
        self.db_pool = None
        self.pinecone_index_name = PINECONE_INDEX_NAME
        self.pc = pc
        
        # Initialize embeddings with explicit logging
        logger.info("Creating custom embedding instance that exactly matches embedding-service")
        self.embeddings = CustomEmbeddings()
        
        # Initialize Groq LLM
        self.llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model_name="deepseek-r1-distill-llama-70b",
            temperature=0.7,
            max_tokens=1024
        )
        
        # Store retrieval chains per project
        self.project_chains: Dict[str, ConversationalRetrievalChain] = {}
        
        logger.info("Intelligence service initialized with Groq LLM and RAG")
    
    async def connect(self):
        """Initialize database connection pool"""
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        self.db_pool = await asyncpg.create_pool(database_url)
        logger.info("✅ Connected to PostgreSQL database")
        
    async def disconnect(self):
        """Close database connection pool"""
        if self.db_pool:
            await self.db_pool.close()
        logger.info("✅ Disconnected from database")
    
    async def verify_project_exists(self, project_id: str) -> Optional[ProjectInfo]:
        """Verify project exists and return project info"""
        query = """
        SELECT id, name, status, "totalVideos", "processedVideos"
        FROM "Project" 
        WHERE id = $1
        """
        
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, project_id)
                
                if row:
                    return ProjectInfo(
                        id=row['id'],
                        name=row['name'],
                        status=row['status'],
                        total_videos=row['totalVideos'],
                        processed_videos=row['processedVideos']
                    )
                return None
                
        except Exception as e:
            logger.error(f"Error verifying project {project_id}: {e}")
            return None
    
    async def check_project_embeddings(self, project_id: str) -> bool:
        """Check if project has embeddings in Pinecone"""
        try:
            index = self.pc.Index(self.pinecone_index_name)
            
            # The embedding service uses project_id as namespace, not project_{project_id}
            namespace = project_id
            
            # Get index stats
            stats = index.describe_index_stats()
            logger.info(f"Pinecone index stats: {stats}")
            
            # Check if namespace exists and has vectors
            if 'namespaces' in stats and namespace in stats['namespaces']:
                vector_count = stats['namespaces'][namespace].get('vector_count', 0)
                logger.info(f"Project {project_id} has {vector_count} vectors in Pinecone")
                return vector_count > 0
            else:
                logger.info(f"Project {project_id} namespace '{namespace}' not found in Pinecone")
                logger.info(f"Available namespaces: {list(stats.get('namespaces', {}).keys())}")
                return False
                
        except Exception as e:
            logger.error(f"Error checking embeddings for project {project_id}: {e}")
            return False
    
    def create_retrieval_chain(self, project_id: str) -> ConversationalRetrievalChain:
        try:
            logger.info(f"Creating retrieval chain for project {project_id}")

            # Cache Pinecone index
            if not hasattr(self, "_pinecone_index"):
                self._pinecone_index = self.pc.Index(self.pinecone_index_name)
            index = self._pinecone_index
            logger.info(f"Connected to Pinecone index: {self.pinecone_index_name}")

            # Namespace must exactly match embedding-service usage
            namespace = project_id
            logger.info(f"Using namespace: '{namespace}' for project {project_id}")

            # Verify namespace exists
            stats = index.describe_index_stats()
            logger.info(f"Pinecone index stats: {stats}")
            if "namespaces" not in stats or namespace not in stats["namespaces"]:
                raise ValueError(f"Namespace '{namespace}' not found in Pinecone")

            logger.info(f"Namespace '{namespace}' has {stats['namespaces'][namespace]['vector_count']} vectors")

            # Create vector store
            vectorstore = PineconeVectorStore(
                index=index,
                embedding=self.embeddings,
                text_key="text",
                namespace=namespace,
                distance_strategy="COSINE"
            )
            logger.info("✅ Vector store created successfully")

            # Create retriever with correct namespace
            retriever = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={
                    "k": 5,
                    "namespace": namespace
                }
            )
            logger.info("✅ Retriever created successfully")

            # Create prompt template
            custom_prompt = PromptTemplate(
                input_variables=["context", "question", "chat_history"],
                template="""You are an intelligent AI assistant analyzing video transcripts. Use the following context from video transcripts to answer the user's question.

Context from videos:
{context}

Chat History:
{chat_history}

User Question: {question}

Provide a helpful, accurate response based on the video context. If the context doesn't contain all the information needed to fully answer the question, use what's available to provide a partial answer and clearly indicate what information is missing. If no context is available, explain that transcripts do not contain relevant information and suggest related questions."""
            )
            logger.info("✅ Custom prompt template created")

            # Create conversation memory
            memory = ConversationBufferWindowMemory(
                k=5,
                memory_key="chat_history",
                return_messages=True,
                output_key="answer"
            )
            logger.info("✅ Conversation memory created")

            # Build chain
            chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm,
                retriever=retriever,
                memory=memory,
                return_source_documents=True,
                combine_docs_chain_kwargs={"prompt": custom_prompt},
                verbose=True
            )
            logger.info(f"✅ Conversational retrieval chain created for project {project_id}")

            return chain

        except Exception as e:
            logger.error(f"❌ Failed to create retrieval chain for project {project_id}: {e}")
            raise

    
    def get_or_create_chain(self, project_id: str) -> ConversationalRetrievalChain:
        """Get existing chain or create new one for project"""
        if project_id not in self.project_chains:
            self.project_chains[project_id] = self.create_retrieval_chain(project_id)
        return self.project_chains[project_id]
    
    async def process_chat_message(self, project_id: str, message: str) -> Dict[str, Any]:
        try:
            logger.info(f"Processing chat message for project {project_id}: {message}")

            # Check if project has embeddings
            has_embeddings = await self.check_project_embeddings(project_id)
            logger.info(f"Project {project_id} has embeddings: {has_embeddings}")

            if not has_embeddings:
                return {
                    "response": "I don't have any processed content for this project yet. "
                                "Please make sure your videos have been processed and embeddings have been generated.",
                    "sources": [],
                    "success": True
                }

            # Get or create retrieval chain
            chain = self.get_or_create_chain(project_id)
            logger.info(f"Using retrieval chain for project {project_id}")

            # First: test retrieval before running the chain
            logger.info(f"Running retrieval test for query: '{message}'")
            retriever = chain.retriever
            test_docs = retriever.get_relevant_documents(message)
            logger.info(f"Retriever found {len(test_docs)} document(s)")

            for i, doc in enumerate(test_docs):
                logger.info(f"Doc {i}: {doc.page_content[:200]}... | Metadata: {doc.metadata}")

            if not test_docs:
                logger.warning(f"No documents found for query '{message}' in project {project_id}")

            # Process the chat message through the chain
            logger.info("Running ConversationalRetrievalChain...")
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: chain({"question": message}))
            logger.info(f"LangChain response keys: {response.keys()}")

            answer = response.get("answer", "I'm sorry, I couldn't generate a response.")
            source_documents = response.get("source_documents", [])

            # Format sources
            sources = []
            for doc in source_documents:
                metadata = doc.metadata
                sources.append({
                    "content": doc.page_content[:200] + ("..." if len(doc.page_content) > 200 else ""),
                    "video_id": metadata.get("video_id", "unknown"),
                    "chunk_index": metadata.get("chunk_index", 0),
                    "timestamp": metadata.get("timestamp", "unknown")
                })

            return {
                "response": answer,
                "sources": sources,
                "success": True
            }

        except Exception as e:
            logger.error(f"Error processing chat message for project {project_id}: {e}")
            return {
                "response": f"I'm sorry, I encountered an error processing your message: {str(e)}",
                "sources": [],
                "success": False
            }


class MockLLM:
    """Mock LLM for development/fallback"""
    
    def __call__(self, prompt: str) -> str:
        return f"Mock response to: {prompt[:50]}..."
    
    def _call(self, prompt: str, stop=None) -> str:
        return self.__call__(prompt)

# Global instances
manager = ConnectionManager()
intelligence_service = IntelligenceService()

# FastAPI app setup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await intelligence_service.connect()
    logger.info("🚀 Intelligence Service connected to database")
    yield
    # Shutdown
    await intelligence_service.disconnect()
    logger.info("👋 Intelligence Service disconnected from database")

app = FastAPI(
    title="VideoCopilot Intelligence Service",
    description="Intelligent chat service with project-specific context retrieval",
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

@app.websocket("/chat/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket endpoint for project-specific chat"""
    connection_id = f"{project_id}_{id(websocket)}"
    
    try:
        # Accept connection
        await manager.connect(websocket, connection_id)
        
        # Verify project exists
        project_info = await intelligence_service.verify_project_exists(project_id)
        if not project_info:
            await websocket.send_text(json.dumps({
                "error": f"Project {project_id} not found",
                "type": "error"
            }))
            return
        
        # Check if project has embeddings
        has_embeddings = await intelligence_service.check_project_embeddings(project_id)
        if not has_embeddings:
            await websocket.send_text(json.dumps({
                "error": f"No embeddings found for project {project_id}. Please ensure the project has been processed.",
                "type": "error"
            }))
            return
        
        # Ready to chat - no initialization needed for simplified approach
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "message": f"Connected to project: {project_info.name}",
            "project": project_info.dict()
        }))
        
        # Listen for messages
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                message_data = json.loads(data)
                user_message = message_data.get("message", "").strip()
                
                if not user_message:
                    continue
                
                # Send typing indicator
                await websocket.send_text(json.dumps({
                    "type": "typing",
                    "message": "Thinking..."
                }))
                
                # Process message
                result = await intelligence_service.process_chat_message(
                    project_id, 
                    user_message
                )
                
                # Send response
                await websocket.send_text(json.dumps({
                    "type": "response",
                    "message": result["response"],
                    "sources": result.get("sources", []),
                    "success": result["success"]
                }))
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "error": "Invalid JSON format",
                    "type": "error"
                }))
            except Exception as e:
                logger.error(f"Error in websocket loop: {e}")
                await websocket.send_text(json.dumps({
                    "error": "An unexpected error occurred",
                    "type": "error"
                }))
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        manager.disconnect(connection_id)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "intelligence-service"}

@app.get("/projects/{project_id}/info")
async def get_project_info(project_id: str):
    """Get project information"""
    project_info = await intelligence_service.verify_project_exists(project_id)
    if not project_info:
        raise HTTPException(status_code=404, detail="Project not found")
    
    has_embeddings = await intelligence_service.check_project_embeddings(project_id)
    
    return {
        "project": project_info.dict(),
        "has_embeddings": has_embeddings,
        "chat_ready": has_embeddings
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
