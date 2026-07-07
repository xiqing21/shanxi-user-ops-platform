# Shanxi User Ops Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP for the Shanxi province full-user real-time electricity operations platform, including a shadcn-style frontend, API service, deterministic simulator, Text-to-SQL/AI task-planning prototype, Docker Compose path, and a stage-two K8s-ready deployment skeleton.

**Architecture:** Use a pnpm monorepo with a React/Vite frontend, Fastify API, shared domain package, simulator package, and agent package. The first implementation uses deterministic mock data and file-backed fixtures so the product can run immediately, then adds Docker Compose and K8s-ready manifests around the same service boundaries.

**Tech Stack:** pnpm, TypeScript, React, Vite, Tailwind CSS, shadcn/ui-style local components, Radix Slot, class-variance-authority, tailwind-merge, Recharts, Fastify, Vitest, Zod, Docker Compose, Docker Desktop Kubernetes/kind manifests.

## Global Constraints

- Use `pnpm`, not `npm`.
- Do not use Playwright; browser checks use local Chrome or manual verification.
- First-stage deployment path is Docker Compose.
- Second-stage deployment path is Docker Desktop Kubernetes/kind, without replacing Docker Compose.
- Text-to-SQL must be read-only and must display SQL evidence before execution.
- AI task creation must not auto-publish production jobs in MVP; it produces a reviewed task plan and generated SQL.
- Milvus is the online vector retrieval target; LanceDB/Lance is the AI asset/versioned data layer target.
- Coal-to-electricity is only a user/scenario tag, not the product's primary business scope.

---

## File Structure

Create this structure:

```text
apps/
  api/
    package.json
    src/
      index.ts
      routes/
        agent.ts
        health.ts
        operations.ts
        simulator.ts
      services/
        fixture-store.ts
        sql-guard.ts
    test/
      sql-guard.test.ts
      operations-routes.test.ts
  web/
    package.json
    index.html
    components.json
    postcss.config.js
    tailwind.config.ts
    src/
      App.tsx
      main.tsx
      styles.css
      components/
        MetricCard.tsx
        RiskQueue.tsx
        Shell.tsx
        charts/
          LoadTrendChart.tsx
        ui/
          badge.tsx
          button.tsx
          card.tsx
          input.tsx
          scroll-area.tsx
          table.tsx
          tabs.tsx
          textarea.tsx
      pages/
        AgentTaskPage.tsx
        DashboardPage.tsx
        IndustrialPage.tsx
        SimulatorPage.tsx
        TextToSqlPage.tsx
      lib/
        api.ts
        cn.ts
        format.ts
    vite.config.ts
packages/
  agent/
    package.json
    src/
      planner.ts
      retrieval.ts
      task-plan.ts
    test/
      planner.test.ts
  domain/
    package.json
    src/
      metrics.ts
      schema.ts
      types.ts
    test/
      metrics.test.ts
  simulator/
    package.json
    src/
      generator.ts
      scenarios.ts
      write-fixtures.ts
    test/
      generator.test.ts
data/
  fixtures/
    shanxi-snapshot.json
deploy/
  compose/
    docker-compose.yml
  k8s/
    base/
      api-deployment.yaml
      frontend-deployment.yaml
      simulator-cronjob.yaml
    overlays/
      docker-desktop/kustomization.yaml
      kind/kustomization.yaml
docs/
  superpowers/
    plans/
      2026-07-07-shanxi-user-ops-platform.md
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
```

Responsibilities:

