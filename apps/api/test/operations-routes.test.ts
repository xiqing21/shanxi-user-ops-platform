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
