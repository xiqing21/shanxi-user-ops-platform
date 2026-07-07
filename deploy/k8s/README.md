# K8s Stage-Two Deployment

Docker Compose remains the first-stage runtime. These manifests are for Docker Desktop Kubernetes or kind validation.

Validate manifests:

```bash
kubectl kustomize deploy/k8s/overlays/docker-desktop
kubectl kustomize deploy/k8s/overlays/kind
```

Build local images before applying:

```bash
docker build -t shanxi-api:local -f apps/api/Dockerfile .
docker build -t shanxi-web:local -f apps/web/Dockerfile .
```
