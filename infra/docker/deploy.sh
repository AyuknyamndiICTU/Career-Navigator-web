#!/bin/sh
# Runs on the server in the deploy directory (next to docker-compose.yml and .env), invoked by the Jenkins deploy stage:
#   TAG=<git-sha> DOCKERHUB_USER=<namespace> sh deploy.sh
# Starts the new images and rolls back to the previously deployed tag when the API doesn't become ready.
# Migrations only move forward, so they must stay backward compatible with the previous release (expand, then contract).
set -eu

: "${TAG:?TAG (image tag) is required}"
: "${DOCKERHUB_USER:?DOCKERHUB_USER is required}"
export TAG DOCKERHUB_USER
test -f .env || { echo ".env is missing; create it from .env.prod.example" >&2; exit 1; }

PREVIOUS=$(cat .deployed-tag 2>/dev/null || true)

ready() {
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    if curl -fsS --max-time 5 http://127.0.0.1:3001/api/health/ready >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 5
  done
  return 1
}

docker compose pull
if docker compose up -d --remove-orphans && ready; then
  echo "$TAG" > .deployed-tag
  docker image prune -f >/dev/null
  echo "Deployed $TAG"
  exit 0
fi

echo "Release $TAG did not become ready." >&2
docker compose logs --tail=50 api migrate >&2 || true
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$TAG" ]; then
  echo "Rolling back to $PREVIOUS" >&2
  TAG="$PREVIOUS" docker compose up -d --remove-orphans
  if TAG="$PREVIOUS" ready; then
    echo "Rolled back to $PREVIOUS" >&2
  else
    echo "Rollback to $PREVIOUS is not ready either; manual action needed." >&2
  fi
fi
exit 1
