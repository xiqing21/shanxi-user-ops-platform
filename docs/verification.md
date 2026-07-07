# Verification

Use pnpm for all Node commands.

## Automated Checks

```bash
pnpm test
pnpm typecheck
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

- DeepSeek is configured through server-side environment variables only: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`.
- The committed `.env.example` documents the variables. The real `.env` file is ignored by Git.
- `/agent/plan` uses DeepSeek JSON output when configured and falls back to the local planner when the key is missing or the provider is unavailable.

## Current Boundaries

- Python batch/vector tooling is not implemented yet.
- Milvus/LanceDB vector retrieval is a stage-two target, not part of the current runnable MVP.
- Text-to-SQL is currently a DeepSeek-backed task-plan and SQL-draft workflow with local fallback, not a full metadata-vector-retrieval execution chain.
