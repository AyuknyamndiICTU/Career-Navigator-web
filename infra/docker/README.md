# Docker (Career Navigator)

Both images build from the repository root (`docker build -f apps/api/Dockerfile .`) and contain no environment-specific settings.
The browser always talks to one origin: Caddy ([Caddyfile](Caddyfile)) sends `/api` and `/socket.io` to the API and everything else to the web app.

## Local stack

```sh
docker compose -f infra/docker/docker-compose.yml up -d --build --wait
```

- App: http://localhost:3010 (`WEB_HOST_PORT` in `infra/docker/.env`, default 3000)
- API docs: http://localhost:3001/api/docs (direct API port, localhost only)
- Postgres 5435, Redis 6382, Garage S3 3900 (localhost only)

## Production (single VPS)

[docker-compose.prod.yml](docker-compose.prod.yml) + [.env.prod.example](.env.prod.example). Caddy obtains HTTPS certificates for `SITE_ADDRESS`; only ports 80/443 are public.
Jenkins copies the compose file, the Caddyfile and [deploy.sh](deploy.sh) to the server and runs `TAG=<git-sha> sh deploy.sh`, which waits for `/api/health/ready` and rolls back to the previous tag if the release never becomes ready.

### One-time switch from MinIO to Cloudflare R2 (Phase 18)

Do this before the first deploy that contains Phase 18. That deploy removes the `minio` container (its `cn-minio` volume is kept), and the previous release cannot run on the new compose file, so a rollback across this release won't bring MinIO back.

1. **Cloudflare dashboard → R2**
   - Create bucket `career-navigator`: automatic location, **no** public access, **no** custom domain.
   - Go to *Manage API tokens* → *Create API token*. Permission: **Object Read & Write**, applied to **this bucket only**. No expiry, or put a renewal in your calendar.
   - Copy the Access Key ID, the Secret Access Key (shown once) and the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
   - No CORS rules are needed: the app only shows files through `<img>` tags and download links.
2. **Server `.env`:** add the values below and keep the `MINIO_*` lines until the copy is verified. Don't set `S3_PUBLIC_ENDPOINT`: R2 presigned URLs only work on the `r2.cloudflarestorage.com` domain, which is `S3_ENDPOINT` itself.
   ```sh
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_BUCKET=career-navigator
   S3_REGION=auto
   ```
3. **Copy the files.** Run this on the server in the deploy directory while the old release is still running. Jenkins only copies the script during a deploy, so the first time copy it by hand: `scp infra/docker/migrate-storage.sh <user>@<vps>:<deploy-path>/`.
   ```sh
   val() { sed -n "s/^$1=//p" .env | tail -n1; }
   export OLD_ENDPOINT=http://minio:9000 OLD_ACCESS_KEY="$(val MINIO_ROOT_USER)" OLD_SECRET_KEY="$(val MINIO_ROOT_PASSWORD)"
   export OLD_BUCKET="$(val MINIO_BUCKET)"; [ -n "$OLD_BUCKET" ] || OLD_BUCKET=resumes
   export NEW_ENDPOINT="$(val S3_ENDPOINT)" NEW_ACCESS_KEY="$(val S3_ACCESS_KEY_ID)" NEW_SECRET_KEY="$(val S3_SECRET_ACCESS_KEY)"
   export NEW_BUCKET=career-navigator NEW_REGION=auto NEW_PROVIDER=Cloudflare
   export NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$(docker compose ps -q minio)")"
   DRY_RUN=1 sh migrate-storage.sh   # lists what would be copied, changes nothing
   sh migrate-storage.sh             # copy, then compare counts and MD5 checksums
   ```
   It must end with `0 differences found` and `Copy verified`. `val` reads `.env` literally, so values must be unquoted, as in `.env.prod.example`. Run it once more just before deploying (with the same shell variables), to pick up uploads made in the meantime. Only new files are copied.
4. **Deploy** through Jenkins as usual.
5. **Check:**
   - `curl -s http://127.0.0.1:3001/api/health/ready` shows `"storage":"up"`.
   - In the app, an existing profile photo still shows, and its URL points at `r2.cloudflarestorage.com`.
   - Uploading a new CV works.
6. **Clean up after a few days** (irreversible): remove the `MINIO_*` lines from `.env`, then run `docker volume rm <project>_cn-minio`.
