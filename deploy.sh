#!/bin/bash

# VideoCopilot Infrastructure Setup Script
# This script handles ONE-TIME infrastructure provisioning and server configuration
# For continuous deployment, use the Jenkins pipeline or k8s-deploy.sh

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
PROJECT_ROOT="$SCRIPT_DIR"  # Script is in project root
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure"
ANSIBLE_DIR="$PROJECT_ROOT/ansible"
K8S_DIR="$PROJECT_ROOT/k8s"
JENKINS_DIR="$PROJECT_ROOT/jenkins"

# Default values - Infrastructure setup focus
ENVIRONMENT="dev"
SKIP_TERRAFORM=false
SKIP_ANSIBLE=false
SKIP_K8S=true  # K8s apps handled by separate script
SKIP_MONITORING=true  # Monitoring handled by separate script
SKIP_JENKINS=true  # Jenkins handled by separate script
DRY_RUN=false
INFRA_SETUP_MODE=true

# Function to print colored output
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                    VideoCopilot DevOps Deployment                           ║"
    echo "║                         Complete Infrastructure Setup                        ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

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

Setup VideoCopilot infrastructure (ONE-TIME) with Terraform and Ansible
For continuous deployment, use k8s-deploy.sh or Jenkins pipeline

OPTIONS:
    -e, --environment ENV       Environment to deploy (dev/staging/prod) [default: dev]
    -h, --help                  Show this help message
    --dry-run                   Show what would be deployed without actually deploying
    --skip-terraform            Skip Terraform infrastructure provisioning
    --skip-ansible              Skip Ansible server configuration
    --include-k8s               Also deploy initial Kubernetes setup
    --include-monitoring        Also deploy monitoring stack
    --include-jenkins           Also deploy Jenkins

EXAMPLES:
    $0                          # Setup infrastructure only (recommended)
    $0 -e prod                  # Setup production infrastructure
    $0 --include-k8s            # Setup infra + initial K8s deployment
    $0 --skip-terraform         # Only run Ansible (if droplet exists)
    $0 --dry-run                # Show setup plan without executing
    
FOR CONTINUOUS DEPLOYMENT:
    ./k8s-deploy.sh             # Deploy/update applications only
    # Or use Jenkins pipeline for automated deployments

PREREQUISITES:
    - terraform installed and configured
    - ansible installed with required collections
    - kubectl configured with cluster access
    - docker installed and running
    - DigitalOcean token configured

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
            -h|--help)
                show_usage
                exit 0
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-terraform)
                SKIP_TERRAFORM=true
                shift
                ;;
            --skip-ansible)
                SKIP_ANSIBLE=true
                shift
                ;;
            --skip-k8s)
                SKIP_K8S=true
                shift
                ;;
            --skip-monitoring)
                SKIP_MONITORING=true
                shift
                ;;
            --skip-jenkins)
                SKIP_JENKINS=true
                shift
                ;;
            --include-k8s)
                SKIP_K8S=false
                shift
                ;;
            --include-monitoring)
                SKIP_MONITORING=false
                shift
                ;;
            --include-jenkins)
                SKIP_JENKINS=false
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

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v ansible-playbook >/dev/null 2>&1 || missing_tools+=("ansible")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check environment files
    if [[ ! -f "$TERRAFORM_DIR/terraform.tfvars" && $SKIP_TERRAFORM == false ]]; then
        print_warning "terraform.tfvars not found. Creating template..."
        create_terraform_vars_template
    fi
    
    if [[ ! -f "$ANSIBLE_DIR/inventory.ini" && $SKIP_ANSIBLE == false ]]; then
        print_warning "Ansible inventory not found. Will be created after Terraform."
    fi
    
    print_success "Prerequisites check completed"
}

# Create Terraform variables template
create_terraform_vars_template() {
    cat > "$TERRAFORM_DIR/terraform.tfvars" << EOF
# DigitalOcean Configuration
do_token = "your-digitalocean-token-here"
region = "nyc1"

# Authentication Configuration
# Use a strong password (minimum 8 characters)
root_password = "VideoCopilot123!"

# Project Configuration
project_name = "videocopilot"
environment = "$ENVIRONMENT"

# Domain Configuration (optional)
domain_name = "videocopilot.local"
EOF
    
    print_warning "Please update $TERRAFORM_DIR/terraform.tfvars with your DigitalOcean token and secure password"
}

# Deploy infrastructure with Terraform
deploy_terraform() {
    if [[ $SKIP_TERRAFORM == true ]]; then
        print_info "Skipping Terraform deployment"
        return 0
    fi
    
    print_step "Deploying infrastructure with Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would execute terraform plan and apply"
        return 0
    fi
    
    # Initialize Terraform
    print_info "Initializing Terraform..."
    terraform init
    
    # Plan deployment
    print_info "Planning infrastructure deployment..."
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
    
    # Apply deployment
    print_info "Applying infrastructure deployment..."
    terraform apply tfplan
    
    # Get outputs
    DROPLET_IP=$(terraform output -raw droplet_ip)
    print_success "Infrastructure deployed successfully!"
    print_info "Droplet IP: $DROPLET_IP"
    
    # Create Ansible inventory
    create_ansible_inventory "$DROPLET_IP"
    
    cd "$PROJECT_ROOT"
}

