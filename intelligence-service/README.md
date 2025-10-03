# Intelligence Service

The Intelligence Service provides intelligent chat functionality with project-specific context retrieval using WebSockets.

## Features

- **WebSocket Chat**: Real-time communication with `/chat/{projectId}` endpoint
- **Context-Aware**: Retrieves relevant transcript chunks from Pinecone for each project
- **Conversational Memory**: Maintains chat history for context across messages
- **Error Handling**: Graceful handling of invalid projects, missing embeddings, etc.
- **Streaming Responses**: Real-time response streaming over WebSocket

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and configure:
   ```
   DATABASE_URL=postgres://...
   PINECONE_API_KEY=your-key
   PINECONE_INDEX_NAME=vidwise-embeddings
   ```

3. **Run Service**:
   ```bash
   python -m uvicorn main:app --reload --port 8002
   ```

## API Endpoints

### WebSocket
- `ws://localhost:8002/chat/{projectId}` - Main chat endpoint

### HTTP
- `GET /health` - Health check
- `GET /projects/{projectId}/info` - Get project info and embedding status

## WebSocket Protocol

### Connection
Connect to `ws://localhost:8002/chat/{projectId}` where `projectId` is the project ID.

### Message Format

**Send Message**:
```json
{
  "message": "What is this video about?"
}
```

**Receive Messages**:
```json
{
  "type": "welcome",
  "message": "Connected to project: My Project",
  "project": {...}
}

{
  "type": "typing",
  "message": "Thinking..."
}

{
  "type": "response",
  "message": "Based on the transcript, this video is about...",
  "sources": ["Relevant transcript excerpt 1...", "Relevant transcript excerpt 2..."],
  "success": true
}

{
  "type": "error",
  "error": "Error message"
}
```

## Architecture

1. **Connection Management**: Each WebSocket connection is managed with unique IDs
2. **Project Verification**: Validates project exists in PostgreSQL
3. **Embedding Check**: Ensures project has embeddings in Pinecone
4. **Retrieval Chain**: Creates LangChain ConversationalRetrievalChain per project
5. **Context Retrieval**: Uses BAAI/bge-small-en embeddings to find relevant chunks
6. **Response Generation**: Streams LLM responses back over WebSocket
7. **Memory Management**: Maintains conversation history per connection

## Error Handling

- **Invalid Project**: Returns error if project doesn't exist
- **Missing Embeddings**: Returns error if project has no embeddings
- **Model Errors**: Graceful fallback responses
- **Connection Issues**: Automatic cleanup of resources

## Example Usage

```javascript
// Frontend WebSocket connection
const ws = new WebSocket('ws://localhost:8002/chat/project-id-123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'welcome':
      console.log('Connected:', data.message);
      break;
    case 'response':
      console.log('AI:', data.message);
      console.log('Sources:', data.sources);
      break;
    case 'error':
      console.error('Error:', data.error);
      break;
  }
};

// Send message
ws.send(JSON.stringify({
  message: "Summarize the main points from this video"
}));
```

## Development

The service uses:
- **FastAPI** for WebSocket and HTTP endpoints
- **LangChain** for retrieval and conversation chains
- **Pinecone** for vector storage and retrieval
- **HuggingFace** for embeddings and LLM (with OpenAI fallback option)
- **PostgreSQL** for project metadata