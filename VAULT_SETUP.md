# 🔐 Ansible Vault Setup Guide for VideoCopilot

Ansible Vault encrypts sensitive data like API keys, database passwords, and other secrets. Here's how to set it up for your VideoCopilot deployment.

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)
```bash
cd ansible
./setup-vault.sh
```

### Option 2: Manual Setup
```bash
cd ansible
cp vault.yml.example vault.yml
# Edit vault.yml with your secrets
ansible-vault encrypt vault.yml
```

## 📋 Required Secrets

You'll need to obtain and configure these secrets in `vault.yml`:

### 1. **Database URL**
```yaml
database_url: "postgresql://videocopilot:your_password@postgres:5432/videocopilot?sslmode=require"
```
- Replace `your_password` with a strong database password
- This will be used by all services to connect to PostgreSQL

### 2. **Pinecone (Vector Database)**
```yaml
pinecone_api_key: "your_pinecone_api_key_here"
pinecone_index_name: "videocopilot-embeddings"
pinecone_environment: "gcp-starter"
```
- Sign up at [pinecone.io](https://pinecone.io)
- Create a new index for video embeddings
- Get your API key from the dashboard

### 3. **Groq (AI Inference)**
```yaml
groq_api_key: "your_groq_api_key_here"
```
- Sign up at [groq.com](https://groq.com)
- Create an API key for fast inference
- Used by the intelligence service for chat responses

### 4. **AWS S3 (File Storage)**
```yaml
aws_access_key_id: "your_aws_access_key_here"
aws_secret_access_key: "your_aws_secret_key_here"
aws_region: "us-east-1"
aws_s3_bucket: "videocopilot-storage-unique-name"
```
- Create an AWS account and S3 bucket
- Create IAM user with S3 permissions
- Get access key and secret key

### 5. **NextAuth (Authentication)**
```yaml
nextauth_secret: "your_nextauth_secret_here"
nextauth_url: "https://your-domain.com"
```
- Generate a random secret: `openssl rand -base64 32`
- Set your domain URL (or use localhost for development)

### 6. **Additional Secrets**
```yaml
jwt_secret: "your_jwt_secret_here"
encryption_key: "your_encryption_key_here"
```
- Generate random secrets for JWT signing and encryption
- Use: `openssl rand -base64 32` for each

## 🔧 Usage Commands

### Encrypt the vault file
```bash
ansible-vault encrypt vault.yml
```

### Edit encrypted vault
```bash
ansible-vault edit vault.yml
```

### View encrypted vault
```bash
ansible-vault view vault.yml
```

### Change vault password
```bash
ansible-vault rekey vault.yml
```

### Decrypt vault (not recommended)
```bash
ansible-vault decrypt vault.yml
```

## 🗝️ Password Management

### Option 1: Enter password each time (Most Secure)
```bash
# Deploy will prompt for vault password
./deploy.sh
```

### Option 2: Use password file (Convenient)
```bash
# Create password file
echo "your_vault_password" > ansible/.vault_pass
chmod 600 ansible/.vault_pass

# Deploy without password prompt
./deploy.sh
```

## 🔒 Security Best Practices

### ✅ Do This:
- **Use strong, unique passwords** for all secrets
- **Encrypt vault.yml** before committing to git
- **Keep vault password secure** and don't share it
- **Use different secrets** for dev/staging/prod environments
- **Rotate secrets regularly** (quarterly recommended)
- **Add .vault_pass to .gitignore** if using password files

### ❌ Don't Do This:
- **Never commit unencrypted secrets** to version control
- **Don't use weak passwords** or default values
- **Don't share vault passwords** via insecure channels
- **Don't use production secrets** in development
- **Don't store vault passwords** in the same repo

## 🧪 Testing Your Setup

### 1. Verify vault is encrypted
```bash
cd ansible
file vault.yml
# Should show: "vault.yml: data" (not "ASCII text")
```

### 2. Test decryption
```bash
ansible-vault view vault.yml
# Should prompt for password and show decrypted content
```

### 3. Test deployment
```bash
./deploy.sh
# Should use vault secrets during Ansible playbook execution
```

## 🔍 Troubleshooting

### Vault file not encrypted
```bash
ERROR: vault.yml is not encrypted!
```
**Solution:**
```bash
cd ansible
ansible-vault encrypt vault.yml
```

### Wrong vault password
```bash
ERROR! Decryption failed
```
**Solution:**
- Check you're using the correct password
- Try: `ansible-vault view vault.yml` to verify

### Missing vault file
```bash
WARNING: vault.yml not found
```
**Solution:**
```bash
cd ansible
./setup-vault.sh
```

### Environment files not created
Check that vault variables are being used:
```bash
# SSH to your server
ssh root@YOUR_DROPLET_IP

# Check environment files
ls -la /opt/videocopilot/envs/
cat /opt/videocopilot/envs/web-app.env
```

## 📖 How It Works

1. **vault.yml** contains encrypted secrets
2. **Ansible playbook** reads vault during deployment
3. **Environment files** are created on the server with decrypted values
4. **Kubernetes secrets** reference these environment files
5. **Applications** use the secrets at runtime

## 🔄 Multiple Environments

For different environments (dev/staging/prod), create separate vault files:

```bash
# Development
cp vault.yml.example vault-dev.yml
ansible-vault encrypt vault-dev.yml

# Production  
cp vault.yml.example vault-prod.yml
ansible-vault encrypt vault-prod.yml

# Use specific vault in playbook
ansible-playbook playbook.yml --vault-password-file .vault_pass -e @vault-prod.yml
```

## 🆘 Emergency Access

If you lose your vault password:

1. **If you have backup of unencrypted vault:**
   ```bash
   cp vault.yml.backup vault.yml
   ansible-vault encrypt vault.yml
   ```

2. **If you only have encrypted vault:**
   - You'll need to recreate all secrets
   - Generate new API keys from service providers
   - Update vault.yml with new secrets

3. **Prevention:**
   - Keep vault password in secure password manager
   - Maintain encrypted backup of vault file
   - Document secret sources for recovery

---

**Remember**: The vault system ensures your sensitive data is encrypted at rest and in transit, but it's only as secure as your vault password and secret management practices! 🔐