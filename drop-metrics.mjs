import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
const parsed = new URL(url);
const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port || 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
});

try {
  await conn.execute("DROP TABLE IF EXISTS influencerMetrics");
  console.log("Dropped influencerMetrics");
} catch (e) {
  console.log("Error:", e.message);
}

await conn.end();
