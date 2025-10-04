#!/bin/bash

# Script to build Docker images locally and load them into k3s
# This allows k3s to use locally built images without a registry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DROPLET_IP="143.244.137.118"
DROPLET_USER="root"

echo -e "${GREEN}🐳 Building and Loading Images to k3s Cluster${NC}"
echo "=================================================="

# Services to build
services=("web-app" "embedding-service" "intelligence-service" "video-processing-service")

# Build images locally
echo -e "${YELLOW}🔨 Building Docker images locally...${NC}"
for service in "${services[@]}"; do
    echo -e "${YELLOW}Building $service...${NC}"
    
    if [ -d "./$service" ]; then
        # Build with correct tag expected by k8s manifests
        docker build -t "videocopilot/$service:latest" "./$service/"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $service built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build $service${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Directory ./$service not found${NC}"
        exit 1
    fi
done

echo -e "${YELLOW}💾 Saving images to tar files...${NC}"
for service in "${services[@]}"; do
    echo -e "${YELLOW}Saving $service...${NC}"
    docker save "videocopilot/$service:latest" > "/tmp/$service.tar"
    echo -e "${GREEN}✅ $service saved${NC}"
done

echo -e "${YELLOW}📤 Transferring images to k3s cluster...${NC}"
for service in "${services[@]}"; do
    echo -e "${YELLOW}Transferring $service...${NC}"
    scp -o StrictHostKeyChecking=no "/tmp/$service.tar" "$DROPLET_USER@$DROPLET_IP:/tmp/"
    
    echo -e "${YELLOW}Loading $service into k3s...${NC}"
    ssh -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "k3s ctr images import /tmp/$service.tar && rm /tmp/$service.tar"
    
    # Clean up local tar file
    rm "/tmp/$service.tar"
    
    echo -e "${GREEN}✅ $service loaded into k3s${NC}"
done

echo -e "${YELLOW}🔍 Verifying images in k3s...${NC}"
ssh -o StrictHostKeyChecking=no "$DROPLET_USER@$DROPLET_IP" "k3s ctr images list | grep videocopilot"

echo -e "${GREEN}🎉 All images successfully loaded into k3s cluster!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy services: ./deploy-k8s.sh deploy"
echo "  2. Check pods: kubectl get pods -n videocopilot"