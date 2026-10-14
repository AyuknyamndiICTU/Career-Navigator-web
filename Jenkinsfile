pipeline {
    agent any

    environment {
        // Docker Hub Configuration
        // Make sure to add this credentials ID in your Jenkins server (Username with password)
        DOCKER_CREDS = credentials('docker-hub-credentials') 
        DOCKERHUB_USER = 'ayuknyamndiictu' // Replace with your Docker Hub username
        
        // Image Names & Tags
        API_IMAGE = "${DOCKERHUB_USER}/career-navigator-api"
        WEB_IMAGE = "${DOCKERHUB_USER}/career-navigator-web"
        TAG = "${env.BUILD_ID}"
        
        // Deployment details
        // Define 'vps-ssh-key' as an SSH Username with Private Key credential in Jenkins
        DEPLOY_HOST = 'ssh root@38.242.246.126' // Replace with your VPS SSH connection string
        DEPLOY_PATH = '/opt/career-navigator'
        
        // Frontend Build Args (Replace with your actual production domains)
        PROD_API_URL = 'https://api.yourdomain.com'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                // Install all packages in the monorepo
                sh 'npm install'
            }
        }

        stage('Lint & Test') {
            steps {
                echo "Running code linters..."
                sh 'npm run lint'
                
                // echo "Running automated tests..."
                // sh 'npm run test' // Uncomment when tests are set up
            }
        }

        stage('Build Applications') {
            steps {
                echo "Building API and Web UI code..."
                sh 'npm run build'
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    echo "Building API Image..."
                    sh "docker build -t ${API_IMAGE}:${TAG} -t ${API_IMAGE}:latest -f apps/api/Dockerfile ."
                    
                    echo "Building Web UI Image..."
                    // We pass NEXT_PUBLIC_API_BASE_URL as a build-arg since Next.js burns public env vars into the static HTML at build time
                    sh "docker build -t ${WEB_IMAGE}:${TAG} -t ${WEB_IMAGE}:latest --build-arg NEXT_PUBLIC_API_BASE_URL=${PROD_API_URL} -f apps/web/web-ui/Dockerfile ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    echo "Logging into Docker Hub..."
                    sh "echo \$DOCKER_CREDS_PSW | docker login -u \$DOCKER_CREDS_USR --password-stdin"
                    
                    echo "Pushing API Image..."
                    sh "docker push ${API_IMAGE}:${TAG}"
                    sh "docker push ${API_IMAGE}:latest"
                    
                    echo "Pushing Web UI Image..."
                    sh "docker push ${WEB_IMAGE}:${TAG}"
                    sh "docker push ${WEB_IMAGE}:latest"
                }
            }
        }

        stage('Deploy to VPS') {
            steps {
                script {
                    echo "Deploying to Remote VPS..."
                    // The SSH Agent plugin is required for this block to authenticate automatically
                    sshagent(['vps-ssh-key']) {
                        // Ensure the deployment directory exists
                        sh "ssh -o StrictHostKeyChecking=no ${DEPLOY_HOST} 'mkdir -p ${DEPLOY_PATH}'"
                        
                        // Copy the production docker-compose file to the VPS
                        sh "scp -o StrictHostKeyChecking=no infra/docker/docker-compose.prod.yml ${DEPLOY_HOST}:${DEPLOY_PATH}/docker-compose.yml"
                        
                        // Execute deployment commands on the remote VPS
                        sh """
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_HOST} '
                            cd ${DEPLOY_PATH} &&
                            export DOCKERHUB_USER=${DOCKERHUB_USER} &&
                            export TAG=${TAG} &&
                            docker compose pull &&
                            docker compose up -d --remove-orphans
                        '
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Clean up Docker login and workspace to maintain agent hygiene
            sh "docker logout"
            cleanWs()
        }
        success {
            echo "✅ Pipeline completed successfully! New version deployed to VPS."
        }
        failure {
            echo "❌ Pipeline failed! Please check the Jenkins logs."
        }
    }
}
