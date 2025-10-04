# VideoCopilot DevOps Architecture

This repository implements a complete DevOps pipeline for VideoCopilot with proper separation between **infrastructure setup** and **continuous deployment**.

## 🏗️ Architecture Overview

### One-Time Infrastructure Setup
- **Terraform** → Provisions DigitalOcean droplet
- **Ansible** → Configures server (Docker, k3s, dependencies)

### Continuous Deployment Loop  
- **Jenkins Pipeline** → Detects changes, builds containers, updates Kubernetes
- **Kubernetes** → Self-managing container orchestration
- **Monitoring** → Prometheus & Grafana for observability

## 📁 Project Structure

```
VideoCopilot/
├── infrastructure/          # Terraform for DigitalOcean provisioning
├── ansible/                 # Server configuration playbooks
├── k8s/                     # Kubernetes manifests
├── jenkins/                 # Jenkins pipeline and K8s deployment
├── web-app/                 # Next.js frontend
├── embedding-service/       # Python embedding service
├── intelligence-service/    # Python intelligence service  
├── video-processing-service/  # Python video processing service
├── deploy.sh               # 🔧 One-time infrastructure setup
└── k8s-deploy.sh           # 🚀 Continuous deployment script
```

## 🚀 Quick Start

### 1. Initial Infrastructure Setup (Run Once)

```bash
# First, set up encrypted secrets
cd ansible && ./setup-vault.sh

# Then provision infrastructure and configure server
./deploy.sh

# Or step by step:
./deploy.sh --dry-run                    # Preview what will be created
./deploy.sh -e prod                      # Deploy to production
./deploy.sh --skip-terraform             # Only run Ansible (if droplet exists)
```

**What this does:**
- Creates DigitalOcean droplet with Terraform
- Configures server with Ansible (Docker, k3s, monitoring tools)
- Optionally deploys initial Kubernetes setup

### 2. Continuous Deployment (Run on Code Changes)

```bash
# Auto-detect changes and deploy
./k8s-deploy.sh

# Force rebuild all services
./k8s-deploy.sh --build-all

# Deploy specific service
./k8s-deploy.sh --service web-app

# Deploy monitoring stack updates
./k8s-deploy.sh --monitoring

# Deploy Jenkins updates  
./k8s-deploy.sh --jenkins
```

**What this does:**
- Detects which services changed (git diff)
- Builds and pushes Docker images for changed services
- Updates Kubernetes deployments with new images
- Runs health checks

## 🔄 Development Workflow

### Initial Setup (Once)
1. **Configure credentials**: Update `infrastructure/terraform.tfvars`
2. **Provision infrastructure**: `./deploy.sh`
3. **Verify deployment**: Check Kubernetes cluster is running

### Daily Development (Continuous)
1. **Make code changes** to any service
2. **Commit and push** to trigger Jenkins pipeline
3. **Jenkins automatically**:
   - Detects which services changed
   - Builds Docker images
   - Updates Kubernetes deployments
   - Runs tests and health checks

### Manual Deployment
```bash
# Deploy single service after local changes
./k8s-deploy.sh --service web-app

# Deploy all services with latest code
./k8s-deploy.sh --build-all

# Deploy without building (use existing images)
./k8s-deploy.sh --skip-build
```

## 🛠️ Components

### Infrastructure (One-Time)
| Component | Purpose | When to Run |
|-----------|---------|-------------|
| **Terraform** | Provision DigitalOcean droplet | Initial setup, infrastructure changes |
| **Ansible** | Configure server dependencies | Initial setup, dependency updates |

### Applications (Continuous)
| Component | Purpose | When to Run |
|-----------|---------|-------------|
| **Docker Builds** | Package applications | Every code change |
| **Kubernetes** | Container orchestration | Every deployment |
| **Jenkins Pipeline** | Automated CI/CD | Every git push |

### Monitoring (As Needed)
| Component | Purpose | When to Run |
|-----------|---------|-------------|
| **Prometheus** | Metrics collection | Setup + config changes |
| **Grafana** | Visualization | Setup + dashboard changes |

## 🎯 When to Use Each Script

### `./deploy.sh` - Infrastructure Setup
**Use when:**
- ✅ Setting up the project for the first time
- ✅ Provisioning a new environment (dev/staging/prod)
- ✅ Updating server dependencies (Docker version, k3s version)
- ✅ Adding new infrastructure components

