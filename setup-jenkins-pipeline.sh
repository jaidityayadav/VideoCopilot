#!/bin/bash

# Jenkins Pipeline Configuration Script
# This script helps configure Jenkins for automated CI/CD with your VideoCopilot project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Jenkins Pipeline Configuration for VideoCopilot${NC}"
echo "====================================================="

# Configuration
JENKINS_URL="http://143.244.137.118:32000"
NAMESPACE="videocopilot"
GITHUB_REPO="jaidityayadav/VideoCopilot"

echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo "Jenkins URL: $JENKINS_URL"
echo "Kubernetes Namespace: $NAMESPACE"
echo "GitHub Repository: $GITHUB_REPO"
echo ""

# Step 1: Create kubeconfig secret for Jenkins
echo -e "${YELLOW}Step 1: Creating kubeconfig secret for Jenkins...${NC}"

# Get current kubeconfig
KUBECONFIG_CONTENT=$(cat ~/.kube/config | base64 | tr -d '\n')

# Create secret in jenkins namespace
kubectl create secret generic kubeconfig \
    --from-file=config=$HOME/.kube/config \
    -n jenkins \
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✅ Kubeconfig secret created${NC}"

# Step 2: Update Jenkinsfile
echo -e "${YELLOW}Step 2: Updating Jenkinsfile...${NC}"

# Backup original and replace with updated version
cp jenkins/Jenkinsfile jenkins/Jenkinsfile.backup
cp jenkins/Jenkinsfile-updated jenkins/Jenkinsfile

echo -e "${GREEN}✅ Jenkinsfile updated${NC}"

# Step 3: Create GitHub webhook configuration
echo -e "${YELLOW}Step 3: GitHub Webhook Configuration${NC}"

cat << EOF

🔗 To enable automatic deployment when GitHub Actions completes:

1. Go to GitHub: https://github.com/${GITHUB_REPO}/settings/hooks
2. Click "Add webhook"
3. Configure:
   - Payload URL: ${JENKINS_URL}/github-webhook/
   - Content type: application/json
   - Secret: (leave empty for now)
   - Events: Select "Push" and "Pull requests"
   - Active: ✅ Checked

4. Click "Add webhook"

EOF

# Step 4: Jenkins Pipeline Job Creation
echo -e "${YELLOW}Step 4: Jenkins Pipeline Job Setup${NC}"

cat << EOF

📝 Create Jenkins Pipeline Job:

1. Open Jenkins: ${JENKINS_URL}
2. Click "New Item"
3. Enter name: "VideoCopilot-Deploy"
4. Select "Pipeline" and click OK
5. Configure Pipeline:
   - Definition: "Pipeline script from SCM"
   - SCM: Git
   - Repository URL: https://github.com/${GITHUB_REPO}.git
   - Branch: */review2
   - Script Path: jenkins/Jenkinsfile
6. Under "Build Triggers":
   - ✅ GitHub hook trigger for GITScm polling
   - ✅ Trigger builds remotely (optional)
7. Click "Save"

EOF

# Step 5: Test the pipeline
echo -e "${YELLOW}Step 5: Testing Pipeline${NC}"

cat << EOF

🧪 To test the pipeline:

1. Manual Test:
   - Go to Jenkins → VideoCopilot-Deploy → "Build with Parameters"
   - Select Deploy Target: "all"
   - Image Tag: "latest" (or specific commit hash)
   - Click "Build"

2. Automatic Test:
   - Push a commit to your repository
   - GitHub Actions will build images
   - Jenkins webhook should trigger deployment automatically

EOF

# Step 6: Monitoring and Access URLs
echo -e "${YELLOW}Step 6: Access URLs After Deployment${NC}"

cat << EOF

🌐 After successful deployment, access your application:

• Web App: http://143.244.137.118:30000
• Jenkins: ${JENKINS_URL}
• Prometheus: http://143.244.137.118:30090
• Grafana: http://143.244.137.118:31000 (admin/admin123)

📊 Monitoring:
- All services will be monitored by Prometheus
- Grafana dashboards will show application metrics
- Jenkins will handle deployments and rollbacks

EOF

# Step 7: Pipeline Features
echo -e "${YELLOW}Step 7: Pipeline Features${NC}"

cat << EOF

🚀 Your CI/CD Pipeline Features:

✅ Automated Deployments:
  - GitHub push → GitHub Actions build → Jenkins deploy

✅ Flexible Deployment Options:
  - Deploy all services
  - Deploy individual services
  - Deploy monitoring only

✅ Health Checks:
  - Kubernetes rollout verification
  - Service health endpoint checks
  - Comprehensive status reporting

✅ Rollback Capability:
  - Deploy specific image tags
  - Quick rollback to previous versions

✅ Monitoring Integration:
  - Prometheus metrics collection
  - Grafana visualization
  - Alert system ready

EOF

echo -e "${GREEN}🎉 Jenkins Pipeline Configuration Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Set up GitHub webhook (see instructions above)"
echo "2. Create Jenkins pipeline job (see instructions above)"
echo "3. Test the pipeline with a manual build"
echo "4. Push a commit to test automatic deployment"
echo ""
echo -e "${YELLOW}Need help? Check the Jenkins logs or pipeline console output.${NC}"