- `packages/domain`: shared data schemas, typed models, and metric calculations.
- `packages/simulator`: deterministic Shanxi user/load/anomaly fixture generation.
- `packages/agent`: ReAct/Plan-style task planning and retrieval scoring prototype.
- `apps/api`: REST API over fixtures, SQL safety guard, agent endpoints.
- `apps/web`: shadcn/ui-style product UI for dashboard, big industry analysis, Text-to-SQL, AI task creation, simulation, and Recharts-based operational charts.
- `deploy/compose`: first-stage local runtime.
- `deploy/k8s`: second-stage Docker Desktop Kubernetes/kind skeleton.

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/simulator/package.json`
- Create: `packages/agent/package.json`

**Interfaces:**
- Produces: workspace scripts `pnpm test`, `pnpm typecheck`, `pnpm dev`, `pnpm build`
- Produces: shared TypeScript config consumed by all packages

- [ ] **Step 1: Create root package metadata**

Create `package.json`:

```json
{
  "name": "guowang-realtime",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --parallel --filter @shanxi/api --filter @shanxi/web dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: Create workspace definition**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@shanxi/domain": ["packages/domain/src/index.ts"],
      "@shanxi/simulator": ["packages/simulator/src/index.ts"],
      "@shanxi/agent": ["packages/agent/src/index.ts"]
    }
  }
}
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"]
  }
});
```

- [ ] **Step 5: Create package manifests**

Create `packages/domain/package.json`:

```json
{
  "name": "@shanxi/domain",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

Create `packages/simulator/package.json`:

```json
{
  "name": "@shanxi/simulator",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json",
    "generate": "tsx src/write-fixtures.ts"
  },
  "dependencies": {
    "@shanxi/domain": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Create `packages/agent/package.json`:

```json
{
  "name": "@shanxi/agent",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@shanxi/domain": "workspace:*",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

Create `apps/api/package.json`:

```json
{
  "name": "@shanxi/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "@shanxi/agent": "workspace:*",
    "@shanxi/domain": "workspace:*",
    "@shanxi/simulator": "workspace:*",
    "fastify": "^5.2.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Create `apps/web/package.json`:

```json
{
  "name": "@shanxi/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5050",
    "build": "tsc -p tsconfig.json && vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@radix-ui/react-slot": "^1.1.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "vite": "^6.0.3"
  },
  "devDependencies": {
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile created and no `npm` commands used.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts apps packages
git commit -m "chore: scaffold pnpm workspace"
```

---

### Task 2: Domain Types And Metric Calculations

**Files:**
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/types.ts`
- Create: `packages/domain/src/schema.ts`
- Create: `packages/domain/src/metrics.ts`
- Create: `packages/domain/test/metrics.test.ts`

**Interfaces:**
- Produces: `calculateLoadRate(activePowerKw: number, contractCapacityKva: number, powerFactor?: number): number`
- Produces: `classifyLoadRate(rate: number): "light" | "normal" | "heavy" | "overload"`
- Produces: `calculateUnbalance(currents: { a: number; b: number; c: number }): number`
- Produces: `UserProfile`, `TelemetryReading`, `RiskEvent`, `OperationsSnapshot`

- [ ] **Step 1: Write failing metric tests**

Create `packages/domain/test/metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateLoadRate, calculateUnbalance, classifyLoadRate } from "../src/index";

describe("domain metrics", () => {
  it("calculates load rate using active power, capacity, and power factor", () => {
    expect(calculateLoadRate(720, 1000, 0.9)).toBe(80);
  });

  it("classifies load rate bands", () => {
    expect(classifyLoadRate(19.9)).toBe("light");
    expect(classifyLoadRate(80)).toBe("normal");
    expect(classifyLoadRate(95)).toBe("heavy");
    expect(classifyLoadRate(100.1)).toBe("overload");
  });

  it("calculates three-phase current unbalance", () => {
    expect(calculateUnbalance({ a: 100, b: 90, c: 70 })).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/domain/test/metrics.test.ts
```

Expected: FAIL because `packages/domain/src/index.ts` does not exist.

- [ ] **Step 3: Implement domain package**

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

Create `packages/domain/src/types.ts`:

```ts
export type UserType =
  | "residential"
  | "general_commercial"
  | "large_industrial"
  | "high_energy"
  | "agriculture"
  | "charging_station"
  | "distributed_pv";

export type RiskLevel = "normal" | "watch" | "warning" | "critical";
export type LoadBand = "light" | "normal" | "heavy" | "overload";

export interface UserProfile {
  userId: string;
  userName: string;
  city: string;
  county: string;
  industry: string;
  userType: UserType;
  contractCapacityKva: number;
  transformerId: string;
  lineId: string;
  tags: string[];
}

export interface TelemetryReading {
  readingId: string;
  userId: string;
  meterId: string;
  timestamp: string;
  activePowerKw: number;
  voltageA: number;
  voltageB: number;
  voltageC: number;
  currentA: number;
  currentB: number;
  currentC: number;
  powerFactor: number;
}

export interface RiskEvent {
  eventId: string;
  userId: string;
  riskType: "load_spike" | "overload" | "low_power_factor" | "unbalance" | "voltage_anomaly";
  level: RiskLevel;
  message: string;
  timestamp: string;
}

export interface OperationsSnapshot {
  generatedAt: string;
  users: UserProfile[];
  readings: TelemetryReading[];
  risks: RiskEvent[];
}
```

Create `packages/domain/src/metrics.ts`:

```ts
import type { LoadBand } from "./types";

export function calculateLoadRate(activePowerKw: number, contractCapacityKva: number, powerFactor = 0.9): number {
  if (contractCapacityKva <= 0 || powerFactor <= 0) return 0;
  return Number(((activePowerKw / (contractCapacityKva * powerFactor)) * 100).toFixed(2));
}

export function classifyLoadRate(rate: number): LoadBand {
  if (rate < 20) return "light";
  if (rate <= 80) return "normal";
  if (rate <= 100) return "heavy";
  return "overload";
}

export function calculateUnbalance(currents: { a: number; b: number; c: number }): number {
  const max = Math.max(currents.a, currents.b, currents.c);
  const min = Math.min(currents.a, currents.b, currents.c);
  if (max <= 0) return 0;
  return Number((((max - min) / max) * 100).toFixed(2));
}
```

Create `packages/domain/src/schema.ts`:

```ts
import { z } from "zod";

export const userTypeSchema = z.enum([
  "residential",
  "general_commercial",
  "large_industrial",
  "high_energy",
  "agriculture",
  "charging_station",
  "distributed_pv"
]);

export const userProfileSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  city: z.string(),
  county: z.string(),
  industry: z.string(),
  userType: userTypeSchema,
  contractCapacityKva: z.number().positive(),
  transformerId: z.string(),
  lineId: z.string(),
  tags: z.array(z.string())
});
```

Create `packages/domain/src/index.ts`:

```ts
export * from "./metrics";
export * from "./schema";
export * from "./types";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test packages/domain/test/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat: add domain electricity metrics"
```

---

### Task 3: Deterministic Simulator And Fixture Snapshot

**Files:**
- Create: `packages/simulator/tsconfig.json`
- Create: `packages/simulator/src/index.ts`
- Create: `packages/simulator/src/scenarios.ts`
- Create: `packages/simulator/src/generator.ts`
- Create: `packages/simulator/src/write-fixtures.ts`
- Create: `packages/simulator/test/generator.test.ts`
- Create: `data/fixtures/shanxi-snapshot.json`

**Interfaces:**
- Consumes: `UserProfile`, `TelemetryReading`, `RiskEvent`, `OperationsSnapshot`
- Produces: `generateSnapshot(options: GenerateSnapshotOptions): OperationsSnapshot`
- Produces: fixture file `data/fixtures/shanxi-snapshot.json`

- [ ] **Step 1: Write failing simulator test**

Create `packages/simulator/test/generator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../src/index";

describe("simulator generator", () => {
  it("generates deterministic Shanxi operations data", () => {
    const first = generateSnapshot({ seed: 7, userCount: 20, readingMinutes: 3 });
    const second = generateSnapshot({ seed: 7, userCount: 20, readingMinutes: 3 });

    expect(first).toEqual(second);
    expect(first.users).toHaveLength(20);
    expect(first.readings.length).toBeGreaterThan(20);
    expect(first.risks.some((risk) => risk.riskType === "load_spike")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/simulator/test/generator.test.ts
```

Expected: FAIL because simulator exports do not exist.

- [ ] **Step 3: Implement simulator**

Create `packages/simulator/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

Create `packages/simulator/src/scenarios.ts`:

```ts
export const shanxiCities = ["太原", "大同", "阳泉", "长治", "晋城", "朔州", "晋中", "运城", "忻州", "临汾", "吕梁"] as const;

export const industries = ["煤炭", "焦化", "钢铁", "铝镁", "制造", "园区", "公共服务", "居民生活"] as const;

export const userNames = ["晋能", "潞安", "太钢", "汾西", "山焦", "云冈", "晋铝", "并州", "龙城", "河东"] as const;
```

Create `packages/simulator/src/generator.ts`:

```ts
import { calculateLoadRate, calculateUnbalance, type OperationsSnapshot, type RiskEvent, type TelemetryReading, type UserProfile, type UserType } from "@shanxi/domain";
import { industries, shanxiCities, userNames } from "./scenarios";

export interface GenerateSnapshotOptions {
  seed: number;
  userCount: number;
  readingMinutes: number;
}

function seeded(seed: number): () => number {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function userTypeFor(index: number): UserType {
  const types: UserType[] = ["residential", "general_commercial", "large_industrial", "high_energy", "agriculture", "charging_station", "distributed_pv"];
  return types[index % types.length];
}

export function generateSnapshot(options: GenerateSnapshotOptions): OperationsSnapshot {
  const random = seeded(options.seed);
  const generatedAt = "2026-07-07T12:00:00.000+08:00";
  const users: UserProfile[] = Array.from({ length: options.userCount }, (_, index) => {
    const city = pick(shanxiCities, random);
    const userType = userTypeFor(index);
    const industry = userType === "residential" ? "居民生活" : pick(industries, random);
    const capacity = userType === "large_industrial" || userType === "high_energy" ? 8000 + Math.floor(random() * 30000) : 50 + Math.floor(random() * 1500);
    return {
      userId: `SX-U-${String(index + 1).padStart(6, "0")}`,
      userName: `${city}${pick(userNames, random)}${industry}用户${index + 1}`,
      city,
      county: `${city}示范县${(index % 5) + 1}`,
      industry,
      userType,
      contractCapacityKva: capacity,
      transformerId: `TR-${city}-${index % 30}`,
      lineId: `LN-${city}-${index % 12}`,
      tags: index % 9 === 0 ? ["煤改电"] : userType === "large_industrial" ? ["大工业"] : []
    };
  });

  const readings: TelemetryReading[] = [];
  const risks: RiskEvent[] = [];
  for (const user of users) {
    for (let minute = 0; minute < options.readingMinutes; minute += 1) {
      const spike = user.userType === "large_industrial" && minute === options.readingMinutes - 1 && Number(user.userId.slice(-2)) % 4 === 0;
      const activePowerKw = Number((user.contractCapacityKva * (spike ? 1.15 : 0.35 + random() * 0.45)).toFixed(2));
      const currentA = Number((activePowerKw / 3 + random() * 20).toFixed(2));
      const currentB = Number((activePowerKw / 3 + random() * 20).toFixed(2));
      const currentC = Number((activePowerKw / 3 + (spike ? 120 : random() * 20)).toFixed(2));
      const timestamp = `2026-07-07T12:${String(minute).padStart(2, "0")}:00.000+08:00`;
      readings.push({
        readingId: `${user.userId}-${minute}`,
        userId: user.userId,
        meterId: `M-${user.userId}`,
        timestamp,
        activePowerKw,
        voltageA: 220 + random() * 8,
        voltageB: 220 + random() * 8,
        voltageC: 220 + random() * 8,
        currentA,
        currentB,
        currentC,
        powerFactor: spike ? 0.78 : 0.9 + random() * 0.08
      });
      const loadRate = calculateLoadRate(activePowerKw, user.contractCapacityKva);
      const unbalance = calculateUnbalance({ a: currentA, b: currentB, c: currentC });
      if (spike || loadRate > 100 || unbalance > 25) {
        risks.push({
          eventId: `R-${user.userId}-${minute}`,
          userId: user.userId,
          riskType: spike ? "load_spike" : unbalance > 25 ? "unbalance" : "overload",
          level: loadRate > 100 ? "critical" : "warning",
          message: `${user.userName}出现${spike ? "晚高峰负荷突增" : "运行异常"}`,
          timestamp
        });
      }
    }
  }

  return { generatedAt, users, readings, risks };
}
```

Create `packages/simulator/src/write-fixtures.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateSnapshot } from "./generator";

const output = resolve(process.cwd(), "data/fixtures/shanxi-snapshot.json");
const snapshot = generateSnapshot({ seed: 20260707, userCount: 200, readingMinutes: 12 });

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`wrote ${output}`);
```

Create `packages/simulator/src/index.ts`:

```ts
export * from "./generator";
export * from "./scenarios";
```

- [ ] **Step 4: Run simulator tests**

Run:

```bash
pnpm test packages/simulator/test/generator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Generate fixture**

Run:

```bash
pnpm --filter @shanxi/simulator generate
```

Expected: `data/fixtures/shanxi-snapshot.json` exists and contains users, readings, and risks.

- [ ] **Step 6: Commit**

```bash
git add packages/simulator data/fixtures/shanxi-snapshot.json
git commit -m "feat: add deterministic Shanxi data simulator"
```

---

### Task 4: API Service With Operations And SQL Guard

**Files:**
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/operations.ts`
- Create: `apps/api/src/routes/simulator.ts`
- Create: `apps/api/src/services/fixture-store.ts`
- Create: `apps/api/src/services/sql-guard.ts`
- Create: `apps/api/test/sql-guard.test.ts`
- Create: `apps/api/test/operations-routes.test.ts`

**Interfaces:**
- Consumes: `data/fixtures/shanxi-snapshot.json`
- Produces: `GET /health`
- Produces: `GET /operations/summary`
- Produces: `GET /operations/risks`
- Produces: `POST /simulator/snapshot`
- Produces: `validateReadOnlySql(sql: string): { ok: true } | { ok: false; reason: string }`

- [ ] **Step 1: Write failing SQL guard test**

Create `apps/api/test/sql-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "../src/services/sql-guard";

describe("sql guard", () => {
  it("allows bounded select statements", () => {
    expect(validateReadOnlySql("select city, sum(load_kw) from ads_user_load group by city limit 100")).toEqual({ ok: true });
  });

  it("rejects mutation statements", () => {
    expect(validateReadOnlySql("delete from ads_user_load")).toEqual({ ok: false, reason: "Only SELECT statements are allowed" });
  });

  it("rejects unbounded select statements", () => {
    expect(validateReadOnlySql("select * from ads_user_load")).toEqual({ ok: false, reason: "SELECT statements must include LIMIT <= 1000" });
  });
});
```

- [ ] **Step 2: Implement SQL guard**

Create `apps/api/src/services/sql-guard.ts`:

```ts
export type SqlGuardResult = { ok: true } | { ok: false; reason: string };

export function validateReadOnlySql(sql: string): SqlGuardResult {
  const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized.startsWith("select ")) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/.test(normalized)) {
    return { ok: false, reason: "Mutation and DDL keywords are not allowed" };
  }
  const limit = normalized.match(/\blimit\s+(\d+)\b/);
  if (!limit || Number(limit[1]) > 1000) {
    return { ok: false, reason: "SELECT statements must include LIMIT <= 1000" };
  }
  return { ok: true };
}
```

- [ ] **Step 3: Run SQL guard test**

Run:

```bash
pnpm test apps/api/test/sql-guard.test.ts
```

Expected: PASS.

- [ ] **Step 4: Implement API service**

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

Create `apps/api/src/services/fixture-store.ts`:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { OperationsSnapshot } from "@shanxi/domain";
import { generateSnapshot } from "@shanxi/simulator";

const fixturePath = resolve(process.cwd(), "data/fixtures/shanxi-snapshot.json");

export async function loadSnapshot(): Promise<OperationsSnapshot> {
  try {
    return JSON.parse(await readFile(fixturePath, "utf8")) as OperationsSnapshot;
  } catch {
    return generateSnapshot({ seed: 20260707, userCount: 200, readingMinutes: 12 });
  }
}
```

