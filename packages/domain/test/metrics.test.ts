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
