import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2";
import { calculateLoadRate } from "@shanxi/domain";
import { loadSnapshot } from "../services/fixture-store";
import { queryStarRocks, type DataSourceName } from "../services/starrocks";

interface QueryBody {
  query?: string;
}

export async function textToSqlRoutes(app: FastifyInstance) {
  app.post("/text-to-sql/query", async (request) => {
    const body = request.body as QueryBody;
    const query = body.query ?? "";
    const city = findCity(query);
    const industrialOnly = query.includes("大工业") || query.includes("高耗能");
    const topN = Number(query.match(/top\s*(\d+)|Top\s*(\d+)|前\s*(\d+)/i)?.slice(1).find(Boolean) ?? 10);
    const result = await starrocksRows({ city, industrialOnly, topN }).catch(() => fixtureRows({ city, industrialOnly, topN }));
    const { rows, generatedAt, dataSource } = result;

    const chartByCity = aggregate(rows, "city");
    const chartByIndustry = aggregate(rows, "industry").slice(0, 8);

    return {
      query,
      dataSource,
      generatedAt,
      sql: buildSql({ city, industrialOnly, topN }),
      evidence: [
        { title: "命中表", text: dataSource === "starrocks_internal" ? "StarRocks 内表 ads_realtime_user_load" : "fixture fallback ads_realtime_user_load" },
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

interface TextRow extends RowDataPacket {
  userId: string;
  userName: string;
  city: string;
  county: string;
  industry: string;
  userType: string;
  activePowerKw: number;
  loadRate: number;
  riskLevel: string;
  generatedAt: string;
}

async function starrocksRows({ city, industrialOnly, topN }: { city?: string; industrialOnly: boolean; topN: number }) {
  const where = [
    city ? "city = ?" : undefined,
    industrialOnly ? "user_type IN ('large_industrial', 'high_energy')" : undefined
  ].filter(Boolean).join(" AND ");
  const rows = await queryStarRocks<TextRow>(`
    SELECT
      user_id AS userId,
      user_name AS userName,
      city,
      county,
      industry,
      user_type AS userType,
      active_power_kw AS activePowerKw,
      load_rate AS loadRate,
      risk_level AS riskLevel,
      CAST(generated_at AS CHAR) AS generatedAt
    FROM ads_realtime_user_load
    ${where ? `WHERE ${where}` : ""}
    ORDER BY active_power_kw DESC
    LIMIT ${Math.min(topN, 100)}
  `, city ? [city] : []);
  return {
    dataSource: "starrocks_internal" satisfies DataSourceName,
    generatedAt: rows[0]?.generatedAt ?? new Date().toISOString(),
    rows: rows.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      city: row.city,
      county: row.county,
      industry: row.industry,
      userType: row.userType,
      activePowerKw: Number(row.activePowerKw),
      loadRate: Number(row.loadRate),
      riskLevel: row.riskLevel
    }))
  };
}

async function fixtureRows({ city, industrialOnly, topN }: { city?: string; industrialOnly: boolean; topN: number }) {
  const snapshot = await loadSnapshot();
  const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
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
  return {
    dataSource: "fixture_fallback" satisfies DataSourceName,
    generatedAt: snapshot.generatedAt,
    rows
  };
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
