# VideoCopilot Embedding Service

A FastAPI service that generates embeddings for video transcripts and stores them in Pinecone for semantic search.

## Features

- 🧠 **BAAI/bge-small-en** embedding model for high-quality text embeddings
- 📊 **Pinecone integration** for vector storage and retrieval
- 🎯 **Project-based namespacing** for organized embedding storage
- 📝 **Automatic text chunking** (~500 tokens per chunk)
- 🔄 **Async processing** for better performance
- 🗄️ **PostgreSQL integration** via Prisma

## Architecture

1. **Fetch Transcripts**: Gets all English transcripts for a project
2. **Download & Combine**: Downloads TXT files from S3 and concatenates them
3. **Text Chunking**: Splits text into ~500 token chunks for optimal embedding
4. **Generate Embeddings**: Uses BAAI/bge-small-en to create 384-dimensional vectors
5. **Store in Pinecone**: Saves vectors with project namespace and metadata
6. **Update Database**: Records embedding info in PostgreSQL
7. **Update Status**: Marks project as COMPLETED

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Generate Prisma Client

```bash
prisma generate
```

### 4. Run the Service

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## API Endpoints

### Generate Embeddings

```http
POST /generate-embeddings
Content-Type: application/json

{
  "project_id": "clxyz123456789"
}
```

**Response:**
```json
{
  "success": true,
  "project_id": "clxyz123456789",
  "transcripts_processed": 3,
  "chunks_created": 15,
  "embeddings_generated": 15,
  "text_length": 8542
}
```

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "embedding-service"
}
```

## Docker

### Build Image

```bash
docker build -t embedding-service .
```

### Run Container

```bash
docker run -p 8001:8001 --env-file .env embedding-service
```

## Integration

The embedding service is designed to be called after video processing is complete:

1. **Video Processing Service** processes videos and generates transcripts
2. **Embedding Service** is called to generate embeddings for the project
3. **Web App** can then use the embeddings for semantic search

### Call from Video Processing Service

```python
import httpx

async def trigger_embedding_generation(project_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://embedding-service:8001/generate-embeddings",
            json={"project_id": project_id}
        )
        return response.json()
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `abc123...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | `vidwise-storage` |
| `PINECONE_API_KEY` | Pinecone API key | `pc-xyz...` |
| `PINECONE_INDEX_NAME` | Pinecone index name | `vidwise-embeddings` |

## Dependencies

- **FastAPI**: Web framework
- **Prisma**: Database ORM
- **transformers**: Hugging Face transformers for embeddings
- **pinecone-client**: Pinecone vector database client
- **boto3**: AWS S3 client
- **tiktoken**: Token counting for text chunking

## Model Details

- **Model**: BAAI/bge-small-en
- **Embedding Dimension**: 384
- **Max Token Length**: 512
- **Chunk Size**: ~500 tokens
- **Distance Metric**: Cosine similarity

## Pinecone Schema

- **Namespace**: `{project_id}`
- **Vector ID**: `{project_id}_{chunk_index}`
- **Metadata**:
  - `project_id`: Project identifier
  - `chunk_index`: Chunk sequence number
  - `text`: First 1000 characters of chunk text
  - `text_length`: Full chunk text length