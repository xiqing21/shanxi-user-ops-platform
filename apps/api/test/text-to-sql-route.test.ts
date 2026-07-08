import { describe, expect, it } from "vitest";
import { buildApp } from "../src/index";

describe("text to sql route", () => {
  it("returns executable demo rows and chart data", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/text-to-sql/query",
      payload: { query: "查询太原大工业用户负荷Top10" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sql).toContain("SELECT");
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.charts.cityLoad.length).toBeGreaterThan(0);
  });
});
