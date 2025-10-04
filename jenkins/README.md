# Jenkins CI/CD Pipeline for VideoCopilot

This directory contains the Jenkins pipeline configuration for automated building, testing, and deployment of the VideoCopilot application.

## Pipeline Features

### 🔍 Smart Change Detection
- **Selective Builds**: Only builds services that have changed since the last commit
- **Force Rebuild**: Option to rebuild all services regardless of changes
- **Infrastructure Awareness**: Rebuilds all services when infrastructure files change

### 🏗️ Multi-Service Build
- **Parallel Builds**: All services build simultaneously for faster pipeline execution
- **Docker BuildKit**: Uses advanced Docker features for optimized builds
- **Image Caching**: Leverages Docker layer caching for faster subsequent builds
- **Multi-Stage Builds**: Optimized production images with security hardening

### 🧪 Comprehensive Testing
- **Parallel Testing**: Tests run in parallel across all services
- **Coverage Reports**: Generates and publishes test coverage reports
- **Configurable**: Option to skip tests for hotfixes

### 🔒 Security & Quality
- **Vulnerability Scanning**: Uses Trivy to scan Docker images for security vulnerabilities
- **Security Reports**: Archives scan results for compliance and review
- **Quality Gates**: Fails pipeline on critical security issues

### 🚀 Intelligent Deployment
- **Rolling Updates**: Zero-downtime deployments with Kubernetes rolling updates
- **Health Checks**: Validates all services are healthy before marking deployment as successful
- **Rollback Ready**: Easy rollback using Kubernetes deployment history

### 📊 Monitoring & Observability
- **Deployment Logs**: Archives service logs for troubleshooting
- **Status Reporting**: Real-time status of deployments and health checks
- **Notifications**: Success/failure notifications (easily extensible)

## Pipeline Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `DEPLOY_ENVIRONMENT` | Choice | `dev` | Target deployment environment (dev/staging/prod) |
| `FORCE_REBUILD_ALL` | Boolean | `false` | Force rebuild and deploy all services |
| `SKIP_TESTS` | Boolean | `false` | Skip running tests (for hotfixes) |

## Environment Variables

The pipeline uses these environment variables that should be configured in Jenkins:

```bash
# Docker Registry Configuration
DOCKER_REGISTRY=your-registry.com

# Kubernetes Configuration
KUBECONFIG=/var/jenkins_home/.kube/config

# Docker Build Configuration
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

## Required Jenkins Credentials

Configure these credentials in Jenkins:

1. **docker-registry-creds**: Username/password for Docker registry
2. **kubeconfig**: Kubernetes cluster configuration file
3. **git-ssh-key**: SSH key for Git repository access (if using private repos)

## Pipeline Stages

### 1. 🏗️ Prepare
- Extracts commit hash and branch name
- Sets up environment variables for the build

### 2. 🔍 Change Detection
- Analyzes Git diff to determine which services changed
- Sets flags for selective building
- Infrastructure changes trigger full rebuild

### 3. 🐳 Build Images
- **Parallel Execution**: All services build simultaneously
- **Smart Caching**: Uses Docker layer caching for faster builds
- **Tagging Strategy**: Images tagged with commit hash and latest

### 4. 🧪 Run Tests
- **Web App**: npm test with coverage reports
- **Python Services**: pytest with coverage reports
- **Parallel Execution**: Tests run simultaneously across services

### 5. 🔒 Security Scan
- **Trivy Scanner**: Scans all built images for vulnerabilities
- **Report Generation**: Creates JSON reports for each service
- **Archive Results**: Stores scan results for compliance

### 6. 📤 Push Images
- **Registry Push**: Pushes images to configured Docker registry
- **Multi-Tag**: Pushes both commit-specific and latest tags
- **Secure Authentication**: Uses Jenkins credentials for registry access

### 7. 🚀 Deploy to Kubernetes
- **Ordered Deployment**: Database → Services → Web App → Ingress
- **Image Updates**: Updates deployments with new image tags
- **Health Validation**: Waits for deployments to be ready

### 8. 🏥 Health Check
- **Service Validation**: Checks all pods are running
- **Endpoint Testing**: Tests health endpoints for all services
- **Status Reporting**: Displays cluster status

## Service Detection Logic

The pipeline automatically detects which services need to be rebuilt based on changed files:

```
web-app/ → BUILD_WEB_APP=true
embedding-service/ → BUILD_EMBEDDING_SERVICE=true
intelligence-service/ → BUILD_INTELLIGENCE_SERVICE=true
video-processing-service/ → BUILD_VIDEO_PROCESSING_SERVICE=true
k8s/, infrastructure/, jenkins/ → Rebuild all services
```

## Deployment Strategy

### Rolling Updates
- Uses Kubernetes rolling updates for zero-downtime deployments
- Waits for each service to be ready before proceeding
- Maintains service availability during updates

### Service Dependencies
1. **Database** (PostgreSQL with Redis) - Deployed first
2. **Backend Services** (Embedding, Intelligence, Video Processing) - Deployed in parallel
3. **Web Application** - Deployed last (runs database migrations)
4. **Ingress** - Applied after all services are ready

## Monitoring Integration

The pipeline is designed to work with the monitoring stack:

- **Prometheus**: Scrapes metrics from all services
- **Grafana**: Visualizes deployment and application metrics
- **AlertManager**: Sends alerts on deployment failures

## Customization

### Adding New Services
1. Add detection logic in the "Detect Changes" stage
2. Add build stage in the "Build Images" parallel block
3. Add deployment in the "Deploy to Kubernetes" stage

### Custom Notifications
Replace the echo statements in the post-success/post-failure blocks with:
- Slack notifications
- Discord webhooks  
- Email alerts
- Custom webhook integrations

### Advanced Features
The pipeline supports advanced Jenkins features:
- **Blue Ocean**: Modern pipeline visualization
- **Pipeline as Code**: Version controlled pipeline definition
- **Multibranch Pipelines**: Automatic branch-based deployments
- **Webhook Triggers**: Automatic builds on Git pushes

## Troubleshooting

### Common Issues

1. **Docker Build Failures**
   - Check Dockerfile syntax
   - Verify base image availability
   - Check network connectivity

2. **Test Failures**
   - Review test logs in Jenkins console
   - Check service dependencies
   - Verify test environment setup

3. **Deployment Issues**
   - Check Kubernetes cluster connectivity
   - Verify RBAC permissions
   - Review pod logs: `kubectl logs -n videocopilot <pod-name>`

4. **Image Push Failures**
   - Verify Docker registry credentials
   - Check registry connectivity
   - Ensure proper image tagging

### Debug Commands

```bash
# Check pipeline logs
kubectl logs -n videocopilot -l app=<service-name>

# Check deployment status
kubectl get deployments -n videocopilot

# Check pod status
kubectl get pods -n videocopilot

# Describe failing pods
kubectl describe pod <pod-name> -n videocopilot
```

## Security Considerations

- **Least Privilege**: Jenkins service account has minimal required permissions
- **Secret Management**: Sensitive data stored in Kubernetes secrets
- **Image Scanning**: All images scanned for vulnerabilities before deployment
- **Network Policies**: Services communicate through defined network policies
- **RBAC**: Role-based access control for Kubernetes resources

## Performance Optimization

- **Parallel Execution**: Maximum parallelization of build and test stages
- **Docker Layer Caching**: Reduces build times significantly
- **Selective Deployment**: Only deploys changed services
- **Resource Limits**: Prevents resource exhaustion during builds
- **Build Optimization**: Multi-stage builds minimize final image size