#!/bin/bash

# VideoCopilot Kubernetes Continuous Deployment Script
# This script handles application deployments and updates to Kubernetes
# Run this for code changes, not for infrastructure changes

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
K8S_DIR="$PROJECT_ROOT/k8s"
DOCKER_REGISTRY="your-registry.com"  # Update this

# Default values
ENVIRONMENT="dev"
DRY_RUN=false
BUILD_ALL=false
SKIP_BUILD=false
SKIP_DEPLOY=false
TARGET_SERVICE=""

# Services configuration
declare -A SERVICES=(
    ["web-app"]="web-app/"
    ["embedding-service"]="embedding-service/"
    ["intelligence-service"]="intelligence-service/"
    ["video-processing-service"]="video-processing-service/"
)

declare -A SERVICE_PORTS=(
    ["web-app"]="3000"
    ["embedding-service"]="8000"
    ["intelligence-service"]="8001" 
    ["video-processing-service"]="8002"
)

# Function to print colored output
print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Continuous deployment for VideoCopilot applications to Kubernetes

OPTIONS:
    -e, --environment ENV       Environment (dev/staging/prod) [default: dev]
    -s, --service SERVICE       Deploy specific service only
    -h, --help                  Show this help message
    --dry-run                   Show what would be deployed without executing
    --build-all                 Force build and deploy all services
    --skip-build                Skip Docker build, only deploy existing images
    --skip-deploy               Only build images, skip Kubernetes deployment
    --monitoring                Deploy/update monitoring stack only
    --jenkins                   Deploy/update Jenkins only

EXAMPLES:
    $0                          # Auto-detect changes and deploy
    $0 --build-all              # Force rebuild and deploy all services
    $0 -s web-app               # Deploy only web-app service
    $0 --monitoring             # Update monitoring stack
    $0 --skip-build             # Deploy without building (use existing images)

SERVICES:
    web-app, embedding-service, intelligence-service, video-processing-service

PREREQUISITES:
    - kubectl configured with cluster access
    - docker installed and running
    - Infrastructure already provisioned (run ./deploy.sh first)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--service)
                TARGET_SERVICE="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --build-all)
                BUILD_ALL=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --monitoring)
                TARGET_SERVICE="monitoring"
                shift
                ;;
            --jenkins)
                TARGET_SERVICE="jenkins"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Detect changed services
