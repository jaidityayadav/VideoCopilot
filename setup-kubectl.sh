#!/bin/bash

# Script to set up kubectl connectivity to your k3s cluster
# This script will copy the kubeconfig from your remote k3s cluster

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
    echo "Please install kubectl first:"
    echo "  brew install kubectl"
    exit 1
fi

# Create .kube directory if it doesn't exist
mkdir -p "$HOME/.kube"

# Backup existing kubeconfig if it exists
if [ -f "$KUBECONFIG_PATH" ]; then
    echo -e "${YELLOW}📋 Backing up existing kubeconfig to $BACKUP_PATH${NC}"
    cp "$KUBECONFIG_PATH" "$BACKUP_PATH"
fi

echo -e "${YELLOW}🔗 Copying kubeconfig from k3s cluster...${NC}"
echo "Droplet IP: $DROPLET_IP"

# Copy kubeconfig from the remote k3s cluster
# k3s stores its config at /etc/rancher/k3s/k3s.yaml
scp -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP:/etc/rancher/k3s/k3s.yaml" "$KUBECONFIG_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Kubeconfig copied successfully${NC}"
else
    echo -e "${RED}❌ Failed to copy kubeconfig${NC}"
    echo "Make sure:"
    echo "  1. You can SSH to $DROPLET_IP"
    echo "  2. k3s is installed and running on the droplet"
    echo "  3. The kubeconfig file exists at /etc/rancher/k3s/k3s.yaml"
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
    echo "This might be because:"
    echo "  1. k3s is not running on the droplet"
    echo "  2. Firewall is blocking port 6443"
    echo "  3. The kubeconfig is not properly configured"
    
    echo -e "${YELLOW}💡 Troubleshooting commands:${NC}"
    echo "  # Check if k3s is running on droplet:"
    echo "  ssh root@$DROPLET_IP 'systemctl status k3s'"
    echo
    echo "  # Check k3s logs:"
    echo "  ssh root@$DROPLET_IP 'journalctl -u k3s -f'"
    echo
    echo "  # Check if port 6443 is listening:"
    echo "  ssh root@$DROPLET_IP 'netstat -tlnp | grep 6443'"
    
    exit 1
fi

echo -e "${GREEN}🎉 kubectl is now configured for your VideoCopilot k3s cluster!${NC}"
echo
echo "You can now run:"
echo "  kubectl get nodes"
echo "  kubectl get pods --all-namespaces"
echo "  ./deploy-k8s.sh secrets-only"