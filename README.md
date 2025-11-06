# VideoCopilot

A microservices-based video processing platform that provides intelligent video analysis, transcription, and embedding generation capabilities.

## Architecture Overview

VideoCopilot is built using a microservices architecture with the following components:

### Core Services

**Web Application**
- Next.js-based frontend and API layer
- Handles user authentication, project management, and video uploads
- Provides REST APIs for client interactions
- Manages video metadata and user sessions
- Technologies: Next.js, TypeScript, Prisma ORM, PostgreSQL

**Video Processing Service**
- Processes uploaded videos for transcription and analysis
- Handles video format conversion and optimization
- Extracts audio for transcription services
- Technologies: Python, FastAPI

**Embedding Service**
- Generates vector embeddings from video content and transcripts
- Enables semantic search capabilities
- Integrates with vector databases for similarity search
- Technologies: Python, FastAPI

**Intelligence Service**
- Provides AI-powered insights and analysis
- Processes natural language queries about video content
- Generates summaries and key points extraction
- Technologies: Python, FastAPI

## Project Structure

```
VideoCopilot/
├── web-app/                    # Next.js frontend and API
├── video-processing-service/   # Video processing microservice
├── embedding-service/          # Vector embedding generation
├── intelligence-service/       # AI analysis and insights
├── infrastructure/             # Terraform IaC configuration
├── kubernetes/                 # Kubernetes manifests
├── ansible/                    # Ansible playbooks
├── monitoring/                 # Prometheus and monitoring setup
└── logs/                       # Service logs directory
```

## Prerequisites

- Node.js 18+ (for web-app)
- Python 3.9+ (for microservices)
- PostgreSQL database
- Docker and Docker Compose
- AWS account (for S3 storage)

## Local Development

### Web Application

```bash
cd web-app
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Microservices

Each service can be run independently:

```bash
cd {service-name}
pip install -r requirements.txt
python main.py
```

### Docker Compose

Run all services together:

```bash
docker-compose up -d
```

## Database Schema

The application uses Prisma ORM with PostgreSQL. Database schema is defined in:
- `web-app/prisma/schema.prisma` - Main application schema
- `video-processing-service/schema.prisma` - Video processing schema

## DevOps and Deployment

### Infrastructure as Code

**Terraform**
- Located in `infrastructure/` directory
- Provisions cloud resources on AWS
- Manages VPC, security groups, compute instances, and storage
- Configuration files: `main.tf`, `variables.tf`, `terraform.tfvars`

### Container Orchestration

**Docker**
- Each service has its own Dockerfile
- `docker-compose.yaml` for local multi-container setup

**Kubernetes**
- Deployment manifests in `kubernetes/` directory
- Separate manifests for each service
- Namespace isolation and resource management

### Configuration Management

**Ansible**
- Playbooks located in `ansible/` directory
- Automates server configuration and application deployment
- Inventory management for multiple environments

### CI/CD

**Jenkins**
- Pipeline defined in `web-app/Jenkinsfile`
- Automated build, test, and deployment
- PM2 process management for Node.js applications

**GitHub Actions**
- Workflow configuration in `.github/workflows/deploy.yml`
- Automated testing and deployment on push

### Monitoring

**Prometheus**
- Configuration in `monitoring/` directory
- Metrics collection and alerting
- Service health monitoring

## Environment Variables

### Web Application
```
DATABASE_URL=postgresql://user:password@localhost:5432/videocopilot
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### Microservices
Each service requires specific environment variables for database connections, API keys, and service endpoints. Refer to individual service README files for details.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[projectId]` - Get project details
- `DELETE /api/projects/[projectId]` - Delete project

### Videos
- `POST /api/upload` - Upload video file
- `POST /api/process-video` - Process uploaded video
- `GET /api/projects/[projectId]/videos` - List project videos
- `GET /api/projects/[projectId]/videos/[videoId]` - Get video details

### Utilities
- `GET /api/health` - Health check endpoint
- `GET /api/signed-url` - Generate S3 signed URL
- `GET /api/transcript-content` - Retrieve video transcript

## Deployment

### Using Terraform
```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

### Using Kubernetes
```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/
```

### Using Ansible
```bash
cd ansible
ansible-playbook -i inventory.ini playbook.yml
```

## Logging

Service logs are stored in the `logs/` directory:
- `logs/web-app/` - Web application logs
- `logs/video-processing/` - Video processing service logs
- `logs/embedding/` - Embedding service logs
- `logs/intelligence/` - Intelligence service logs

## Security

- All API endpoints require authentication
- JWT-based session management
- Secure password hashing
- S3 signed URLs for secure file access
- Environment-based configuration management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary and confidential.
