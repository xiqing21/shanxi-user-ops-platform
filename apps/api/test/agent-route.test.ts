import { describe, expect, it } from "vitest";
import { buildApp } from "../src/index";

describe("agent route", () => {
  it("falls back to the local planner in tests without calling Python AI", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/agent/plan",
      payload: { query: "分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: "heuristic",
      intent: "industrial_peak_spike_ranking",
      needsNewWideTable: true
    });
  });
});