Create `apps/api/src/routes/health.ts`:

```ts
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, service: "shanxi-api" }));
}
```

Create `apps/api/src/routes/operations.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { calculateLoadRate } from "@shanxi/domain";
import { loadSnapshot } from "../services/fixture-store";

export async function operationsRoutes(app: FastifyInstance) {
  app.get("/operations/summary", async () => {
    const snapshot = await loadSnapshot();
    const latestByUser = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    const totalLoadKw = Array.from(latestByUser.values()).reduce((sum, reading) => sum + reading.activePowerKw, 0);
    const largeIndustrialUsers = snapshot.users.filter((user) => user.userType === "large_industrial");
    const criticalRisks = snapshot.risks.filter((risk) => risk.level === "critical");
    return {
      generatedAt: snapshot.generatedAt,
      totalUsers: snapshot.users.length,
      totalLoadKw: Number(totalLoadKw.toFixed(2)),
      largeIndustrialUsers: largeIndustrialUsers.length,
      activeRisks: snapshot.risks.length,
      criticalRisks: criticalRisks.length
    };
  });

  app.get("/operations/risks", async () => {
    const snapshot = await loadSnapshot();
    return snapshot.risks.slice(0, 50);
  });

  app.get("/operations/industrial", async () => {
    const snapshot = await loadSnapshot();
    const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    return snapshot.users
      .filter((user) => user.userType === "large_industrial" || user.userType === "high_energy")
      .map((user) => {
        const reading = latest.get(user.userId);
        return {
          ...user,
          activePowerKw: reading?.activePowerKw ?? 0,
          loadRate: reading ? calculateLoadRate(reading.activePowerKw, user.contractCapacityKva, reading.powerFactor) : 0
        };
      })
      .sort((a, b) => b.activePowerKw - a.activePowerKw)
      .slice(0, 30);
  });
}
```