detect_changes() {
    if [[ $BUILD_ALL == true ]] || [[ -n $TARGET_SERVICE ]]; then
        return 0
    fi
    
    print_step "Detecting changed services..."
    
    # Get changed files since last commit
    local changed_files
    changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git ls-files)
    
    if [[ -z "$changed_files" ]]; then
        print_warning "No changes detected"
        return 1
    fi
    
    print_info "Changed files:"
    echo "$changed_files" | sed 's/^/  /'
    
    # Determine which services need to be rebuilt
    local services_to_build=()
    
    for service in "${!SERVICES[@]}"; do
        local service_dir="${SERVICES[$service]}"
        if echo "$changed_files" | grep -q "^$service_dir"; then
            services_to_build+=("$service")
        fi
    done
    
    # Check for infrastructure changes that affect all services
    if echo "$changed_files" | grep -qE "^(k8s/|docker-compose|Dockerfile|infrastructure/|jenkins/)"; then
        print_info "Infrastructure changes detected, will rebuild all services"
        BUILD_ALL=true
        return 0
    fi
    
    if [[ ${#services_to_build[@]} -eq 0 ]]; then
        print_warning "No service changes detected"
        return 1
    fi
    
    print_info "Services to rebuild: ${services_to_build[*]}"
    return 0
}

# Build Docker image for a service
build_service() {
    local service=$1
    local service_dir="${SERVICES[$service]}"
    
    if [[ ! -d "$service_dir" ]]; then
        print_error "Service directory not found: $service_dir"
        return 1
    fi
    
    print_info "Building $service..."
    
    local commit_hash
    commit_hash=$(git rev-parse --short HEAD)
    local image_tag="${DOCKER_REGISTRY}/videocopilot/${service}:${commit_hash}"
    local latest_tag="${DOCKER_REGISTRY}/videocopilot/${service}:latest"
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would build $image_tag"
        return 0
    fi
    
    cd "$service_dir"
    
    # Build with BuildKit for better caching
    DOCKER_BUILDKIT=1 docker build \
        --cache-from "$latest_tag" \
        -t "$image_tag" \
        -t "$latest_tag" \
        .
    
    # Push images
    docker push "$image_tag"
    docker push "$latest_tag"
    
    print_success "Built and pushed $service: $image_tag"
    
    cd "$PROJECT_ROOT"
    
    # Store image tag for deployment
    echo "$image_tag" > "/tmp/videocopilot-${service}-image.txt"
}

# Deploy service to Kubernetes
deploy_service() {
    local service=$1
    local manifest_file="$K8S_DIR"
    
    # Map service to manifest file
    case $service in
        "web-app")
            manifest_file="$K8S_DIR/05-web-app.yaml"
            ;;
        "embedding-service")
            manifest_file="$K8S_DIR/02-embedding-service.yaml"
            ;;
        "intelligence-service")
            manifest_file="$K8S_DIR/03-intelligence-service.yaml"
            ;;
        "video-processing-service")
            manifest_file="$K8S_DIR/04-video-processing-service.yaml"
            ;;
        *)
            print_error "Unknown service: $service"
            return 1
            ;;
    esac
    
    if [[ ! -f "$manifest_file" ]]; then
        print_error "Manifest file not found: $manifest_file"
        return 1
    fi
    
    print_info "Deploying $service to Kubernetes..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would apply $manifest_file"
        return 0
    fi
    
    # Check if we have a new image to deploy
    local image_tag=""
    if [[ -f "/tmp/videocopilot-${service}-image.txt" ]]; then
        image_tag=$(cat "/tmp/videocopilot-${service}-image.txt")
        print_info "Using new image: $image_tag"
        
        # Update manifest with new image tag
        sed "s|image: videocopilot/${service}:latest|image: ${image_tag}|g" "$manifest_file" | kubectl apply -f -
    else
        # Apply manifest as-is
        kubectl apply -f "$manifest_file"
    fi
    
    # Wait for rollout to complete
    print_info "Waiting for $service rollout to complete..."
    kubectl rollout status deployment/$service -n videocopilot --timeout=300s
    
    print_success "$service deployed successfully"
    
    # Clean up temp file
    rm -f "/tmp/videocopilot-${service}-image.txt"
}

# Deploy monitoring stack
deploy_monitoring() {
    print_step "Deploying monitoring stack..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would deploy monitoring stack"
        return 0
    fi
    
    kubectl apply -f "$K8S_DIR/07-monitoring.yaml"
    
    # Wait for deployments
    kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n monitoring
    kubectl wait --for=condition=available --timeout=300s deployment/grafana -n monitoring
    
    print_success "Monitoring stack deployed"
}

# Deploy Jenkins
deploy_jenkins() {
    print_step "Deploying Jenkins..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would deploy Jenkins"
        return 0
    fi
    
    kubectl apply -f "$PROJECT_ROOT/jenkins/jenkins-k8s.yaml"
    
    # Wait for deployment
    kubectl wait --for=condition=available --timeout=600s deployment/jenkins -n jenkins
    
    print_success "Jenkins deployed"
}

