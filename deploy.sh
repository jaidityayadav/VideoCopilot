#!/bin/bash

# Deploy script for VideoCopilot infrastructure and configuration
# This script deploys the EC2 instance and configures it with Ansible

set -e

echo "🚀 Starting VideoCopilot deployment..."

# Check if required tools are installed
command -v terraform >/dev/null 2>&1 || { echo "❌ terraform is required but not installed. Aborting." >&2; exit 1; }
command -v ansible >/dev/null 2>&1 || { echo "❌ ansible is required but not installed. Aborting." >&2; exit 1; }

# Check if SSH key exists
if [ ! -f ~/.ssh/devops.pem ]; then
    echo "❌ SSH key ~/.ssh/devops.pem not found. Please ensure your AWS key pair is available."
    exit 1
fi

# Set correct permissions on SSH key
chmod 600 ~/.ssh/devops.pem
echo "✅ SSH key permissions set"

# Deploy infrastructure with Terraform
echo "📦 Deploying infrastructure with Terraform..."
cd infrastructure

if [ ! -f ".terraform/terraform.tfstate" ]; then
    echo "Initializing Terraform..."
    terraform init
fi

echo "Planning Terraform deployment..."
terraform plan

read -p "Do you want to apply the Terraform configuration? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    terraform apply -auto-approve
    echo "✅ Infrastructure deployed successfully"
else
    echo "❌ Deployment cancelled"
    exit 1
fi

# Get the public IP
PUBLIC_IP=$(terraform output -raw instance_public_ip)
echo "📍 Server IP: $PUBLIC_IP"

# Wait for instance to be ready
echo "⏳ Waiting for instance to be ready..."
sleep 60

# Update Ansible inventory with the actual IP
cd ../ansible
cp inventory.yml inventory.yml.backup
sed "s/{{ instance_public_ip }}/$PUBLIC_IP/" inventory.yml.backup > inventory.yml

# Test connectivity
echo "🔍 Testing connectivity..."
max_attempts=5
attempt=1

while [ $attempt -le $max_attempts ]; do
    if ansible all -m ping > /dev/null 2>&1; then
        echo "✅ Connection successful"
        break
    else
        echo "Attempt $attempt failed, retrying in 30 seconds..."
        sleep 30
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Could not connect to server after $max_attempts attempts"
    exit 1
fi

# Run Ansible playbook
echo "⚙️  Configuring server with Ansible..."
ansible-playbook playbooks/main.yml

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Connection details:"
echo "   IP Address: $PUBLIC_IP"
echo "   SSH Command: ssh -i ~/.ssh/devops.pem ec2-user@$PUBLIC_IP"
echo ""
echo "🛠️  Installed tools:"
echo "   - System updates and essential utilities"
echo "   - Python3, pip, and Node.js LTS"
echo "   - Docker, kubectl, and Helm"
echo ""
echo "You can now SSH into your server and start deploying your VideoCopilot services!"