# Password Authentication Setup for VideoCopilot

The Terraform configuration has been updated to use password authentication instead of SSH keys for connecting to the DigitalOcean droplet.

## Changes Made

### 1. Terraform Configuration (`infrastructure/main.tf`)
- ✅ Removed `digitalocean_ssh_key` resource
- ✅ Removed SSH key references from droplet configuration
- ✅ Updated cloud-init to use templating for password injection
- ✅ Removed SSH-based provisioner

### 2. Variables (`infrastructure/variables.tf`)
- ✅ Replaced `ssh_public_key_path` and `ssh_private_key_path` variables
- ✅ Added `root_password` variable with validation (minimum 8 characters)

### 3. Cloud-Init Configuration (`infrastructure/cloud-init.yml`)
- ✅ Added password configuration for root user
- ✅ Enabled SSH password authentication
- ✅ Added SSH configuration to allow password login
- ✅ Added password for videocopilot user as well

### 4. Ansible Configuration
- ✅ Updated inventory template to use password authentication
- ✅ Added proper SSH connection parameters
- ✅ Updated deploy script to extract password from terraform.tfvars

### 5. Deployment Script (`deploy.sh`)
- ✅ Updated terraform.tfvars template to use password instead of SSH keys
- ✅ Modified Ansible inventory creation to use password authentication

## How to Use

### 1. Configure Your Password
Edit `infrastructure/terraform.tfvars`:
```hcl
# DigitalOcean Configuration
do_token = "your_digitalocean_api_token_here"
region = "nyc1"

# Authentication Configuration
# Use a strong password (minimum 8 characters)
root_password = "YourSecurePassword123!"

# Project Configuration
project_name = "videocopilot"
environment = "dev"
```

### 2. Deploy Infrastructure
```bash
# Deploy with password authentication
./deploy.sh

# Or step by step
./deploy.sh --dry-run              # Preview deployment
./deploy.sh                        # Deploy infrastructure
./deploy.sh --include-k8s          # Also deploy applications
```

### 3. Connect to Your Droplet
After deployment, you can SSH to your droplet using the password:
```bash
# Get the droplet IP from Terraform output
cd infrastructure
terraform output droplet_ip

# SSH with password
ssh root@YOUR_DROPLET_IP
# Enter the password you set in terraform.tfvars
```

### 4. Ansible Will Use Password Authentication
The Ansible playbook will automatically use the password from your terraform.tfvars file:
```bash
# Ansible inventory will be automatically created with password auth
# No need for SSH keys or additional configuration
```

## Security Considerations

### ✅ Advantages
- **Simpler Setup**: No need to manage SSH key pairs
- **Quick Access**: Direct password login for troubleshooting
- **No Key Management**: No risk of losing or corrupting SSH keys

### ⚠️ Security Notes
- **Use Strong Passwords**: Minimum 8 characters with mix of letters, numbers, symbols
- **Keep Passwords Secure**: Store terraform.tfvars securely, don't commit to git
- **Consider Key-Based Auth for Production**: For production environments, SSH keys are generally more secure
- **Enable Fail2Ban**: Consider enabling fail2ban on the server to prevent brute force attacks

## Migration from SSH Keys

If you previously used SSH keys and want to switch to password authentication:

1. **Backup Current Setup**:
   ```bash
   cp infrastructure/terraform.tfvars infrastructure/terraform.tfvars.backup
   cp infrastructure/main.tf infrastructure/main.tf.backup
   ```

2. **Update Configuration**: Follow the steps above to set up password authentication

3. **Destroy and Recreate** (if needed):
   ```bash
   cd infrastructure
   terraform destroy  # Remove old droplet with SSH keys
   terraform apply    # Create new droplet with password auth
   ```

## Troubleshooting

### Connection Issues
```bash
# Test SSH connection manually
ssh root@YOUR_DROPLET_IP
# If prompted for password, enter the one from terraform.tfvars

# Test Ansible connection
cd ansible
ansible all -i inventory.ini -m ping
```

### Password Authentication Not Working
1. Check cloud-init logs on the droplet:
   ```bash
   ssh root@YOUR_DROPLET_IP
   sudo tail -f /var/log/cloud-init-output.log
   ```

2. Verify SSH configuration:
   ```bash
   sudo cat /etc/ssh/sshd_config.d/99-videocopilot.conf
   ```

3. Restart SSH service if needed:
   ```bash
   sudo systemctl restart sshd
   ```

The infrastructure is now configured for password-based authentication, making it easier to set up and manage while maintaining security through strong password requirements.