# Shanxi Full-User Real-Time Electricity Operations Platform

This repository contains the MVP for a Shanxi province full-user electricity operations platform. It demonstrates real-time operations, large industrial user analysis, Text-to-SQL, AI analysis task planning, deterministic data simulation, Docker Compose runtime, and a K8s-ready stage-two skeleton.

## Run Locally

```bash
pnpm install
pnpm --filter @shanxi/simulator generate
pnpm dev
```

Open:

- Frontend: http://localhost:5050
- API health: http://localhost:4000/health

## Docker Compose

```bash
docker compose -f deploy/compose/docker-compose.yml up --build
```

## Docs

- Product design: `doc/product_v2_design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-07-shanxi-user-ops-platform.md`
- Verification: `docs/verification.md`
