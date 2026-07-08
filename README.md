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

Core Docker stack with Python AI and Milvus:

```bash
pnpm stack:up
```

Open:

- Frontend: http://localhost:5051
- API health: http://localhost:4000/health
- Python AI health: http://localhost:8000/health
- Milvus gRPC: localhost:19530
- MinIO console: http://localhost:19001

Lakehouse full stack:

```bash
./scripts/start-full-stack.sh
```

This starts the core stack plus:

- Flink JobManager UI: http://localhost:8083
- Fluss Coordinator: localhost:9123
- Fluss Tablet: localhost:9124
- Paimon warehouse: `s3://fluss/paimon` on MinIO
- StarRocks FE HTTP: http://localhost:8030
- StarRocks MySQL protocol: localhost:9030
- PostgreSQL CDC source: localhost:5432

The script waits for Flink JobManager and API readiness, then submits a real Flink streaming health job automatically. You should see at least one `RUNNING` job in http://localhost:8083 and in the Web app's runtime topology page.

The full stack mounts Flink/Fluss/Paimon/StarRocks connector jars from `LAKEHOUSE_LIB_DIR`. By default this points to the local reference bundle:

```bash
LAKEHOUSE_LIB_DIR=../../example/reference_blueprint/flink22_lib
```

The jar bundle is intentionally not committed into the app source because it is hundreds of MB; keep it local or point the variable at your own dependency directory.

The startup script runs Docker Compose in detached mode. Milvus periodically prints INFO lines such as `balance wait`; those are normal internal balancing heartbeats, not errors. To inspect logs only when needed:

```bash
pnpm stack:logs milvus
pnpm stack:logs flink-jobmanager
pnpm stack:ps
```

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
- Product prototype storyboard: `doc/product_storyboard_prototype.md`
- Full image storyboard prompts: `doc/full_storyboard_image_prompts.md`
- Implementation plan: `docs/superpowers/plans/2026-07-07-shanxi-user-ops-platform.md`
- Verification: `docs/verification.md`