Create `apps/api/src/routes/simulator.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { generateSnapshot } from "@shanxi/simulator";

export async function simulatorRoutes(app: FastifyInstance) {
  app.post("/simulator/snapshot", async (request) => {
    const body = request.body as Partial<{ seed: number; userCount: number; readingMinutes: number }>;
    return generateSnapshot({
      seed: body.seed ?? 20260707,
      userCount: body.userCount ?? 200,
      readingMinutes: body.readingMinutes ?? 12
    });
  });
}
```

Create `apps/api/src/index.ts`:

```ts
import cors from "@fastify/cors";
import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { operationsRoutes } from "./routes/operations";
import { simulatorRoutes } from "./routes/simulator";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(operationsRoutes);
  await app.register(simulatorRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
}
```

- [ ] **Step 5: Write and run route test**

Create `apps/api/test/operations-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/index";

describe("operations routes", () => {
  it("returns summary metrics", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/operations/summary" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalUsers: expect.any(Number),
      totalLoadKw: expect.any(Number),
      activeRisks: expect.any(Number)
    });
  });
});
```

Run:

```bash
pnpm test apps/api/test/operations-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: add operations API and SQL guard"
```

---

### Task 5: AI Task Planner Prototype

**Files:**
- Create: `packages/agent/tsconfig.json`
- Create: `packages/agent/src/index.ts`
- Create: `packages/agent/src/retrieval.ts`
- Create: `packages/agent/src/task-plan.ts`
- Create: `packages/agent/src/planner.ts`
- Create: `packages/agent/test/planner.test.ts`
- Create: `apps/api/src/routes/agent.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Produces: `planAnalysisTask(input: string): AnalysisTaskPlan`
- Produces: `POST /agent/plan`
- Produces: `AnalysisTaskPlan` with `needsNewWideTable`, `clarifyingQuestion`, `candidateAssets`, and `generatedSql`

- [ ] **Step 1: Write failing planner test**

Create `packages/agent/test/planner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planAnalysisTask } from "../src/index";

describe("AI task planner prototype", () => {
  it("plans a new task when no wide table exists for industrial spike ranking", () => {
    const plan = planAnalysisTask("分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名");

    expect(plan.intent).toBe("industrial_peak_spike_ranking");
    expect(plan.needsNewWideTable).toBe(true);
    expect(plan.clarifyingQuestion).toContain("突增");
    expect(plan.steps.map((step) => step.kind)).toEqual(["semantic_parse", "metadata_retrieval", "clarify_metric", "generate_dws_ads"]);
  });
});
```

- [ ] **Step 2: Implement agent types and planner**

Create `packages/agent/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