# Create Ansible inventory
create_ansible_inventory() {
    local droplet_ip=$1
    
    # Create inventory with secure password reference from vault
    cat > "$ANSIBLE_DIR/inventory.ini" << EOF
[videocopilot]
droplet ansible_host=$droplet_ip ansible_user=root ansible_password="{{ ansible_ssh_password }}"

[videocopilot:vars]
ansible_python_interpreter=/usr/bin/python3
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
ansible_connection=ssh
# SSH password referenced from encrypted vault.yml
EOF
    
    print_success "Ansible inventory created - credentials referenced from encrypted vault"
}

# Configure servers with Ansible
deploy_ansible() {
    if [[ $SKIP_ANSIBLE == true ]]; then
        print_info "Skipping Ansible configuration"
        return 0
    fi
    
    print_step "Configuring servers with Ansible..."
    
    cd "$ANSIBLE_DIR"
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would execute ansible playbook"
        return 0
    fi
    
    # Wait for server to be ready
    print_info "Waiting for server to be ready..."
    sleep 30
    
    # Check if vault file exists and is encrypted
    if [[ -f "vault.yml" ]]; then
        if file vault.yml | grep -q "ASCII text"; then
            print_warning "vault.yml is not encrypted! Run 'ansible-vault encrypt vault.yml' first"
            print_info "Or run: cd ansible && ./setup-vault.sh"
            return 1
        fi
        
        # Run Ansible playbook with vault
        print_info "Running Ansible playbook with encrypted vault..."
        if [[ -f ".vault_pass" ]]; then
            ansible-playbook -i inventory.ini playbook.yml -v --vault-password-file .vault_pass
        else
            print_info "Enter vault password when prompted..."
            ansible-playbook -i inventory.ini playbook.yml -v --ask-vault-pass
        fi
    else
        print_warning "vault.yml not found. Running playbook without secrets..."
        print_info "To set up secrets, run: cd ansible && ./setup-vault.sh"
        ansible-playbook -i inventory.ini playbook.yml -v
    fi
    
    print_success "Server configuration completed!"
    
    cd "$PROJECT_ROOT"
}

