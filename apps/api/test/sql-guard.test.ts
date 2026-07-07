import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "../src/services/sql-guard";

describe("sql guard", () => {
  it("allows bounded select statements", () => {
    expect(validateReadOnlySql("select city, sum(load_kw) from ads_user_load group by city limit 100")).toEqual({ ok: true });
  });

  it("rejects mutation statements", () => {
    expect(validateReadOnlySql("delete from ads_user_load")).toEqual({ ok: false, reason: "Only SELECT statements are allowed" });
  });

  it("rejects unbounded select statements", () => {
    expect(validateReadOnlySql("select * from ads_user_load")).toEqual({ ok: false, reason: "SELECT statements must include LIMIT <= 1000" });
  });
});
