# Shanxi Full-User Real-Time Electricity Operations Platform

This repository contains the MVP for a Shanxi province full-user electricity operations platform. It demonstrates real-time operations, large industrial user analysis, Text-to-SQL, Python AI task planning, deterministic data simulation, Milvus-backed metadata retrieval, Docker Compose runtime, and a K8s-ready stage-two skeleton.

## Architecture

- `apps/web`: React + shadcn-style UI, charts, simulator and AI task pages.
- `apps/api`: Fastify BFF. The frontend only talks to this API.
- `services/ai`: Python FastAPI service for Text-to-SQL planning, DeepSeek calls, metadata vector retrieval, and future offline evaluation.
- `deploy/compose`: Docker Compose stack with Web, API, Python AI, Milvus, etcd, and MinIO.

## Run Locally

Node-only local demo:

```bash
pnpm start:local
```

Open:

- Frontend: http://localhost:5050
- API health: http://localhost:4000/health

Full Docker stack with Python AI and Milvus:

```bash
pnpm stack:up
```

Open:

- Frontend: http://localhost:5051
- API health: http://localhost:4000/health
- Python AI health: http://localhost:8000/health
- Milvus gRPC: localhost:19530
- MinIO console: http://localhost:19001

Optional DeepSeek integration:

```bash
cp .env.example .env
# fill DEEPSEEK_API_KEY in .env
pnpm stack:up
```

When `DEEPSEEK_API_KEY` is configured, `/agent/plan` goes through the Python AI service, retrieves candidate metadata assets from Milvus, and calls DeepSeek for a structured task plan. If DeepSeek or the Python service is unavailable, the Node API falls back to the local rule planner so the demo remains usable.

## Docker Compose

```bash
pnpm stack:up
```

Stop the stack:

```bash
pnpm stack:down
```

Run Python AI tests:

```bash
pnpm test:ai
```

## Docs

- Product design: `doc/product_v2_design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-07-shanxi-user-ops-platform.md`
- Verification: `docs/verification.md`
