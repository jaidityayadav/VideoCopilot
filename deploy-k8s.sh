#!/bin/bash

# VideoCopilot Kubernetes Deployment Script
# This script securely deploys secrets from your .env file to Kubernetes
# without exposing them in git repositories

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="videocopilot"
SECRET_NAME="videocopilot-secrets"
CONFIGMAP_NAME="videocopilot-config"

echo -e "${GREEN}🚀 VideoCopilot Kubernetes Deployment${NC}"
echo "========================================"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Source environment variables
source .env

# Check required variables
required_vars=(
    "DATABASE_URL"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "AWS_S3_BUCKET"
    "PINECONE_API_KEY"
    "PINECONE_INDEX_NAME"
    "GROQ_API_KEY"
    "NEXTAUTH_SECRET"
    "JWT_SECRET"
)

echo -e "${YELLOW}🔍 Checking required environment variables...${NC}"
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Error: $var is not set in .env file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ $var${NC}"
done

# Function to test kubectl connectivity
test_kubectl() {
    echo -e "${YELLOW}🔗 Testing kubectl connectivity...${NC}"
    if ! kubectl cluster-info >/dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
        echo "Please ensure:"
        echo "1. kubectl is installed and configured"
        echo "2. You have access to your cluster"
        echo "3. Your kubeconfig is correctly set up"
        exit 1
    fi
    echo -e "${GREEN}✅ kubectl connectivity confirmed${NC}"
}

# Function to create namespace
create_namespace() {
    echo -e "${YELLOW}📦 Creating namespace...${NC}"
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}✅ Namespace '$NAMESPACE' ready${NC}"
}

# Function to create secrets
create_secrets() {
    echo -e "${YELLOW}🔐 Creating secrets...${NC}"
    
    # Delete existing secret if it exists
    kubectl delete secret $SECRET_NAME -n $NAMESPACE --ignore-not-found=true
    
    # Create secret with base64 encoded values
    kubectl create secret generic $SECRET_NAME -n $NAMESPACE \
        --from-literal=database-url="$DATABASE_URL" \
        --from-literal=aws-access-key-id="$AWS_ACCESS_KEY_ID" \
        --from-literal=aws-secret-access-key="$AWS_SECRET_ACCESS_KEY" \
        --from-literal=pinecone-api-key="$PINECONE_API_KEY" \
        --from-literal=groq-api-key="$GROQ_API_KEY" \
        --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
        --from-literal=jwt-secret="$JWT_SECRET"
    
    echo -e "${GREEN}✅ Secrets created successfully${NC}"
}

# Function to create configmap
create_configmap() {
    echo -e "${YELLOW}⚙️  Creating configmap...${NC}"
    
    # Delete existing configmap if it exists
    kubectl delete configmap $CONFIGMAP_NAME -n $NAMESPACE --ignore-not-found=true
    
    # Create configmap with non-sensitive configuration
    kubectl create configmap $CONFIGMAP_NAME -n $NAMESPACE \
        --from-literal=aws-region="$AWS_REGION" \
        --from-literal=aws-s3-bucket="$AWS_S3_BUCKET" \
        --from-literal=pinecone-index-name="$PINECONE_INDEX_NAME" \
        --from-literal=rate-limit-window="900" \
        --from-literal=rate-limit-max="100" \
        --from-literal=embedding-service-url="http://videocopilot-embedding.$NAMESPACE.svc.cluster.local:8001" \
        --from-literal=intelligence-service-url="http://videocopilot-intelligence.$NAMESPACE.svc.cluster.local:8002" \
        --from-literal=video-processing-service-url="http://videocopilot-video-processing.$NAMESPACE.svc.cluster.local:8000" \
        --from-literal=nextauth-url="http://143.244.137.118:30000"
    
    echo -e "${GREEN}✅ ConfigMap created successfully${NC}"
}

# Function to deploy Jenkins
deploy_jenkins() {
    echo -e "${YELLOW}� Deploying Jenkins...${NC}"
    
    kubectl apply -f k8s/jenkins/01-jenkins-namespace.yaml
    kubectl apply -f k8s/jenkins/02-jenkins-pvc.yaml
    kubectl apply -f k8s/jenkins/04-jenkins-config.yaml
    kubectl apply -f k8s/jenkins/03-jenkins-deployment.yaml
    
    echo -e "${GREEN}✅ Jenkins deployed successfully${NC}"
    echo -e "${BLUE}📋 Jenkins will be available at: http://143.244.137.118:32000${NC}"
    echo -e "${BLUE}🔑 Default admin credentials: admin / videocopilot123${NC}"
    echo -e "${YELLOW}⚠️  Please change the default password after first login!${NC}"
}

