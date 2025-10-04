#!/bin/bash

# Ansible Vault Setup Guide for VideoCopilot
# This script helps you set up encrypted secrets management

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 VideoCopilot Ansible Vault Setup${NC}"
echo "===================================="
echo

# Check if we're in the ansible directory
if [[ ! -f "vault.yml.example" ]]; then
    echo -e "${RED}Error: Please run this script from the ansible/ directory${NC}"
    exit 1
fi

# Step 1: Create vault.yml from example
if [[ ! -f "vault.yml" ]]; then
    echo -e "${YELLOW}📝 Creating vault.yml from example...${NC}"
    cp vault.yml.example vault.yml
    echo -e "${GREEN}✅ vault.yml created${NC}"
else
    echo -e "${YELLOW}⚠️  vault.yml already exists${NC}"
fi

# Step 2: Guide user through editing secrets
echo
echo -e "${BLUE}📋 You need to edit vault.yml with your actual secrets:${NC}"
echo
echo "1. Database URL - PostgreSQL connection string"
echo "2. Pinecone API Key - For vector embeddings (get from pinecone.io)"
echo "3. Groq API Key - For AI inference (get from groq.com)"
echo "4. AWS Credentials - For S3 storage (get from AWS console)"
echo "5. NextAuth Secret - For authentication (generate random string)"
echo "6. JWT Secret - For token signing (generate random string)"
echo

read -p "Do you want to edit vault.yml now? (y/n): " edit_now

if [[ $edit_now == "y" || $edit_now == "Y" ]]; then
    # Open editor
    if command -v code &> /dev/null; then
        code vault.yml
    elif command -v nano &> /dev/null; then
        nano vault.yml
    elif command -v vim &> /dev/null; then
        vim vault.yml
    else
        echo -e "${YELLOW}Please edit vault.yml manually with your preferred editor${NC}"
    fi
fi

# Step 3: Encrypt the vault file
echo
echo -e "${BLUE}🔒 Ready to encrypt vault.yml?${NC}"
echo "This will require you to set a vault password."
echo "Remember this password - you'll need it for deployments!"
echo

read -p "Encrypt vault.yml now? (y/n): " encrypt_now

if [[ $encrypt_now == "y" || $encrypt_now == "Y" ]]; then
    ansible-vault encrypt vault.yml
    echo -e "${GREEN}✅ vault.yml encrypted successfully${NC}"
    echo
    echo -e "${YELLOW}💡 To edit encrypted file later:${NC}"
    echo "   ansible-vault edit vault.yml"
    echo
    echo -e "${YELLOW}💡 To view encrypted file:${NC}"
    echo "   ansible-vault view vault.yml"
fi

# Step 4: Create vault password file (optional)
echo
echo -e "${BLUE}🗝️  Optional: Create vault password file${NC}"
echo "This lets you avoid typing the password each time (less secure but convenient)"
echo

read -p "Create .vault_pass file? (y/n): " create_pass_file

if [[ $create_pass_file == "y" || $create_pass_file == "Y" ]]; then
    read -s -p "Enter vault password: " vault_password
    echo
    echo "$vault_password" > .vault_pass
    chmod 600 .vault_pass
    echo -e "${GREEN}✅ .vault_pass created (remember to add to .gitignore)${NC}"
    
    # Add to .gitignore
    if [[ ! -f "../.gitignore" ]]; then
        touch ../.gitignore
    fi
    
    if ! grep -q ".vault_pass" ../.gitignore; then
        echo "ansible/.vault_pass" >> ../.gitignore
        echo -e "${GREEN}✅ Added .vault_pass to .gitignore${NC}"
    fi
fi

echo
echo -e "${GREEN}🎉 Ansible Vault setup complete!${NC}"
echo
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Update vault.yml with your actual API keys and secrets"
echo "2. Test decryption: ansible-vault view vault.yml"
echo "3. Run deployment with: ../deploy.sh"
echo
echo -e "${YELLOW}⚠️  Security reminders:${NC}"
echo "• Never commit unencrypted secrets to git"
echo "• Keep your vault password secure"
echo "• Use strong, unique API keys"
echo "• Rotate secrets regularly"