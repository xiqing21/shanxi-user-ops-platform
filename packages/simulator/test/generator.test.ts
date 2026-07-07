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
