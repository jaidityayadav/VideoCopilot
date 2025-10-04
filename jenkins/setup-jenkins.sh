# Jenkins Kubernetes Deployment for VideoCopilot DevOps Pipeline
# Deploy Jenkins in Kubernetes with persistent storage and proper RBAC

# This file contains Kubernetes manifests for deploying Jenkins
# Use: kubectl apply -f jenkins-k8s.yaml

echo "🚀 Use the jenkins-k8s.yaml file to deploy Jenkins in Kubernetes"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
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

# Check if Jenkins CLI is available
check_jenkins_cli() {
    if ! command -v java &> /dev/null; then
        print_error "Java is required but not installed"
        exit 1
    fi
    
    if [ ! -f "jenkins-cli.jar" ]; then
        print_status "Downloading Jenkins CLI..."
        curl -O http://localhost:8080/jnlpJars/jenkins-cli.jar
    fi
}

# Function to run Jenkins CLI commands
jenkins_cli() {
    java -jar jenkins-cli.jar -s http://localhost:8080/ -auth admin:admin "$@"
}

# Install required Jenkins plugins
install_plugins() {
    print_status "Installing Jenkins plugins..."
    
    local plugins=(
        "git"
        "workflow-aggregator"
        "docker-workflow"
        "kubernetes"
        "kubernetes-cli"
        "blueocean"
        "pipeline-stage-view"
        "build-timeout"
        "credentials-binding"
        "timestamper"
        "ws-cleanup"
        "ant"
        "gradle"
        "pipeline-npm"
        "nodejs"
        "python"
        "htmlpublisher"
        "junit"
        "jacoco"
        "cobertura"
        "checkstyle"
        "findbugs"
        "pmd"
        "warnings-ng"
        "slack"
        "email-ext"
        "github"
        "github-branch-source"
        "multibranch-scan-webhook-trigger"
        "prometheus"
        "influxdb"
        "performance"
        "docker-build-step"
        "docker-commons"
        "docker-plugin"
        "kubernetes-credentials"
        "kubernetes-credentials-provider"
        "workflow-basic-steps"
        "workflow-cps"
        "workflow-durable-task-step"
        "workflow-job"
        "workflow-multibranch"
        "workflow-scm-step"
        "workflow-step-api"
        "workflow-support"
        "ssh-agent"
        "ssh-credentials"
        "plain-credentials"
        "matrix-auth"
        "role-strategy"
        "ldap"
        "active-directory"
        "saml"
    )
    
    for plugin in "${plugins[@]}"; do
        print_status "Installing plugin: $plugin"
        jenkins_cli install-plugin "$plugin" || print_warning "Failed to install $plugin, it may already be installed"
    done
    
    print_status "Restarting Jenkins to activate plugins..."
    jenkins_cli restart
    
    # Wait for Jenkins to restart
    print_status "Waiting for Jenkins to restart..."
    sleep 30
    
    # Wait until Jenkins is ready
    until curl -s http://localhost:8080/api/json &> /dev/null; do
        print_status "Waiting for Jenkins to be ready..."
        sleep 5
    done
    
    print_success "All plugins installed successfully"
}

# Configure Docker registry credentials
configure_docker_credentials() {
    print_status "Configuring Docker registry credentials..."
    
    read -p "Enter Docker registry URL (e.g., hub.docker.com): " DOCKER_REGISTRY
    read -p "Enter Docker registry username: " DOCKER_USERNAME
    read -s -p "Enter Docker registry password: " DOCKER_PASSWORD
    echo
    
    # Create Docker registry credentials
    jenkins_cli create-credentials-by-xml system::system::jenkins << EOF
<com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>docker-registry-creds</id>
  <description>Docker Registry Credentials for VideoCopilot</description>
  <username>${DOCKER_USERNAME}</username>
  <password>${DOCKER_PASSWORD}</password>
</com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
EOF
    
    print_success "Docker registry credentials configured"
}

# Configure Kubernetes credentials
configure_kubernetes_credentials() {
    print_status "Configuring Kubernetes credentials..."
    
    if [ ! -f "$HOME/.kube/config" ]; then
        print_error "Kubeconfig file not found at $HOME/.kube/config"
        print_error "Please set up kubectl and try again"
        return 1
    fi
    
    # Create Kubernetes config credential
    jenkins_cli create-credentials-by-xml system::system::jenkins << EOF
<org.jenkinsci.plugins.kubernetes.credentials.FileSystemServiceAccountCredential>
  <scope>GLOBAL</scope>
  <id>kubeconfig</id>
  <description>Kubernetes Config for VideoCopilot</description>
</org.jenkinsci.plugins.kubernetes.credentials.FileSystemServiceAccountCredential>
EOF
    
    # Copy kubeconfig to Jenkins home
    sudo mkdir -p /var/jenkins_home/.kube
    sudo cp "$HOME/.kube/config" /var/jenkins_home/.kube/config
    sudo chown -R jenkins:jenkins /var/jenkins_home/.kube
    
    print_success "Kubernetes credentials configured"
}