# Function to update image tags in manifests
update_image_tags() {
    local tag="${1:-latest}"
    local branch="${2:-main}"
    echo -e "${YELLOW}🏷️  Updating image tags to: ${tag}${NC}"
    
    GITHUB_REPO="${GITHUB_REPOSITORY:-$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')}"
    
    services=("web-app" "embedding-service" "intelligence-service" "video-processing-service")
    
    for service in "${services[@]}"; do
        # Find the correct manifest file
        manifest_file=$(find k8s/ -name "*${service}*.yaml" | head -1)
        if [ -f "$manifest_file" ]; then
            # Update image tag
            sed -i.bak "s|image: ghcr.io/.*/videocopilot/${service}:.*|image: ghcr.io/${GITHUB_REPO}/${service}:${tag}|g" "$manifest_file"
            echo -e "${GREEN}✅ Updated ${service} image tag in ${manifest_file}${NC}"
        else
            echo -e "${RED}❌ Manifest file for ${service} not found${NC}"
        fi
    done
}

# Function to deploy manifests
deploy_manifests() {
    echo -e "${YELLOW}🚀 Deploying Kubernetes manifests...${NC}"
    
    # Deploy in order
    manifests=(
        "k8s/01-database.yaml"
        "k8s/02-embedding-service.yaml"
        "k8s/03-intelligence-service.yaml"
        "k8s/04-video-processing-service.yaml"
        "k8s/05-web-app.yaml"
        "k8s/06-ingress.yaml"
        "k8s/07-monitoring.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [ -f "$manifest" ]; then
            echo -e "${YELLOW}Applying $manifest...${NC}"
            kubectl apply -f "$manifest" -n $NAMESPACE
            echo -e "${GREEN}✅ $manifest applied${NC}"
        else
            echo -e "${RED}⚠️  Warning: $manifest not found${NC}"
        fi
    done
}

# Function to check deployment status
check_deployment_status() {
    echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
    
    echo "Deployments:"
    kubectl get deployments -n $NAMESPACE
    
    echo -e "\nServices:"
    kubectl get services -n $NAMESPACE
    
    echo -e "\nPods:"
    kubectl get pods -n $NAMESPACE
}

# Main execution with new options
main() {
    case "${1:-deploy}" in
        "secrets-only")
            test_kubectl
            create_namespace
            create_secrets
            create_configmap
            echo -e "${GREEN}🎉 Secrets and ConfigMap deployed successfully!${NC}"
            ;;
        "jenkins")
            test_kubectl
            deploy_jenkins
            echo -e "${GREEN}🎉 Jenkins deployed successfully!${NC}"
            echo -e "${YELLOW}⚠️  Remember to configure GitHub webhooks and API tokens${NC}"
            ;;
        "update-images")
            tag="${2:-latest}"
            branch="${3:-main}"
            update_image_tags "$tag" "$branch"
            echo -e "${GREEN}🎉 Image tags updated to: ${tag}${NC}"
            ;;
        "deploy")
            test_kubectl
            create_namespace
            create_secrets
            create_configmap
            deploy_manifests
            check_deployment_status
            echo -e "${GREEN}🎉 Deployment completed!${NC}"
            echo -e "${BLUE}🌐 Application available at: http://143.244.137.118:30000${NC}"
            ;;
        "full-setup")
            test_kubectl
            create_namespace
            create_secrets
            create_configmap
            deploy_jenkins
            deploy_manifests
            check_deployment_status
            echo -e "${GREEN}🎉 Full setup completed!${NC}"
            echo -e "${BLUE}🌐 Application: http://143.244.137.118:30000${NC}"
            echo -e "${BLUE}🔧 Jenkins: http://143.244.137.118:32000${NC}"
            ;;
        "status")
            test_kubectl
            check_deployment_status
            echo ""
            echo -e "${YELLOW}Jenkins Status:${NC}"
            kubectl get pods -n jenkins 2>/dev/null || echo "Jenkins not deployed"
            ;;
        *)
            echo "Usage: $0 [secrets-only|jenkins|update-images|deploy|full-setup|status]"
            echo "  secrets-only:     Deploy only secrets and configmap"
            echo "  jenkins:          Deploy Jenkins CI/CD pipeline"
            echo "  update-images:    Update image tags in manifests"
            echo "  deploy:           Deploy application only"
            echo "  full-setup:       Deploy everything (Jenkins + Application)"
            echo "  status:           Check deployment status"
            exit 1
            ;;
    esac
}

main "$@"