**Don't use for:**
- ❌ Application code changes
- ❌ Regular deployments
- ❌ Service updates

### `./k8s-deploy.sh` - Continuous Deployment  
**Use when:**
- ✅ Deploying application code changes
- ✅ Updating service configurations
- ✅ Rolling out new features
- ✅ Hotfixes and patches

**Don't use for:**
- ❌ Initial infrastructure setup
- ❌ Server configuration changes
- ❌ Adding new servers

### Jenkins Pipeline - Automated CI/CD
**Automatically runs on:**
- ✅ Git push to main branch
- ✅ Pull request merges
- ✅ Scheduled builds (if configured)

**Handles:**
- ✅ Change detection
- ✅ Docker image building
- ✅ Testing
- ✅ Kubernetes deployment
- ✅ Health checks

## 🔧 Configuration

### Environment Variables
Update these in your deployment environment:

```bash
# Docker Registry
DOCKER_REGISTRY=your-registry.com

# DigitalOcean
DO_TOKEN=your-digitalocean-token

# Environment
ENVIRONMENT=dev|staging|prod
```

### Kubernetes Configuration
The cluster expects these namespaces:
- `videocopilot` - Main application services
- `jenkins` - CI/CD pipeline
- `monitoring` - Prometheus & Grafana

### Service Ports
- **Web App**: 3000
- **Embedding Service**: 8000  
- **Intelligence Service**: 8001
- **Video Processing Service**: 8002
- **Jenkins**: 8080
- **Prometheus**: 9090
- **Grafana**: 3000

## 🌐 Access URLs

After deployment, services are available at:
- **Web App**: http://web-app.videocopilot.local
- **Jenkins**: http://jenkins.videocopilot.local:8080
- **Grafana**: http://grafana.videocopilot.local:3000
- **Prometheus**: http://prometheus.videocopilot.local:9090

## 🔍 Monitoring & Debugging

### Check Deployment Status
```bash
kubectl get pods -n videocopilot
kubectl get services -n videocopilot
kubectl get ingress -n videocopilot
```

### View Logs
```bash
kubectl logs -f deployment/web-app -n videocopilot
kubectl logs -f deployment/embedding-service -n videocopilot
```

### Jenkins Pipeline Status
- Access Jenkins UI at configured URL
- Check pipeline logs for build/deployment status
- View deployment history and rollback if needed

### Monitoring
- **Grafana** dashboards for application metrics
- **Prometheus** for raw metrics and alerting
- **Kubernetes** built-in monitoring for pod/node status

## 🚨 Troubleshooting

### Common Issues

**Infrastructure Issues:**
- Check `./deploy.sh --dry-run` for configuration problems
- Verify DigitalOcean credentials and quotas
- Ensure SSH keys are properly configured

**Deployment Issues:**
- Check `./k8s-deploy.sh --dry-run` for deployment problems
- Verify Docker registry credentials
- Ensure Kubernetes cluster is healthy

**Service Issues:**
- Check pod logs: `kubectl logs <pod-name> -n videocopilot`
- Verify service endpoints: `kubectl get svc -n videocopilot`
- Test health endpoints manually

### Recovery Procedures

**Rollback Deployment:**
```bash
kubectl rollout undo deployment/<service-name> -n videocopilot
```

**Restart Service:**
```bash
kubectl rollout restart deployment/<service-name> -n videocopilot
```

**Reset Entire Stack:**
```bash
kubectl delete namespace videocopilot
./k8s-deploy.sh --build-all
```

## 📋 Maintenance

### Regular Tasks
- **Weekly**: Review monitoring dashboards and alerts
- **Monthly**: Update Docker base images and rebuild
- **Quarterly**: Update Kubernetes, Jenkins, and monitoring versions

### Security Updates
- Keep base Docker images updated
- Regularly update Jenkins plugins
- Monitor for security advisories on dependencies

### Backup Strategy
- **Application Data**: Stored in PostgreSQL (configure backup)
- **Jenkins Configuration**: Backup Jenkins home directory
- **Monitoring Data**: Configure Prometheus/Grafana backup retention

---

## 🎉 Success Metrics

Your DevOps pipeline is working well when:
- ✅ Code changes deploy automatically within 5-10 minutes
- ✅ Zero-downtime deployments are the norm
- ✅ Rollbacks happen quickly when needed
- ✅ Monitoring catches issues before users do
- ✅ Infrastructure changes are rare and planned