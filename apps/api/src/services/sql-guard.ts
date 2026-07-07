export type SqlGuardResult = { ok: true } | { ok: false; reason: string };

export function validateReadOnlySql(sql: string): SqlGuardResult {
  const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized.startsWith("select ")) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/.test(normalized)) {
    return { ok: false, reason: "Mutation and DDL keywords are not allowed" };
  }
  const limit = normalized.match(/\blimit\s+(\d+)\b/);
  if (!limit || Number(limit[1]) > 1000) {
    return { ok: false, reason: "SELECT statements must include LIMIT <= 1000" };
  }
  return { ok: true };
}