Create `packages/agent/src/task-plan.ts`:

```ts
export interface TaskStep {
  kind: "semantic_parse" | "metadata_retrieval" | "clarify_metric" | "generate_dws_ads";
  title: string;
  detail: string;
}

export interface AnalysisTaskPlan {
  intent: string;
  needsNewWideTable: boolean;
  clarifyingQuestion: string;
  candidateAssets: string[];
  generatedSql: string;
  steps: TaskStep[];
}
```

Create `packages/agent/src/retrieval.ts`:

```ts
export interface RetrievalAsset {
  name: string;
  description: string;
}

export function retrieveAssets(query: string): RetrievalAsset[] {
  const assets: RetrievalAsset[] = [
    { name: "dwd_user_meter_readings", description: "用户计量点分钟级负荷明细" },
    { name: "dim_user_profile", description: "用户档案、行业、地市、容量、标签" },
    { name: "ads_realtime_user_load", description: "已有实时用户负荷宽表，不包含近30天晚高峰突增基线" }
  ];
  return assets.filter((asset) => query.includes("大工业") || asset.name.includes("user"));
}
```

Create `packages/agent/src/planner.ts`:

```ts
import { retrieveAssets } from "./retrieval";
import type { AnalysisTaskPlan } from "./task-plan";

export function planAnalysisTask(input: string): AnalysisTaskPlan {
  const candidateAssets = retrieveAssets(input).map((asset) => asset.name);
  const industrialSpike = input.includes("大工业") && input.includes("突增");
  return {
    intent: industrialSpike ? "industrial_peak_spike_ranking" : "general_text_to_sql",
    needsNewWideTable: industrialSpike,
    clarifyingQuestion: industrialSpike
      ? "突增建议按昨日同小时环比超过30%，还是近7日均值超过2倍？晚高峰按18:00-22:00还是自定义时段？"
      : "请确认查询时间范围和统计粒度。",
    candidateAssets,
    generatedSql: [
      "CREATE TABLE ads_industrial_peak_spike_rank AS",
      "SELECT city, industry, user_id, MAX(spike_ratio) AS max_spike_ratio",
      "FROM dws_user_hourly_load_baseline",
      "WHERE user_type = 'large_industrial' AND hour BETWEEN 18 AND 22",
      "GROUP BY city, industry, user_id;"
    ].join("\n"),
    steps: [
      { kind: "semantic_parse", title: "语义拆解", detail: "识别对象为大工业用户，指标为晚高峰负荷突增，维度为行业和地市。" },
      { kind: "metadata_retrieval", title: "元数据检索", detail: "检索用户档案、计量点负荷明细和已有实时宽表。" },
      { kind: "clarify_metric", title: "口径确认", detail: "确认突增阈值、晚高峰时段和排名粒度。" },
      { kind: "generate_dws_ads", title: "生成任务", detail: "生成 DWS 基线表和 ADS 排名表。" }
    ]
  };
}
```

Create `packages/agent/src/index.ts`:

```ts
export * from "./planner";
export * from "./retrieval";
export * from "./task-plan";
```

- [ ] **Step 3: Run planner test**

Run:

```bash
pnpm test packages/agent/test/planner.test.ts
```

Expected: PASS.

- [ ] **Step 4: Expose planner API**

Create `apps/api/src/routes/agent.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { planAnalysisTask } from "@shanxi/agent";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/plan", async (request) => {
    const body = request.body as Partial<{ query: string }>;
    return planAnalysisTask(body.query ?? "");
  });
}
```

Modify `apps/api/src/index.ts` to register `agentRoutes`:

```ts
import cors from "@fastify/cors";
import Fastify from "fastify";
import { agentRoutes } from "./routes/agent";
import { healthRoutes } from "./routes/health";
import { operationsRoutes } from "./routes/operations";
import { simulatorRoutes } from "./routes/simulator";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(operationsRoutes);
  await app.register(simulatorRoutes);
  await app.register(agentRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
}
```

- [ ] **Step 5: Run API tests**

Run:

```bash
pnpm test apps/api/test/operations-routes.test.ts packages/agent/test/planner.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/agent apps/api/src/routes/agent.ts apps/api/src/index.ts
git commit -m "feat: add AI analysis task planner"
```

---

### Task 6: Frontend Product Shell And Dashboard

**Files:**
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/index.html`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/cn.ts`
- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/components/charts/LoadTrendChart.tsx`
- Create: `apps/web/src/components/Shell.tsx`
- Create: `apps/web/src/components/MetricCard.tsx`
- Create: `apps/web/src/components/RiskQueue.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/scroll-area.tsx`
- Create: `apps/web/src/components/ui/table.tsx`
- Create: `apps/web/src/components/ui/tabs.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `GET /operations/summary`, `GET /operations/risks`
- Produces: browser route tabs in `App.tsx`
- Produces: dashboard-first UI with no marketing landing page
- Produces: local shadcn/ui-style primitives and Recharts operational chart components

- [ ] **Step 1: Create Vite app files**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist-ts",
    "rootDir": "src"
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5050,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
```

Create `apps/web/index.html`:

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

- [ ] **Step 2: Create API client and format helpers**

Create `apps/web/src/lib/api.ts`:

```ts
const API_BASE = "/api";

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}
```

Create `apps/web/src/lib/format.ts`:

```ts
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}
```

- [ ] **Step 3: Create UI shell and dashboard components**

Create `apps/web/src/components/MetricCard.tsx`:

```tsx
export function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <section className="metric-card">
      <div className="metric-label">{label}</div>
      <strong>{value}</strong>
      <span>{hint}</span>
    </section>
  );
}
```

Create `apps/web/src/components/RiskQueue.tsx`:

```tsx
interface RiskItem {
  eventId: string;
  riskType: string;
  level: string;
  message: string;
  timestamp: string;
}