# Deploy Kubernetes applications
deploy_kubernetes() {
    if [[ $SKIP_K8S == true ]]; then
        print_info "Skipping Kubernetes deployment"
        return 0
    fi
    
    print_step "Deploying applications to Kubernetes..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would apply Kubernetes manifests"
        return 0
    fi
    
    # Apply manifests in order
    local manifests=(
        "00-namespace-secrets.yaml"
        "01-database.yaml"
        "02-embedding-service.yaml"
        "03-intelligence-service.yaml"
        "04-video-processing-service.yaml"
        "05-web-app.yaml"
        "06-ingress.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [[ -f "$K8S_DIR/$manifest" ]]; then
            print_info "Applying $manifest..."
            kubectl apply -f "$K8S_DIR/$manifest"
            
            # Wait for deployments to be ready
            if [[ $manifest == *"service.yaml" || $manifest == "05-web-app.yaml" ]]; then
                service_name=$(echo $manifest | cut -d'-' -f2- | cut -d'.' -f1)
                print_info "Waiting for $service_name to be ready..."
                kubectl wait --for=condition=available --timeout=300s deployment/$service_name -n videocopilot || true
            fi
        fi
    done
    
    print_success "Kubernetes applications deployed successfully!"
    
    # Show status
    kubectl get pods -n videocopilot
    kubectl get services -n videocopilot
}

# Deploy Jenkins
deploy_jenkins() {
    if [[ $SKIP_JENKINS == true ]]; then
        print_info "Skipping Jenkins deployment"
        return 0
    fi
    
    print_step "Deploying Jenkins..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would deploy Jenkins to Kubernetes"
        return 0
    fi
    
    # Apply Jenkins manifests
    kubectl apply -f "$JENKINS_DIR/jenkins-k8s.yaml"
    
    # Wait for Jenkins to be ready
    print_info "Waiting for Jenkins to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment/jenkins -n jenkins
    
    # Get Jenkins URL
    JENKINS_URL=$(kubectl get service jenkins-lb -n jenkins -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [[ -z "$JENKINS_URL" ]]; then
        JENKINS_URL="jenkins.jenkins.svc.cluster.local"
    fi
    
    print_success "Jenkins deployed successfully!"
    print_info "Jenkins URL: http://$JENKINS_URL:8080"
    print_info "Default credentials: admin/admin123"
}

# Deploy monitoring stack
deploy_monitoring() {
    if [[ $SKIP_MONITORING == true ]]; then
        print_info "Skipping monitoring deployment"
        return 0
    fi
    
    print_step "Deploying monitoring stack (Prometheus & Grafana)..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would deploy monitoring stack to Kubernetes"
        return 0
    fi
    
    # Apply monitoring manifests
    kubectl apply -f "$K8S_DIR/07-monitoring.yaml"
    
    # Wait for services to be ready
    print_info "Waiting for Prometheus to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n monitoring
    
    print_info "Waiting for Grafana to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/grafana -n monitoring
    
    # Get service URLs
    PROMETHEUS_URL=$(kubectl get service prometheus-lb -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    GRAFANA_URL=$(kubectl get service grafana-lb -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [[ -z "$PROMETHEUS_URL" ]]; then
        PROMETHEUS_URL="prometheus.monitoring.svc.cluster.local"
    fi
    if [[ -z "$GRAFANA_URL" ]]; then
        GRAFANA_URL="grafana.monitoring.svc.cluster.local"
    fi
    
    print_success "Monitoring stack deployed successfully!"
    print_info "Prometheus URL: http://$PROMETHEUS_URL:9090"
    print_info "Grafana URL: http://$GRAFANA_URL:3000"
    print_info "Grafana credentials: admin/admin123"
}

# Validate deployment
validate_deployment() {
    print_step "Validating deployment..."
    
    if [[ $DRY_RUN == true ]]; then
        print_info "DRY RUN: Would validate deployment"
        return 0
    fi
    
    print_info "Checking VideoCopilot services..."
    kubectl get pods -n videocopilot
    
    if [[ $SKIP_JENKINS == false ]]; then
        print_info "Checking Jenkins..."
        kubectl get pods -n jenkins
    fi
    
    if [[ $SKIP_MONITORING == false ]]; then
        print_info "Checking monitoring stack..."
        kubectl get pods -n monitoring
    fi
    
    print_info "Checking ingress..."
    kubectl get ingress --all-namespaces
    
    print_success "Deployment validation completed!"
}

# Show deployment summary
show_summary() {
    print_banner
    
    echo -e "${GREEN}✅ VideoCopilot Deployment Summary${NC}"
    echo "=================================="
    echo
    echo -e "${CYAN}Environment:${NC} $ENVIRONMENT"
    echo -e "${CYAN}Deployment Date:${NC} $(date)"
    echo
    
    if [[ $SKIP_TERRAFORM == false ]]; then
        echo -e "${GREEN}✅ Infrastructure:${NC} Deployed with Terraform"
    fi
    
    if [[ $SKIP_ANSIBLE == false ]]; then
        echo -e "${GREEN}✅ Server Configuration:${NC} Configured with Ansible"
    fi
    
    if [[ $SKIP_K8S == false ]]; then
        echo -e "${GREEN}✅ Applications:${NC} Deployed to Kubernetes"
        echo "   • Web App: http://web-app.videocopilot.local"
        echo "   • Embedding Service: http://embedding-service.videocopilot.local"
        echo "   • Intelligence Service: http://intelligence-service.videocopilot.local"
        echo "   • Video Processing Service: http://video-processing-service.videocopilot.local"
    fi
    
    if [[ $SKIP_JENKINS == false ]]; then
        echo -e "${GREEN}✅ CI/CD Pipeline:${NC} Jenkins deployed"
        echo "   • Jenkins: http://jenkins.videocopilot.local:8080"
        echo "   • Credentials: admin/admin123"
    fi
    
    if [[ $SKIP_MONITORING == false ]]; then
        echo -e "${GREEN}✅ Monitoring:${NC} Prometheus & Grafana deployed"
        echo "   • Prometheus: http://prometheus.videocopilot.local:9090"
        echo "   • Grafana: http://grafana.videocopilot.local:3000"
        echo "   • Grafana Credentials: admin/admin123"
    fi
    
    echo
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Update DNS records to point domains to LoadBalancer IPs"
    echo "2. Configure SSL certificates for production"
    echo "3. Update default passwords for security"
    echo "4. Set up backup strategies for persistent data"
    echo "5. Configure monitoring alerts"
    echo
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "• Infrastructure: ./infrastructure/README.md"
    echo "• Kubernetes: ./k8s/README.md"
    echo "• Jenkins: ./jenkins/README.md"
    echo "• Monitoring: ./monitoring/README.md"
}

# Main execution function
main() {
    parse_args "$@"
    
    print_banner
    
    if [[ $DRY_RUN == true ]]; then
        print_warning "DRY RUN MODE - No actual changes will be made"
        echo
    fi
    
    # Execute deployment steps
    check_prerequisites
    deploy_terraform
    deploy_ansible
    deploy_kubernetes
    deploy_jenkins
    deploy_monitoring
    validate_deployment
    
    # Show summary
    echo
    show_summary
    
    print_success "🎉 VideoCopilot deployment completed successfully!"
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"