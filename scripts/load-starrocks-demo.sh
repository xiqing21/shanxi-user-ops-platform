#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose --env-file .env -f deploy/compose/docker-compose.yml --profile lakehouse)

for attempt in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T starrocks mysql -uroot -P9030 -h127.0.0.1 -e "SELECT 1;" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" = "60" ]; then
    echo "ERROR: StarRocks is not ready" >&2
    exit 1
  fi
  sleep 2
done

SQL_FILE="$(mktemp /tmp/guowang-starrocks-load.XXXXXX.sql)"
node > "$SQL_FILE" <<'NODE'
const fs = require("fs");
const snapshot = JSON.parse(fs.readFileSync("data/fixtures/shanxi-snapshot.json", "utf8"));
const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
const risks = new Map(snapshot.risks.map((risk) => [risk.userId, risk]));

function esc(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function dt(value) {
  return String(value).replace("T", " ").replace(/\.\d{3}\+\d{2}:\d{2}$/, "");
}

function loadRate(activePowerKw, capacity) {
  if (!capacity) return 0;
  return Number(((activePowerKw / capacity) * 100).toFixed(2));
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

const ddl = `
CREATE DATABASE IF NOT EXISTS guowang_ads;
USE guowang_ads;

CREATE TABLE IF NOT EXISTS ads_realtime_user_load (
  user_id VARCHAR(64),
  user_name VARCHAR(255),
  city VARCHAR(32),
  county VARCHAR(64),
  industry VARCHAR(64),
  user_type VARCHAR(64),
  contract_capacity_kva DOUBLE,
  transformer_id VARCHAR(64),
  line_id VARCHAR(64),
  tags VARCHAR(512),
  active_power_kw DOUBLE,
  load_rate DOUBLE,
  risk_level VARCHAR(32),
  generated_at DATETIME
) ENGINE=OLAP
DUPLICATE KEY(user_id)
DISTRIBUTED BY HASH(user_id) BUCKETS 8
PROPERTIES ("replication_num" = "1");

CREATE TABLE IF NOT EXISTS ads_realtime_risk_events (
  event_id VARCHAR(96),
  user_id VARCHAR(64),
  user_name VARCHAR(255),
  city VARCHAR(32),
  county VARCHAR(64),
  industry VARCHAR(64),
  user_type VARCHAR(64),
  risk_type VARCHAR(64),
  level VARCHAR(32),
  message VARCHAR(512),
  event_time DATETIME
) ENGINE=OLAP
DUPLICATE KEY(event_id)
DISTRIBUTED BY HASH(event_id) BUCKETS 8
PROPERTIES ("replication_num" = "1");

TRUNCATE TABLE ads_realtime_user_load;
TRUNCATE TABLE ads_realtime_risk_events;
`;

process.stdout.write(ddl);

const loadRows = snapshot.users.map((user) => {
  const reading = latest.get(user.userId) ?? {};
  const risk = risks.get(user.userId);
  const active = Number(reading.activePowerKw ?? 0);
  return [
    esc(user.userId),
    esc(user.userName),
    esc(user.city),
    esc(user.county),
    esc(user.industry),
    esc(user.userType),
    Number(user.contractCapacityKva ?? 0),
    esc(user.transformerId),
    esc(user.lineId),
    esc((user.tags ?? []).join(",")),
    active,
    loadRate(active, Number(user.contractCapacityKva ?? 0)),
    esc(risk?.level ?? "normal"),
    esc(dt(snapshot.generatedAt))
  ].join(",");
});

for (const group of chunks(loadRows, 200)) {
  process.stdout.write(`INSERT INTO ads_realtime_user_load VALUES\n(${group.join("),\n(")});\n`);
}

const users = new Map(snapshot.users.map((user) => [user.userId, user]));
const riskRows = snapshot.risks.map((risk) => {
  const user = users.get(risk.userId) ?? {};
  return [
    esc(risk.eventId),
    esc(risk.userId),
    esc(user.userName ?? risk.userId),
    esc(user.city ?? "未知"),
    esc(user.county ?? "未知"),
    esc(user.industry ?? "未知"),
    esc(user.userType ?? "unknown"),
    esc(risk.riskType),
    esc(risk.level),
    esc(risk.message),
    esc(dt(risk.timestamp))
  ].join(",");
});

for (const group of chunks(riskRows, 200)) {
  process.stdout.write(`INSERT INTO ads_realtime_risk_events VALUES\n(${group.join("),\n(")});\n`);
}
NODE

"${COMPOSE[@]}" exec -T starrocks mysql -uroot -P9030 -h127.0.0.1 < "$SQL_FILE"
rm -f "$SQL_FILE"

"${COMPOSE[@]}" exec -T starrocks mysql -uroot -P9030 -h127.0.0.1 -e "
USE guowang_ads;
SELECT 'ads_realtime_user_load' AS table_name, COUNT(*) AS rows_count FROM ads_realtime_user_load
UNION ALL
SELECT 'ads_realtime_risk_events' AS table_name, COUNT(*) AS rows_count FROM ads_realtime_risk_events;
"
