pipeline {
    agent {
        kubernetes {
            yaml """
                apiVersion: v1
                kind: Pod
                spec:
                  containers:
                  - name: kubectl
                    image: bitnami/kubectl:latest
                    command:
                    - cat
                    tty: true
                  - name: curl
                    image: curlimages/curl:latest
                    command:
                    - cat
                    tty: true
            """
        }
    }
    
    environment {
        REGISTRY = 'ghcr.io'
        IMAGE_NAME = "${env.GITHUB_REPOSITORY ?: 'jaidityayadav/VideoCopilot'}"
        NAMESPACE = 'videocopilot'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_HASH = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.BRANCH_NAME = env.BRANCH_NAME ?: 'main'
                }
            }
        }
        
        stage('Update Image Tags') {
            steps {
                container('kubectl') {
                    script {
                        def services = [
                            'videocopilot-embedding': 'embedding-service',
                            'videocopilot-intelligence': 'intelligence-service', 
                            'videocopilot-video-processing': 'video-processing-service',
                            'videocopilot-web-app': 'web-app'
                        ]
                        
                        services.each { deployment, service ->
                            def imageTag = "${env.BRANCH_NAME}-${env.GIT_COMMIT_HASH}"
                            
                            sh """
                                kubectl set image deployment/${deployment} \
                                    ${service}=${REGISTRY}/${IMAGE_NAME}/${service}:${imageTag} \
                                    -n ${NAMESPACE} || echo "Deployment ${deployment} not found, will deploy from manifest"
                            """
                        }
                    }
                }
            }
        }
        
        stage('Deploy/Update Manifests') {
            steps {
                container('kubectl') {
                    script {
                        // Apply manifests in order
                        def manifests = [
                            'k8s/02-embedding-service.yaml',
                            'k8s/03-intelligence-service.yaml',
                            'k8s/04-video-processing-service.yaml',
                            'k8s/05-web-app.yaml'
                        ]
                        
                        manifests.each { manifest ->
                            sh """
                                kubectl apply -f ${manifest} -n ${NAMESPACE}
                            """
                        }
                    }
                }
            }
        }
        
        stage('Wait for Rollout') {
            steps {
                container('kubectl') {
                    script {
                        def deployments = [
                            'videocopilot-embedding',
                            'videocopilot-intelligence',
                            'videocopilot-video-processing',
                            'videocopilot-web-app'
                        ]
                        
                        deployments.each { deployment ->
                            sh """
                                kubectl rollout status deployment/${deployment} \
                                    -n ${NAMESPACE} \
                                    --timeout=600s
                            """
                        }
                    }
                }
            }
        }
        
        stage('Health Checks') {
            steps {
                container('curl') {
                    script {
                        def services = [
                            'videocopilot-embedding': '8001',
                            'videocopilot-intelligence': '8002', 
                            'videocopilot-video-processing': '8000'
                        ]
                        
                        services.each { service, port ->
                            sh """
                                echo "🔍 Checking health of ${service}:${port}"
                                timeout 60 sh -c 'until curl -f http://${service}.${NAMESPACE}.svc.cluster.local:${port}/health; do sleep 5; done'
                            """
                        }
                        
                        // Check web app
                        sh """
                            echo "🔍 Checking web app health"
                            timeout 60 sh -c 'until curl -f http://videocopilot-web-app.${NAMESPACE}.svc.cluster.local:3000/api/health; do sleep 5; done'
                        """
                    }
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                container('kubectl') {
                    sh """
                        echo "📋 Current deployment status:"
                        kubectl get pods -n ${NAMESPACE}
                        echo ""
                        kubectl get services -n ${NAMESPACE}
                        echo ""
                        echo "🌐 Application accessible at: http://143.244.137.118:30000"
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo '✅ Deployment successful! 🎉'
            echo '🌐 Application: http://143.244.137.118:30000'
            echo '🔧 Jenkins: http://143.244.137.118:32000'
        }
        failure {
            echo '❌ Deployment failed! 💥'
            container('kubectl') {
                sh """
                    echo "📋 Recent events:"
                    kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp' | tail -20
                    echo ""
                    echo "📋 Pod status:"
                    kubectl describe pods -n ${NAMESPACE} | grep -A 5 -B 5 "Error\\|Failed\\|Pending"
                """
            }
        }
        always {
            cleanWs()
        }
    }
}