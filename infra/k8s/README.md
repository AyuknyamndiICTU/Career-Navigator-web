# Kubernetes manifests (Career Navigator)

Kustomize layout: `base/` holds everything shared; `overlays/dev` and `overlays/prod` set the namespace, domain, image tags and secrets.

| Base resource | Notes |
|---|---|
| `api-deployment.yaml` + `api-hpa.yaml` | 2–5 replicas (CPU 70 %), probes on `/api/health/{live,ready}`, non-root |
| `api-migrate-job.yaml` | `prisma migrate deploy`, run before each rollout |
| `web-deployment.yaml` | standalone Next server; no API URL baked in |
| `postgres.yaml` | StatefulSet + 10 Gi PVC; remove for a managed database |
| `redis-statefulset.yaml` | AOF on a 2 Gi PVC, `noeviction` (BullMQ); remove for managed Redis |
| `ingress.yaml` | one host: `/api` and `/socket.io` → API, `/` → web; TLS via cert-manager |
| `networkpolicy.yaml` | only API pods reach Postgres/Redis |

Prerequisites: ingress-nginx, cert-manager with ClusterIssuers `letsencrypt` (prod) and `letsencrypt-staging` (dev), metrics-server (for the HPA), a default StorageClass. Object storage is external (MinIO-compatible endpoint; Cloudflare R2 after Phase 18).

## First setup

```sh
cd infra/k8s/overlays/prod
cp api-secrets.env.example api-secrets.env   # git-ignored; fill in
cp postgres.env.example postgres.env         # password must match DATABASE_URL
# edit kustomization.yaml: registry names, domain, CORS_ALLOWED_ORIGINS
```

Databases created earlier with `prisma db push` need a one-time baseline:
`kubectl -n career-navigator run baseline --rm -it --restart=Never --image=<api-image:tag> --env=DATABASE_URL=... -- npx prisma migrate resolve --applied 0_init --schema prisma/schema.prisma`

## Release (image tag = git SHA)

```sh
cd infra/k8s/overlays/prod
kustomize edit set image cn-api=docker.io/<ns>/career-navigator-api:$SHA cn-web=docker.io/<ns>/career-navigator-web:$SHA
kubectl -n career-navigator delete job cn-api-migrate --ignore-not-found   # Job specs are immutable
kubectl apply -k .
kubectl -n career-navigator wait --for=condition=complete job/cn-api-migrate --timeout=300s
kubectl -n career-navigator rollout status deploy/cn-api --timeout=300s
kubectl -n career-navigator rollout status deploy/cn-web --timeout=300s
# Roll back: kubectl -n career-navigator rollout undo deploy/cn-api (and deploy/cn-web)
```

Render without applying: `kubectl kustomize overlays/prod`.

Socket.IO uses WebSocket-only transport and the Redis adapter, so API replicas need no sticky sessions.
