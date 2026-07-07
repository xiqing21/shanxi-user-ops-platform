# Shanxi Full-User Real-Time Electricity Operations Platform

This repository contains the MVP for a Shanxi province full-user electricity operations platform. It demonstrates real-time operations, large industrial user analysis, Text-to-SQL, AI analysis task planning, deterministic data simulation, Docker Compose runtime, and a K8s-ready stage-two skeleton.

## Run Locally

```bash
pnpm start:local
```

Open:

- Frontend: http://localhost:5050
- API health: http://localhost:4000/health

Optional DeepSeek integration:

```bash
cp .env.example .env
# fill DEEPSEEK_API_KEY in .env
pnpm start:local
```

When `DEEPSEEK_API_KEY` is configured, `/agent/plan` calls DeepSeek from the API server. If DeepSeek is not configured or temporarily unavailable, the API falls back to the local rule planner so the demo remains usable.

## Docker Compose

```bash
docker compose -f deploy/compose/docker-compose.yml up --build
```

## Docs

- Product design: `doc/product_v2_design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-07-shanxi-user-ops-platform.md`
- Verification: `docs/verification.md`
