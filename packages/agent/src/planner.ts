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
