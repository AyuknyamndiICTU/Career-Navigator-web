# Docker (Career Navigator)

Both images build from the repository root (`docker build -f apps/api/Dockerfile .`) and contain no environment-specific settings.
The browser always talks to one origin: Caddy ([Caddyfile](Caddyfile)) sends `/api` and `/socket.io` to the API and everything else to the web app.

## Local stack

```sh
docker compose -f infra/docker/docker-compose.yml up -d --build --wait
```

- App: http://localhost:3010 (`WEB_HOST_PORT` in `infra/docker/.env`, default 3000)
- API docs: http://localhost:3001/api/docs (direct API port, localhost only)
- Postgres 5435, Redis 6382, MinIO 9000/9001 (localhost only)

## Production (single VPS)

[docker-compose.prod.yml](docker-compose.prod.yml) + [.env.prod.example](.env.prod.example). Caddy obtains HTTPS certificates for `SITE_ADDRESS`; only ports 80/443 are public.
Jenkins copies the compose file, the Caddyfile and [deploy.sh](deploy.sh) to the server and runs `TAG=<git-sha> sh deploy.sh`, which waits for `/api/health/ready` and rolls back to the previous tag if the release never becomes ready.
