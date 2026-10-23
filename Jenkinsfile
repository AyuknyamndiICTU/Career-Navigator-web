// CI/CD: lint → typecheck → tests → images tagged with the git SHA → deploy → health check → automatic rollback.
// Jenkins credentials (no hosts, users or registries in this file):
//   docker-hub-credentials  username/password; the username is also the image namespace
//   vps-deploy-target       secret text, e.g. deploy@203.0.113.10 (a non-root user in the docker group)
//   vps-ssh-key             SSH private key for that user (SSH Agent plugin)
// The agent needs Docker (BuildKit) and the Node major in .nvmrc.
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        DOCKER_CREDS = credentials('docker-hub-credentials')
        DEPLOY_TARGET = credentials('vps-deploy-target')
        DEPLOY_PATH = '/opt/career-navigator'
        DOCKER_BUILDKIT = '1'
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.TAG = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                    env.API_IMAGE = "${env.DOCKER_CREDS_USR}/career-navigator-api"
                    env.MIGRATE_IMAGE = "${env.DOCKER_CREDS_USR}/career-navigator-migrate"
                    env.WEB_IMAGE = "${env.DOCKER_CREDS_USR}/career-navigator-web"
                }
                sh '''
                    required="$(cat .nvmrc)"
                    actual="$(node -p 'process.versions.node.split(".")[0]')"
                    if [ "$actual" != "$required" ]; then
                        echo "Node $required is required (the agent has $(node -v))." >&2
                        exit 1
                    fi
                '''
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci --no-audit --no-fund'
                sh 'npm exec -w api -- prisma generate'
            }
        }

        stage('Lint') {
            steps {
                // No --fix in CI: lint must fail on problems instead of rewriting files.
                sh 'npm exec -w api -- eslint "{src,apps,libs,test}/**/*.ts"'
                sh 'npm run lint -w web-ui'
            }
        }

        stage('Typecheck') {
            steps {
                sh 'npm run typecheck'
                // The committed web API types must match the API's routes and DTOs.
                sh 'npm run api:openapi && git diff --exit-code -- apps/web/web-ui/src/lib/api/schema.d.ts'
            }
        }

        stage('Test') {
            environment {
                // The e2e suites mock Postgres/Redis/storage; keep background workers off.
                CV_SCAN_ENABLED = 'false'
                NOTIFICATIONS_WORKER_ENABLED = 'false'
            }
            steps {
                sh 'npm test'
                sh 'npm run test:e2e -w api -- --runInBand'
                // Storage contract: the real S3 client against a throwaway Garage node (same image as docker compose).
                sh '''
                    set -eu
                    name="cn-ci-garage-${BUILD_NUMBER}"
                    trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
                    docker run -d --name "$name" -p 127.0.0.1::3900 \
                      -v "$WORKSPACE/infra/docker/garage.toml:/etc/garage.toml:ro" \
                      -e GARAGE_DEFAULT_ACCESS_KEY=GK1c0de0de0c0ffee000000001 \
                      -e GARAGE_DEFAULT_SECRET_KEY=6c6f63616c2d6465762d6761726167652d7365637265742d6368616e67652d6d \
                      -e GARAGE_DEFAULT_BUCKET=career-navigator \
                      dxflrs/garage:v2.4.1 /garage server --single-node --default-bucket
                    port=$(docker port "$name" 3900/tcp | head -n1 | sed 's/.*://')
                    for i in $(seq 1 30); do docker exec "$name" /garage status >/dev/null 2>&1 && break; sleep 1; done
                    S3_CONTRACT_ENDPOINT="http://127.0.0.1:$port" npm run test:e2e -w api -- --runInBand storage-contract
                '''
            }
        }

        stage('Build images') {
            steps {
                // BuildKit keeps layer and npm caches on this agent between builds.
                sh 'docker build -t "$API_IMAGE:$TAG" -f apps/api/Dockerfile .'
                sh 'docker build -t "$MIGRATE_IMAGE:$TAG" --target migrate -f apps/api/Dockerfile .'
                sh 'docker build -t "$WEB_IMAGE:$TAG" -f apps/web/web-ui/Dockerfile .'
            }
        }

        stage('Push') {
            steps {
                sh 'echo "$DOCKER_CREDS_PSW" | docker login -u "$DOCKER_CREDS_USR" --password-stdin'
                sh 'docker push "$API_IMAGE:$TAG"'
                sh 'docker push "$MIGRATE_IMAGE:$TAG"'
                sh 'docker push "$WEB_IMAGE:$TAG"'
            }
        }

        stage('Deploy') {
            // Multibranch jobs deploy only main; a single-branch pipeline job (no BRANCH_NAME) always deploys.
            when { expression { env.BRANCH_NAME == null || env.BRANCH_NAME == 'main' } }
            steps {
                sshagent(['vps-ssh-key']) {
                    // deploy.sh starts the release, waits for /api/health/ready and rolls back to the previous tag on failure.
                    sh '''
                        SSH_OPTS="-o StrictHostKeyChecking=accept-new"
                        ssh $SSH_OPTS "$DEPLOY_TARGET" "mkdir -p $DEPLOY_PATH"
                        scp $SSH_OPTS infra/docker/docker-compose.prod.yml "$DEPLOY_TARGET:$DEPLOY_PATH/docker-compose.yml"
                        scp $SSH_OPTS infra/docker/Caddyfile infra/docker/deploy.sh infra/docker/migrate-storage.sh "$DEPLOY_TARGET:$DEPLOY_PATH/"
                        ssh $SSH_OPTS "$DEPLOY_TARGET" "cd $DEPLOY_PATH && TAG=$TAG DOCKERHUB_USER=$DOCKER_CREDS_USR sh deploy.sh"
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
            cleanWs()
        }
        success {
            echo "Pipeline succeeded for ${env.TAG}."
        }
        failure {
            echo 'Pipeline failed; see the stage logs. A failed deploy has already been rolled back by deploy.sh.'
        }
    }
}

