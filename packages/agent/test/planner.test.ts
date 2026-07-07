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