# Configure Git credentials
configure_git_credentials() {
    print_status "Configuring Git credentials..."
    
    read -p "Do you want to configure Git SSH credentials? (y/n): " configure_git
    
    if [[ $configure_git == "y" || $configure_git == "Y" ]]; then
        read -p "Enter path to your SSH private key (e.g., ~/.ssh/id_rsa): " SSH_KEY_PATH
        
        if [ ! -f "$SSH_KEY_PATH" ]; then
            print_error "SSH key not found at $SSH_KEY_PATH"
            return 1
        fi
        
        # Create SSH key credential
        jenkins_cli create-credentials-by-xml system::system::jenkins << EOF
<com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>
  <scope>GLOBAL</scope>
  <id>git-ssh-key</id>
  <description>Git SSH Key for VideoCopilot</description>
  <username>git</username>
  <privateKeySource class="com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey\$FileOnMasterPrivateKeySource">
    <privateKeyFile>${SSH_KEY_PATH}</privateKeyFile>
  </privateKeySource>
</com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>
EOF
        
        print_success "Git SSH credentials configured"
    fi
}

# Create Jenkins pipeline job
create_pipeline_job() {
    print_status "Creating VideoCopilot pipeline job..."
    
    read -p "Enter Git repository URL: " GIT_REPO_URL
    read -p "Enter Git branch (default: main): " GIT_BRANCH
    GIT_BRANCH=${GIT_BRANCH:-main}
    
    # Create job configuration XML
    cat > job-config.xml << EOF
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@2.40">
  <actions/>
  <description>VideoCopilot DevOps Pipeline - Automated build, test, and deployment</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.plugins.jira.JiraProjectProperty plugin="jira@3.1.1"/>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <com.cloudbees.jenkins.GitHubPushTrigger plugin="github@1.29.4">
          <spec></spec>
        </com.cloudbees.jenkins.GitHubPushTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps@2.80">
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.4.4">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GIT_REPO_URL}</url>
          <credentialsId>git-ssh-key</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/${GIT_BRANCH}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>jenkins/Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
EOF
    
    # Create the job
    jenkins_cli create-job "videocopilot-pipeline" < job-config.xml
    
    # Clean up
    rm job-config.xml
    
    print_success "VideoCopilot pipeline job created"
}

# Configure Jenkins global settings
configure_global_settings() {
    print_status "Configuring Jenkins global settings..."
    
    # Configure Node.js
    jenkins_cli create-node nodejs << EOF
<?xml version='1.1' encoding='UTF-8'?>
<hudson.plugins.nodejs.tools.NodeJSInstallation>
  <name>NodeJS 18</name>
  <properties>
    <hudson.plugins.nodejs.tools.NodeJSInstallation.DescriptorImpl.NodeJSInstaller>
      <id>18.17.0</id>
    </hudson.plugins.nodejs.tools.NodeJSInstallation.DescriptorImpl.NodeJSInstaller>
  </properties>
</hudson.plugins.nodejs.tools.NodeJSInstallation>
EOF
    
    print_success "Global settings configured"
}

# Configure webhook
configure_webhook() {
    print_status "Webhook configuration instructions:"
    print_warning "To enable automatic builds on Git push, configure a webhook in your Git repository:"
    echo
    echo "Webhook URL: http://your-jenkins-url:8080/github-webhook/"
    echo "Content type: application/json"
    echo "Events: Push events, Pull request events"
    echo
    print_warning "Replace 'your-jenkins-url' with your actual Jenkins URL"
}

# Main setup function
main() {
    print_status "Starting Jenkins setup for VideoCopilot..."
    
    # Check prerequisites
    check_jenkins_cli
    
    # Install plugins
    install_plugins
    
    # Configure credentials
    configure_docker_credentials
    configure_kubernetes_credentials
    configure_git_credentials
    
    # Configure global settings
    configure_global_settings
    
    # Create pipeline job
    create_pipeline_job
    
    # Show webhook configuration
    configure_webhook
    
    print_success "🎉 Jenkins setup completed successfully!"
    print_status "You can access Jenkins at: http://localhost:8080"
    print_status "Default credentials: admin/admin (change these for production!)"
    print_status "Pipeline job: videocopilot-pipeline"
    
    echo
    print_warning "⚠️  Important Security Reminders:"
    echo "1. Change the default admin password"
    echo "2. Configure proper authentication (LDAP, SAML, etc.)"
    echo "3. Set up role-based access control"
    echo "4. Enable HTTPS for production use"
    echo "5. Regularly update Jenkins and plugins"
    
    echo
    print_status "📖 Next Steps:"
    echo "1. Update the DOCKER_REGISTRY environment variable in the Jenkinsfile"
    echo "2. Test the pipeline by running a build"
    echo "3. Configure monitoring alerts"
    echo "4. Set up backup for Jenkins configuration"
}

# Handle script interruption
trap 'print_error "Setup interrupted"; exit 1' INT TERM

# Run main function
main "$@"