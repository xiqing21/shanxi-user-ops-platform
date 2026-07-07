import { planAnalysisTask, type AnalysisTaskPlan } from "@shanxi/agent";
import { loadLocalEnv } from "./env";

export type AgentPlanProvider = "python-ai" | "heuristic";

export interface AgentPlanResponse extends AnalysisTaskPlan {
  provider: AgentPlanProvider | string;
  model?: string;
  fallbackReason?: string;
  vectorBackend?: string;
  retrievalMode?: string;
}

function fallbackPlan(query: string, reason: string): AgentPlanResponse {
  return {
    ...planAnalysisTask(query),
    provider: "heuristic",
    fallbackReason: reason,
    vectorBackend: "none",
    retrievalMode: "local-rule"
  };
}

function isAnalysisTaskPlan(value: unknown): value is AgentPlanResponse {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.intent === "string" &&
    typeof plan.needsNewWideTable === "boolean" &&
    typeof plan.clarifyingQuestion === "string" &&
    Array.isArray(plan.candidateAssets) &&
    typeof plan.generatedSql === "string" &&
    Array.isArray(plan.steps)
  );
}

export async function planAnalysisTaskViaAiService(query: string): Promise<AgentPlanResponse> {
  loadLocalEnv();

  if (process.env.NODE_ENV === "test") {
    return fallbackPlan(query, "测试环境跳过 Python AI 服务，使用本地规则规划器。");
  }

  const baseUrl = (process.env.AI_SERVICE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/agent/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 20000))
    });

    if (!response.ok) {
      return fallbackPlan(query, `Python AI 服务返回 ${response.status}，已使用本地规则规划器。`);
    }

    const payload = await response.json();
    if (!isAnalysisTaskPlan(payload)) {
      return fallbackPlan(query, "Python AI 服务返回结构不完整，已使用本地规则规划器。");
    }

    return payload;
  } catch {
    return fallbackPlan(query, "Python AI 服务暂不可用，已使用本地规则规划器。");
  }
}
