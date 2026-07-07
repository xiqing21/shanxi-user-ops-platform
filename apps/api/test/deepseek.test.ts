import { describe, expect, it } from "vitest";
import { coerceDeepSeekPlan } from "../src/services/deepseek";

describe("DeepSeek plan coercion", () => {
  it("accepts a valid structured Text2SQL task plan", () => {
    const plan = coerceDeepSeekPlan({
      intent: "industrial_peak_spike_ranking",
      needsNewWideTable: true,
      clarifyingQuestion: "请确认突增阈值。",
      candidateAssets: ["dim_user_profile", "dws_user_hourly_load_baseline"],
      generatedSql: "SELECT city, COUNT(*) FROM dws_user_hourly_load_baseline GROUP BY city;",
      steps: [
        {
          kind: "semantic_parse",
          title: "语义拆解",
          detail: "识别对象为大工业用户，指标为晚高峰负荷突增。"
        }
      ]
    });

    expect(plan).toMatchObject({
      intent: "industrial_peak_spike_ranking",
      needsNewWideTable: true
    });
  });

  it("rejects malformed model output", () => {
    expect(coerceDeepSeekPlan({ intent: "missing fields" })).toBeNull();
  });
});