export function RiskQueue({ risks }: { risks: RiskItem[] }) {
  return (
    <section className="panel">
      <h2>实时风险队列</h2>
      <div className="risk-list">
        {risks.map((risk) => (
          <article className={`risk risk-${risk.level}`} key={risk.eventId}>
            <b>{risk.riskType}</b>
            <span>{risk.message}</span>
            <time>{risk.timestamp.slice(11, 19)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `apps/web/src/components/Shell.tsx`:

```tsx
const tabs = ["全省态势", "大工业分析", "AI 问数", "AI 建任务", "模拟压测"];

export function Shell({ active, onTab, children }: { active: string; onTab: (tab: string) => void; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>山西用电运营</h1>
        {tabs.map((tab) => (
          <button className={active === tab ? "active" : ""} key={tab} onClick={() => onTab(tab)}>
            {tab}
          </button>
        ))}
      </aside>
      <main>{children}</main>
    </div>
  );
}
```

Create `apps/web/src/pages/DashboardPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { RiskQueue } from "../components/RiskQueue";
import { getJson } from "../lib/api";
import { formatNumber } from "../lib/format";

interface Summary {
  generatedAt: string;
  totalUsers: number;
  totalLoadKw: number;
  largeIndustrialUsers: number;
  activeRisks: number;
  criticalRisks: number;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    void getJson<Summary>("/operations/summary").then(setSummary);
    void getJson<[]>("/operations/risks").then(setRisks);
  }, []);

  if (!summary) return <div className="loading">加载全省态势...</div>;

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <p>山西省全量用户</p>
          <h2>实时智能运营态势</h2>
        </div>
        <span>数据时间 {summary.generatedAt}</span>
      </header>
      <div className="metrics">
        <MetricCard label="全量用户" value={formatNumber(summary.totalUsers)} hint="覆盖居民、工商业、大工业等" />
        <MetricCard label="当前负荷 kW" value={formatNumber(summary.totalLoadKw)} hint="模拟实时遥测汇总" />
        <MetricCard label="大工业用户" value={formatNumber(summary.largeIndustrialUsers)} hint="重点风险分析对象" />
        <MetricCard label="实时风险" value={formatNumber(summary.activeRisks)} hint={`${summary.criticalRisks} 条严重风险`} />
      </div>
      <section className="map-panel">
        <h2>山西一张图风险热力</h2>
        <div className="shanxi-map">太原 / 大同 / 长治 / 运城 / 临汾 / 吕梁</div>
      </section>
      <RiskQueue risks={risks} />
    </div>
  );
}
```

- [ ] **Step 4: Wire app and styles**

Create `apps/web/src/App.tsx`:

```tsx
import { useState } from "react";
import { Shell } from "./components/Shell";
import { DashboardPage } from "./pages/DashboardPage";

export function App() {
  const [active, setActive] = useState("全省态势");
  return (
    <Shell active={active} onTab={setActive}>
      <DashboardPage />
    </Shell>
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
```

Create `apps/web/src/styles.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7f8fb; color: #172033; }
button { font: inherit; }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: 220px 1fr; }
.sidebar { background: #111827; color: white; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.sidebar h1 { font-size: 18px; margin: 0 0 16px; }
.sidebar button { text-align: left; border: 0; border-radius: 8px; padding: 10px 12px; color: #d1d5db; background: transparent; cursor: pointer; }
.sidebar button.active { background: #2563eb; color: white; }
main { padding: 24px; }
.page-grid { display: grid; grid-template-columns: 1.4fr .8fr; gap: 16px; }
.page-header { grid-column: 1 / -1; display: flex; align-items: end; justify-content: space-between; }
.page-header p { margin: 0 0 4px; color: #64748b; }
.page-header h2 { margin: 0; font-size: 28px; }
.metrics { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.metric-card, .panel, .map-panel { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
.metric-card strong { display: block; font-size: 26px; margin: 8px 0; }
.metric-label, .metric-card span { color: #64748b; font-size: 13px; }
.shanxi-map { height: 320px; display: grid; place-items: center; border-radius: 8px; background: linear-gradient(135deg, #dbeafe, #ecfeff); color: #1d4ed8; font-weight: 700; }
.risk-list { display: grid; gap: 10px; }
.risk { display: grid; gap: 4px; padding: 10px; border-radius: 8px; background: #f8fafc; }
.risk-critical { border-left: 4px solid #dc2626; }
.risk-warning { border-left: 4px solid #f59e0b; }
.loading { padding: 32px; }
```

- [ ] **Step 5: Build frontend**

Run:

```bash
pnpm --filter @shanxi/web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add operations dashboard UI"
```

---

### Task 7: Add Big Industry, Text-to-SQL, Agent, And Simulator Pages

**Files:**
- Create: `apps/web/src/pages/IndustrialPage.tsx`
- Create: `apps/web/src/pages/TextToSqlPage.tsx`
- Create: `apps/web/src/pages/AgentTaskPage.tsx`
- Create: `apps/web/src/pages/SimulatorPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `GET /operations/industrial`
- Consumes: `POST /agent/plan`
- Consumes: `POST /simulator/snapshot`
- Produces: user-facing flows for large industrial analysis, SQL evidence, agent task creation, and simulation

- [ ] **Step 1: Create large industrial analysis page**

Create `apps/web/src/pages/IndustrialPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { getJson } from "../lib/api";
import { formatNumber } from "../lib/format";

interface IndustrialUser {
  userId: string;
  userName: string;
  city: string;
  industry: string;
  contractCapacityKva: number;
  activePowerKw: number;
  loadRate: number;
}

export function IndustrialPage() {
  const [rows, setRows] = useState<IndustrialUser[]>([]);
  useEffect(() => void getJson<IndustrialUser[]>("/operations/industrial").then(setRows), []);
  return (
    <section className="panel full">
      <h2>大工业用户负荷分析</h2>
      <table>
        <thead><tr><th>用户</th><th>地市</th><th>行业</th><th>当前负荷</th><th>负载率</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td>{row.userName}</td>
              <td>{row.city}</td>
              <td>{row.industry}</td>
              <td>{formatNumber(row.activePowerKw)} kW</td>
              <td>{formatNumber(row.loadRate)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Create Text-to-SQL page**

Create `apps/web/src/pages/TextToSqlPage.tsx`:

```tsx
import { useState } from "react";

export function TextToSqlPage() {
  const [query, setQuery] = useState("查询近7天太原大工业用户晚高峰负荷Top10，并按行业分组");
  const sql = "SELECT city, industry, user_id, MAX(active_power_kw) AS peak_kw FROM ads_realtime_user_load WHERE city = '太原' GROUP BY city, industry, user_id LIMIT 100;";
  return (
    <section className="panel full">
      <h2>AI 问数 Text-to-SQL</h2>
      <textarea value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="evidence-grid">
        <article><b>命中表</b><span>ads_realtime_user_load</span></article>
        <article><b>命中字段</b><span>city, industry, user_id, active_power_kw</span></article>
        <article><b>安全校验</b><span>只读 SELECT，LIMIT 100</span></article>
      </div>
      <pre>{sql}</pre>
    </section>
  );
}
```

- [ ] **Step 3: Create AI task page**

Create `apps/web/src/pages/AgentTaskPage.tsx`:

```tsx
import { useState } from "react";
import { postJson } from "../lib/api";

interface Plan {
  intent: string;
  needsNewWideTable: boolean;
  clarifyingQuestion: string;
  candidateAssets: string[];
  generatedSql: string;
  steps: Array<{ kind: string; title: string; detail: string }>;
}

export function AgentTaskPage() {
  const [query, setQuery] = useState("分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名");
  const [plan, setPlan] = useState<Plan | null>(null);
  return (
    <section className="panel full">
      <h2>AI 建任务</h2>
      <textarea value={query} onChange={(event) => setQuery(event.target.value)} />
      <button onClick={() => void postJson<Plan>("/agent/plan", { query }).then(setPlan)}>生成任务计划</button>
      {plan && (
        <div className="agent-plan">
          <p><b>是否需要新宽表：</b>{plan.needsNewWideTable ? "是" : "否"}</p>
          <p><b>待确认口径：</b>{plan.clarifyingQuestion}</p>
          <div className="steps">
            {plan.steps.map((step) => <article key={step.kind}><b>{step.title}</b><span>{step.detail}</span></article>)}
          </div>
          <pre>{plan.generatedSql}</pre>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create simulator page**

Create `apps/web/src/pages/SimulatorPage.tsx`:

```tsx
import { useState } from "react";
import { postJson } from "../lib/api";

export function SimulatorPage() {
  const [userCount, setUserCount] = useState(500);
  const [result, setResult] = useState<{ users: unknown[]; readings: unknown[]; risks: unknown[] } | null>(null);
  return (
    <section className="panel full">
      <h2>模拟数据与压测中心</h2>
      <label>用户规模<input type="number" value={userCount} onChange={(event) => setUserCount(Number(event.target.value))} /></label>
      <button onClick={() => void postJson<typeof result>("/simulator/snapshot", { seed: 9, userCount, readingMinutes: 12 }).then(setResult)}>生成模拟场景</button>
      {result && (
        <div className="metrics">
          <div className="metric-card"><strong>{result.users.length}</strong><span>模拟用户</span></div>
          <div className="metric-card"><strong>{result.readings.length}</strong><span>遥测点</span></div>
          <div className="metric-card"><strong>{result.risks.length}</strong><span>风险事件</span></div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Wire routes in App**

Modify `apps/web/src/App.tsx`:

```tsx
import { useState } from "react";
import { Shell } from "./components/Shell";
import { AgentTaskPage } from "./pages/AgentTaskPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IndustrialPage } from "./pages/IndustrialPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { TextToSqlPage } from "./pages/TextToSqlPage";

export function App() {
  const [active, setActive] = useState("全省态势");
  const page = active === "大工业分析"
    ? <IndustrialPage />
    : active === "AI 问数"
      ? <TextToSqlPage />
      : active === "AI 建任务"
        ? <AgentTaskPage />
        : active === "模拟压测"
          ? <SimulatorPage />
          : <DashboardPage />;
  return <Shell active={active} onTab={setActive}>{page}</Shell>;
}
```

Append to `apps/web/src/styles.css`:

```css
.full { grid-column: 1 / -1; }
textarea { width: 100%; min-height: 92px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; resize: vertical; }
pre { overflow: auto; background: #111827; color: #d1fae5; padding: 16px; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.evidence-grid, .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.evidence-grid article, .steps article { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; display: grid; gap: 6px; }
label { display: grid; gap: 6px; max-width: 260px; }
input { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
button { border: 0; border-radius: 8px; padding: 10px 14px; background: #2563eb; color: white; cursor: pointer; margin: 12px 0; }
```

- [ ] **Step 6: Build frontend**

Run:

```bash
pnpm --filter @shanxi/web build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat: add AI and simulator product pages"
```

---

### Task 8: Docker Compose Runtime

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `deploy/compose/docker-compose.yml`
- Create: `.dockerignore`
- Create: `.gitignore`

**Interfaces:**
- Produces: `docker compose -f deploy/compose/docker-compose.yml up --build`
- Produces: API on `http://localhost:4000`
- Produces: frontend on `http://localhost:5050`

- [ ] **Step 1: Create Docker ignore files**

Create `.gitignore`:

```gitignore
node_modules
dist
dist-ts
.DS_Store
.env
coverage
```

Create `.dockerignore`:

```dockerignore
node_modules
dist
dist-ts
.git
.DS_Store
coverage
```

- [ ] **Step 2: Create API Dockerfile**

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/simulator/package.json packages/simulator/package.json
COPY packages/agent/package.json packages/agent/package.json
RUN pnpm install

FROM deps AS app
COPY . .
EXPOSE 4000
CMD ["pnpm", "--filter", "@shanxi/api", "dev"]
```

- [ ] **Step 3: Create web Dockerfile**

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install
COPY . .
EXPOSE 5050
CMD ["pnpm", "--filter", "@shanxi/web", "dev"]
```

- [ ] **Step 4: Create Compose file**

Create `deploy/compose/docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    ports:
      - "4000:4000"
    volumes:
      - ../../data:/app/data
      - ../../apps:/app/apps
      - ../../packages:/app/packages
  web:
    build:
      context: ../..
      dockerfile: apps/web/Dockerfile
    ports:
      - "5050:5050"
    depends_on:
      - api
```

- [ ] **Step 5: Verify Compose config**

Run:

```bash
docker compose -f deploy/compose/docker-compose.yml config
```

Expected: Compose config renders without errors.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .dockerignore apps/api/Dockerfile apps/web/Dockerfile deploy/compose/docker-compose.yml
git commit -m "chore: add Docker Compose runtime"
```

---

### Task 9: K8s-Ready Stage-Two Skeleton

**Files:**
- Create: `deploy/k8s/base/api-deployment.yaml`
- Create: `deploy/k8s/base/frontend-deployment.yaml`
- Create: `deploy/k8s/base/simulator-cronjob.yaml`
- Create: `deploy/k8s/base/kustomization.yaml`
- Create: `deploy/k8s/overlays/docker-desktop/kustomization.yaml`
- Create: `deploy/k8s/overlays/kind/kustomization.yaml`
- Create: `deploy/k8s/README.md`

**Interfaces:**
- Produces: `kubectl kustomize deploy/k8s/overlays/docker-desktop`
- Produces: `kubectl kustomize deploy/k8s/overlays/kind`

- [ ] **Step 1: Create base API deployment**

Create `deploy/k8s/base/api-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shanxi-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shanxi-api
  template:
    metadata:
      labels:
        app: shanxi-api
    spec:
      containers:
        - name: api
          image: shanxi-api:local
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 4000
---
apiVersion: v1
kind: Service
metadata:
  name: shanxi-api
spec:
  type: ClusterIP
  selector:
    app: shanxi-api
  ports:
    - port: 4000
      targetPort: 4000
```

- [ ] **Step 2: Create frontend deployment**

Create `deploy/k8s/base/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shanxi-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shanxi-web
  template:
    metadata:
      labels:
        app: shanxi-web
    spec:
      containers:
        - name: web
          image: shanxi-web:local
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 5050
---
apiVersion: v1
kind: Service
metadata:
  name: shanxi-web
spec:
  type: NodePort
  selector:
    app: shanxi-web
  ports:
    - port: 5050
      targetPort: 5050
      nodePort: 30050
```

- [ ] **Step 3: Create simulator CronJob**

Create `deploy/k8s/base/simulator-cronjob.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shanxi-simulator
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: simulator
              image: shanxi-api:local
              imagePullPolicy: IfNotPresent
              command: ["pnpm", "--filter", "@shanxi/simulator", "generate"]
```

- [ ] **Step 4: Create kustomizations**

Create `deploy/k8s/base/kustomization.yaml`:

```yaml
resources:
  - api-deployment.yaml
  - frontend-deployment.yaml
  - simulator-cronjob.yaml
```

Create `deploy/k8s/overlays/docker-desktop/kustomization.yaml`:

```yaml
resources:
  - ../../base
nameSuffix: -docker-desktop
```

Create `deploy/k8s/overlays/kind/kustomization.yaml`:

```yaml
resources:
  - ../../base
nameSuffix: -kind
```

Create `deploy/k8s/README.md`:

```md
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
```

- [ ] **Step 5: Validate manifests**

Run:

```bash
kubectl kustomize deploy/k8s/overlays/docker-desktop
kubectl kustomize deploy/k8s/overlays/kind
```

Expected: both commands render Kubernetes YAML.

- [ ] **Step 6: Commit**

```bash
git add deploy/k8s
git commit -m "chore: add K8s-ready deployment skeleton"
```

---

### Task 10: Documentation And Verification Notes

**Files:**
- Create: `README.md`
- Modify: `doc/product_v2_design.md`
- Create: `docs/verification.md`

**Interfaces:**
- Produces: local run instructions
- Produces: verification checklist for no-Playwright Chrome checks
- Produces: link from README to product spec and implementation plan

- [ ] **Step 1: Create README**

Create `README.md`:

```md
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
```

- [ ] **Step 2: Create verification doc**

Create `docs/verification.md`:

```md
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
```

- [ ] **Step 3: Add implementation pointer to product spec**

Append to `doc/product_v2_design.md`:

```md
---

## 16. Implementation Plan

The approved implementation plan is saved at:

`docs/superpowers/plans/2026-07-07-shanxi-user-ops-platform.md`
```

- [ ] **Step 4: Run documentation checks**

Run:

```bash
rg -n "(^|[^p])npm|Playwright|placeholder marker" README.md docs/verification.md doc/product_v2_design.md
```

Expected:

- No standalone npm command references.
- No placeholder marker text.
- `Playwright` appears only in the sentence saying not to use it.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/verification.md doc/product_v2_design.md
git commit -m "docs: add runbook and verification notes"
```

---

## Self-Review

Spec coverage:

- Product positioning and full-user Shanxi scope: Task 6 dashboard, Task 7 pages, README.
- Large industrial user scenario: Task 3 simulator, Task 4 API, Task 7 frontend.
- Text-to-SQL: Task 4 SQL guard, Task 7 Text-to-SQL page.
- AI task creation when no wide table exists: Task 5 planner, Task 7 Agent page.
- Vector/LanceDB/Milvus design: covered in product spec; implementation plan keeps MVP as prototype and leaves real adapters for a follow-up plan.
- Docker Compose first stage: Task 8.
- Docker Desktop Kubernetes/kind second stage: Task 9.
- Simulation and pressure testing UI: Task 3 and Task 7.
- No Playwright and pnpm-only constraints: Global constraints and Task 10 verification doc.

Known follow-up plans after MVP:

- Add real Milvus and LanceDB adapters.
- Add real StarRocks query execution.
- Add real Flink SQL job submission.
- Expand Compose stack to include Fluss, Paimon, StarRocks, Milvus, and LanceDB services.
- Add local Chrome screenshot verification with the browser automation skill if requested.
