import mysql from "mysql2/promise";

export type DataSourceName = "starrocks_internal" | "fixture_fallback";
type SqlValue = string | number | boolean | Date | Buffer | null;

export async function queryStarRocks<T extends mysql.RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T[]> {
  const connection = await mysql.createConnection({
    host: process.env.STARROCKS_MYSQL_HOST ?? "localhost",
    port: Number(process.env.STARROCKS_MYSQL_PORT ?? 9030),
    user: process.env.STARROCKS_USER ?? "root",
    password: process.env.STARROCKS_PASSWORD ?? "",
    database: process.env.STARROCKS_DATABASE ?? "guowang_ads",
    connectTimeout: 1200
  });
  try {
    const [rows] = await connection.execute<T[]>(sql, values);
    return rows;
  } finally {
    await connection.end();
  }
}