# Health check for deployed services
health_check() {
    print_step "Running health checks..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would run health checks"
        return 0
    fi
    
    print_info "Checking pod status..."
    kubectl get pods -n videocopilot
    
    print_info "Checking service endpoints..."
    kubectl get services -n videocopilot
    
    print_info "Checking ingress..."
    kubectl get ingress -n videocopilot
    
    # Test service health endpoints
    for service in "${!SERVICES[@]}"; do
        local port="${SERVICE_PORTS[$service]}"
        print_info "Testing $service health endpoint..."
        
        if kubectl get deployment "$service" -n videocopilot &>/dev/null; then
            kubectl exec -n videocopilot "deployment/$service" -- curl -f "http://localhost:$port/health" &>/dev/null || \
            print_warning "$service health check failed (this may be normal if no health endpoint)"
        fi
    done
    
    print_success "Health checks completed"
}

# Main execution function
main() {
    parse_args "$@"
    
    echo -e "${PURPLE}🚀 VideoCopilot Kubernetes Deployment${NC}"
    echo "======================================"
    echo
    
    if [[ $DRY_RUN == true ]]; then
        print_warning "DRY RUN MODE - No actual changes will be made"
        echo
    fi
    
    # Check prerequisites
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is required but not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null && [[ $SKIP_BUILD == false ]]; then
        print_error "docker is required for building images"
        exit 1
    fi
    
    # Handle specific service deployment requests
    if [[ $TARGET_SERVICE == "monitoring" ]]; then
        deploy_monitoring
        exit 0
    elif [[ $TARGET_SERVICE == "jenkins" ]]; then
        deploy_jenkins
        exit 0
    elif [[ -n $TARGET_SERVICE ]] && [[ -n ${SERVICES[$TARGET_SERVICE]} ]]; then
        if [[ $SKIP_BUILD == false ]]; then
            build_service "$TARGET_SERVICE"
        fi
        if [[ $SKIP_DEPLOY == false ]]; then
            deploy_service "$TARGET_SERVICE"
        fi
        health_check
        exit 0
    fi
    
    # Auto-detect changes if no specific service targeted
    if ! detect_changes && [[ $BUILD_ALL == false ]]; then
        print_info "No changes detected, nothing to deploy"
        exit 0
    fi
    
    # Build and deploy services
    local services_to_process=()
    
    if [[ $BUILD_ALL == true ]]; then
        services_to_process=("${!SERVICES[@]}")
    else
        # Process only changed services (detected in detect_changes)
        for service in "${!SERVICES[@]}"; do
            local service_dir="${SERVICES[$service]}"
            if git diff --name-only HEAD~1 HEAD | grep -q "^$service_dir" || [[ $BUILD_ALL == true ]]; then
                services_to_process+=("$service")
            fi
        done
    fi
    
    # Build phase
    if [[ $SKIP_BUILD == false ]] && [[ ${#services_to_process[@]} -gt 0 ]]; then
        print_step "Building Docker images..."
        for service in "${services_to_process[@]}"; do
            build_service "$service"
        done
    fi
    
    # Deploy phase
    if [[ $SKIP_DEPLOY == false ]]; then
        print_step "Deploying to Kubernetes..."
        
        # Ensure namespace and dependencies exist
        kubectl apply -f "$K8S_DIR/00-namespace-secrets.yaml" || true
        kubectl apply -f "$K8S_DIR/01-database.yaml" || true
        
        # Wait for database to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/postgres -n videocopilot || true
        
        # Deploy services in dependency order
        local deploy_order=("embedding-service" "intelligence-service" "video-processing-service" "web-app")
        
        for service in "${deploy_order[@]}"; do
            if [[ " ${services_to_process[*]} " =~ " $service " ]] || [[ $BUILD_ALL == true ]]; then
                deploy_service "$service"
            fi
        done
        
        # Apply ingress
        kubectl apply -f "$K8S_DIR/06-ingress.yaml"
    fi
    
    # Run health checks
    health_check
    
    print_success "🎉 Deployment completed successfully!"
    echo
    print_info "Service URLs:"
    echo "  • Web App: http://web-app.videocopilot.local"
    echo "  • API Services: http://api.videocopilot.local"
    echo
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"