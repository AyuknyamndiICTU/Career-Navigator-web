pipeline {
    agent any

    parameters {
        string(name: 'DOCKERHUB_USER', defaultValue: 'ayuknyamndiictu', description: 'Docker Hub namespace for the images')
        string(name: 'PROD_API_URL', defaultValue: 'https://api.yourdomain.com/api', description: 'Public API base URL baked into the web build (must end with /api)')
    }

    environment {
        // Username/password credential for Docker Hub
        DOCKER_CREDS = credentials('docker-hub-credentials')
        DOCKERHUB_USER = "${params.DOCKERHUB_USER}"

        API_IMAGE = "${params.DOCKERHUB_USER}/career-navigator-api"
        WEB_IMAGE = "${params.DOCKERHUB_USER}/career-navigator-web"
        TAG = "${env.BUILD_ID}"

        // Secret-text credential holding the SSH target, e.g. deploy@203.0.113.10 (a non-root user in the docker group)
        DEPLOY_TARGET = credentials('vps-deploy-target')
        DEPLOY_PATH = '/opt/career-navigator'
        PROD_API_URL = "${params.PROD_API_URL}"
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
            environment {
                // The e2e suites mock Postgres/Redis/storage; keep background workers off.
                CV_SCAN_ENABLED = 'false'
                NOTIFICATIONS_WORKER_ENABLED = 'false'
            }
            steps {
                echo "Running code linters..."
                sh 'npm run lint'

                echo "Type-checking..."
                sh 'npm exec -w api -- prisma generate'
                sh 'npm exec -w api -- tsc -p tsconfig.json --noEmit'
                sh 'npm run typecheck -w web-ui'

                echo "Running automated tests..."
                sh 'npm test'
                sh 'npm run test:e2e -w api -- --runInBand'
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
                        // Single-quoted so the shell (not Groovy) expands the credential-backed variables.
                        // The server keeps its secrets in ${DEPLOY_PATH}/.env (see infra/docker/.env.prod.example).
                        sh '''
                            ssh -o StrictHostKeyChecking=no "$DEPLOY_TARGET" "mkdir -p $DEPLOY_PATH"
                            scp -o StrictHostKeyChecking=no infra/docker/docker-compose.prod.yml "$DEPLOY_TARGET:$DEPLOY_PATH/docker-compose.yml"
                            ssh -o StrictHostKeyChecking=no "$DEPLOY_TARGET" "cd $DEPLOY_PATH && test -f .env && export DOCKERHUB_USER=$DOCKERHUB_USER TAG=$TAG && docker compose pull && docker compose up -d --remove-orphans"
                        '''
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
