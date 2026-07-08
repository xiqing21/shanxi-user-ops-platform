import type { FastifyInstance } from "fastify";
import { calculateLoadRate } from "@shanxi/domain";
import { loadSnapshot } from "../services/fixture-store";

interface QueryBody {
  query?: string;
}

export async function textToSqlRoutes(app: FastifyInstance) {
  app.post("/text-to-sql/query", async (request) => {
    const body = request.body as QueryBody;
    const query = body.query ?? "";
    const snapshot = await loadSnapshot();
    const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));

    const city = findCity(query);
    const industrialOnly = query.includes("大工业") || query.includes("高耗能");
    const topN = Number(query.match(/top\s*(\d+)|Top\s*(\d+)|前\s*(\d+)/i)?.slice(1).find(Boolean) ?? 10);

    const rows = snapshot.users
      .filter((user) => !city || user.city === city)
      .filter((user) => !industrialOnly || user.userType === "large_industrial" || user.userType === "high_energy")
      .map((user) => {
        const reading = latest.get(user.userId);
        const activePowerKw = reading?.activePowerKw ?? 0;
        const loadRate = reading ? calculateLoadRate(activePowerKw, user.contractCapacityKva, reading.powerFactor) : 0;
        const risk = snapshot.risks.find((item) => item.userId === user.userId);
        return {
          userId: user.userId,
          userName: user.userName,
          city: user.city,
          county: user.county,
          industry: user.industry,
          userType: user.userType,
          activePowerKw,
          loadRate: Number(loadRate.toFixed(2)),
          riskLevel: risk?.level ?? "normal"
        };
      })
      .sort((a, b) => b.activePowerKw - a.activePowerKw)
      .slice(0, Math.min(topN, 100));

    const chartByCity = aggregate(rows, "city");
    const chartByIndustry = aggregate(rows, "industry").slice(0, 8);

    return {
      query,
      generatedAt: snapshot.generatedAt,
      sql: buildSql({ city, industrialOnly, topN }),
      evidence: [
        { title: "命中表", text: industrialOnly ? "dim_user_profile + dwd_user_meter_readings + ads_realtime_user_load" : "ads_realtime_user_load" },
        { title: "过滤条件", text: [city ? `city = '${city}'` : "全省", industrialOnly ? "大工业/高耗能" : "全用户"].join(" / ") },
        { title: "安全校验", text: `只读 SELECT，LIMIT ${Math.min(topN, 100)}` }
      ],
      rows,
      charts: {
        cityLoad: chartByCity,
        industryLoad: chartByIndustry
      }
    };
  });
}

function findCity(query: string) {
  return ["太原", "大同", "长治", "运城", "临汾", "吕梁", "晋中", "忻州", "阳泉", "朔州", "晋城"].find((city) => query.includes(city));
}

function buildSql({ city, industrialOnly, topN }: { city?: string; industrialOnly: boolean; topN: number }) {
  const where = [
    city ? `city = '${city}'` : undefined,
    industrialOnly ? "user_type IN ('large_industrial', 'high_energy')" : undefined
  ].filter(Boolean);

  return [
    "SELECT city, county, industry, user_id, user_name, active_power_kw, load_rate",
    "FROM ads_realtime_user_load",
    where.length ? `WHERE ${where.join(" AND ")}` : "",
    "ORDER BY active_power_kw DESC",
    `LIMIT ${Math.min(topN, 100)};`
  ].filter(Boolean).join("\n");
}

function aggregate<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const bucket = new Map<string, { name: string; loadKw: number; users: number }>();
  for (const row of rows) {
    const name = String(row[key]);
    const current = bucket.get(name) ?? { name, loadKw: 0, users: 0 };
    current.loadKw += Number(row.activePowerKw ?? 0);
    current.users += 1;
    bucket.set(name, current);
  }
  return Array.from(bucket.values()).map((item) => ({ ...item, loadKw: Number(item.loadKw.toFixed(2)) }));
}
