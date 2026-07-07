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
