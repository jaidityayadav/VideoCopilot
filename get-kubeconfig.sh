#!/bin/bash

# Script to get kubeconfig from your k3s cluster
# This will configure kubectl to connect to your remote k3s cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DROPLET_IP="143.244.137.118"
DROPLET_USER="root"
KUBECONFIG_PATH="$HOME/.kube/config"
BACKUP_PATH="$HOME/.kube/config.backup.$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}🔧 Setting up kubectl for VideoCopilot k3s cluster${NC}"
echo "========================================================"

# Check if kubectl exists
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    echo "Installing kubectl..."
    if command -v brew &> /dev/null; then
        brew install kubectl
    else
        echo "Please install kubectl manually:"
        echo "  https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/"
        exit 1
    fi
fi

echo -e "${GREEN}✅ kubectl found${NC}"

# Create .kube directory if it doesn't exist
mkdir -p "$HOME/.kube"

# Backup existing kubeconfig if it exists
if [ -f "$KUBECONFIG_PATH" ]; then
    echo -e "${YELLOW}📋 Backing up existing kubeconfig to $BACKUP_PATH${NC}"
    cp "$KUBECONFIG_PATH" "$BACKUP_PATH"
fi

echo -e "${YELLOW}🔗 Getting kubeconfig from k3s cluster...${NC}"
echo "Droplet IP: $DROPLET_IP"

# First, check if we can connect to the server
echo -e "${YELLOW}🔍 Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${RED}❌ Cannot SSH to $DROPLET_IP${NC}"
    echo "Please check:"
    echo "  1. The droplet is running"
    echo "  2. SSH key is configured or you have the password"
    echo "  3. The IP address is correct"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection successful${NC}"

# Check if k3s is installed and running
echo -e "${YELLOW}🔍 Checking k3s status...${NC}"
if ! ssh -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "systemctl is-active k3s" >/dev/null 2>&1; then
    echo -e "${RED}❌ k3s is not running on the server${NC}"
    echo "Running Ansible playbook to set up k3s..."
    cd ansible
    if [ -f "vault.yml" ]; then
        ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass
    else
        echo -e "${RED}❌ vault.yml not found. Please run ansible setup first${NC}"
        exit 1
    fi
    cd ..
else
    echo -e "${GREEN}✅ k3s is running${NC}"
fi

# Copy kubeconfig from the remote k3s cluster
echo -e "${YELLOW}📥 Copying kubeconfig...${NC}"
scp -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP:/etc/rancher/k3s/k3s.yaml" "$KUBECONFIG_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Kubeconfig copied successfully${NC}"
else
    echo -e "${RED}❌ Failed to copy kubeconfig${NC}"
    exit 1
fi

# Update the server IP in the kubeconfig
echo -e "${YELLOW}🔧 Updating server IP in kubeconfig...${NC}"
sed -i.bak "s/127.0.0.1/$DROPLET_IP/g" "$KUBECONFIG_PATH"

# Set proper permissions
chmod 600 "$KUBECONFIG_PATH"

echo -e "${YELLOW}🧪 Testing kubectl connectivity...${NC}"
if kubectl cluster-info --request-timeout=10s >/dev/null 2>&1; then
    echo -e "${GREEN}✅ kubectl connectivity successful!${NC}"
    echo
    echo "Cluster info:"
    kubectl cluster-info
    echo
    echo "Nodes:"
    kubectl get nodes
else
    echo -e "${RED}❌ kubectl connectivity failed${NC}"
    echo
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo "  # Check k3s status on server:"
    echo "  ssh root@$DROPLET_IP 'systemctl status k3s'"
    echo
    echo "  # Check k3s logs:"
    echo "  ssh root@$DROPLET_IP 'journalctl -u k3s -n 50'"
    exit 1
fi

echo -e "${GREEN}🎉 kubectl is now configured for your VideoCopilot k3s cluster!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy secrets: ./deploy-k8s.sh secrets-only"
echo "  2. Deploy application: ./deploy-k8s.sh deploy"
echo "  3. Check status: kubectl get pods --all-namespaces"