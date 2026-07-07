import { planAnalysisTask, type AnalysisTaskPlan, type TaskStep } from "@shanxi/agent";
import { loadLocalEnv } from "./env";

export type AgentPlanProvider = "deepseek" | "heuristic";

export interface AgentPlanResponse extends AnalysisTaskPlan {
  provider: AgentPlanProvider;
  model?: string;
  fallbackReason?: string;
}

interface DeepSeekChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const allowedStepKinds = new Set<TaskStep["kind"]>([
  "semantic_parse",
  "metadata_retrieval",
  "clarify_metric",
  "generate_dws_ads"
]);

const requiredSteps: TaskStep[] = [
  { kind: "semantic_parse", title: "语义拆解", detail: "识别查询对象、指标口径、时间范围和输出维度。" },
  { kind: "metadata_retrieval", title: "元数据检索", detail: "检索用户档案、计量明细、实时宽表和离线基线表。" },
  { kind: "clarify_metric", title: "口径确认", detail: "补齐缺失字段、阈值、统计粒度和异常判定规则。" },
  { kind: "generate_dws_ads", title: "生成任务", detail: "生成实时 SQL、离线校验任务和可服务前端的 ADS 接口表。" }
];

const fallbackReason = "DeepSeek 暂不可用，已使用本地规则规划器兜底。";

function fallbackPlan(query: string, reason: string): AgentPlanResponse {
  return {
    ...planAnalysisTask(query),
    provider: "heuristic",
    fallbackReason: reason
  };
}

function normalizeSql(sql: unknown): string {
  if (Array.isArray(sql)) return sql.filter((item) => typeof item === "string").join("\n");
  return typeof sql === "string" ? sql : "";
}

export function coerceDeepSeekPlan(raw: unknown): AnalysisTaskPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const steps = Array.isArray(value.steps) ? value.steps : [];

  if (
    typeof value.intent !== "string" ||
    typeof value.needsNewWideTable !== "boolean" ||
    typeof value.clarifyingQuestion !== "string" ||
    !Array.isArray(value.candidateAssets)
  ) {
    return null;
  }

  const normalizedSteps = steps
    .map((step) => {
      if (!step || typeof step !== "object") return null;
      const item = step as Record<string, unknown>;
      if (
        typeof item.kind !== "string" ||
        !allowedStepKinds.has(item.kind as TaskStep["kind"]) ||
        typeof item.title !== "string" ||
        typeof item.detail !== "string"
      ) {
        return null;
      }

      return {
        kind: item.kind as TaskStep["kind"],
        title: item.title,
        detail: item.detail
      };
    })
    .filter((step): step is TaskStep => step !== null);

  if (normalizedSteps.length === 0) return null;

  const seenKinds = new Set(normalizedSteps.map((step) => step.kind));
  const completeSteps = [
    ...normalizedSteps,
    ...requiredSteps.filter((step) => !seenKinds.has(step.kind))
  ].sort((left, right) => {
    const leftIndex = requiredSteps.findIndex((step) => step.kind === left.kind);
    const rightIndex = requiredSteps.findIndex((step) => step.kind === right.kind);
    return leftIndex - rightIndex;
  });

  return {
    intent: value.intent,
    needsNewWideTable: value.needsNewWideTable,
    clarifyingQuestion: value.clarifyingQuestion,
    candidateAssets: value.candidateAssets.filter((asset): asset is string => typeof asset === "string"),
    generatedSql: normalizeSql(value.generatedSql),
    steps: completeSteps
  };
}

function buildPrompt(query: string) {
  return [
    {
      role: "system",
      content: [
        "你是山西省全量用电用户实时运营平台的 Text2SQL 与 AI 建任务智能体。",
        "请基于国网大数据场景，把用户自然语言需求拆成可执行任务计划。",
        "如果现有宽表无法回答，要输出需要新建 DWS/ADS 宽表、离线校验和实时任务优化建议。",
        "steps 必须覆盖 semantic_parse, metadata_retrieval, clarify_metric, generate_dws_ads 四类步骤。",
        "只输出 json，字段必须完全匹配示例，不要输出 markdown。",
        "可用资产包括：dim_user_profile, dwd_user_meter_readings, ads_realtime_user_load, dws_user_hourly_load_baseline, ads_industrial_peak_spike_rank。",
        "示例 json：{\"intent\":\"industrial_peak_spike_ranking\",\"needsNewWideTable\":true,\"clarifyingQuestion\":\"请确认突增阈值。\",\"candidateAssets\":[\"dim_user_profile\"],\"generatedSql\":\"SELECT 1;\",\"steps\":[{\"kind\":\"semantic_parse\",\"title\":\"语义拆解\",\"detail\":\"识别对象、指标、时间范围。\"}]}"
      ].join("\n")
    },
    {
      role: "user",
      content: `用户需求：${query}\n请输出严格 json。`
    }
  ];
}

export async function planAnalysisTaskWithDeepSeek(query: string): Promise<AgentPlanResponse> {
  loadLocalEnv();

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return fallbackPlan(query, "未配置 DEEPSEEK_API_KEY，已使用本地规则规划器。");
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: buildPrompt(query),
        response_format: { type: "json_object" },
        max_tokens: 1800,
        temperature: 0.2,
        stream: false
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) return fallbackPlan(query, fallbackReason);

    const payload = (await response.json()) as DeepSeekChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return fallbackPlan(query, fallbackReason);

    const plan = coerceDeepSeekPlan(JSON.parse(content));
    if (!plan) return fallbackPlan(query, fallbackReason);

    return {
      ...plan,
      provider: "deepseek",
      model
    };
  } catch {
    return fallbackPlan(query, fallbackReason);
  }
}
