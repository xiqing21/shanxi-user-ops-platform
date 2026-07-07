# Verification

Use pnpm for all Node commands.

## Automated Checks

```bash
pnpm test
pnpm typecheck
pnpm test:ai
pnpm --filter @shanxi/web build
docker compose -f deploy/compose/docker-compose.yml config
```

## Local Chrome Checks

Do not use Playwright. Open local Chrome and check:

- http://localhost:5050 renders the operations dashboard as the first screen.
- "大工业分析" tab shows industrial users.
- "AI 问数" tab shows SQL evidence and read-only SQL.
- "AI 建任务" tab returns a multi-step task plan.
- "模拟压测" tab generates users, readings, and risks.

## AI Integration

- Python AI is the primary Text-to-SQL and task-planning service. Node keeps the stable frontend-facing `/agent/plan` route and proxies the request to `AI_SERVICE_URL`.
- DeepSeek is configured through server-side environment variables only: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`.
- The committed `.env.example` documents the variables. The real `.env` file is ignored by Git.
- `/agent/plan` uses Python AI + DeepSeek JSON output when configured and falls back to the local planner when the provider is unavailable.
- The Docker stack starts Milvus Standalone with etcd and MinIO, then the Python AI service creates and searches the `shanxi_metadata_assets` collection.

## Current Boundaries

- Python batch/vector tooling now exists for metadata retrieval and task-plan generation.
- The current embedding model is deterministic hash embedding so tests and demos run without downloading a large model. Production should replace it with BGE-M3 or another enterprise embedding model.
- Milvus is available in Docker Compose. If Milvus is not reachable in local development, the Python service falls back to an in-memory vector index.
- Text-to-SQL is still a task-plan and SQL-draft workflow. It does not yet execute SQL against StarRocks/Flink SQL Gateway.
