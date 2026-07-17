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
  connectTimeout: 30000,
  multipleStatements: true,
});

await conn.execute("DELETE FROM influencerMetrics");

const influencerIds = [1, 2, 3, 4, 5, 6, 7];
const baseValues = {
  1: { followers: 520000, engagement: 4.20 },
  2: { followers: 890000, engagement: 5.80 },
  3: { followers: 310000, engagement: 3.90 },
  4: { followers: 1200000, engagement: 6.10 },
  5: { followers: 680000, engagement: 5.30 },
  6: { followers: 450000, engagement: 4.70 },
  7: { followers: 920000, engagement: 4.50 },
};

let sql = "";
for (const infId of influencerIds) {
  const base = baseValues[infId];
  for (let day = 29; day >= 0; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(12, 0, 0, 0);
    const growthFactor = 1 + (29 - day) * 0.002;
    const r = 0.95 + Math.random() * 0.1;
    const followers = Math.floor(base.followers * growthFactor * r);
    const engagement = (base.engagement * (0.9 + Math.random() * 0.2)).toFixed(2);
    const likes = Math.floor(followers * (Number(engagement) / 100) * (0.5 + Math.random() * 0.4));
    const comments = Math.floor(likes * 0.15 * (0.8 + Math.random() * 0.4));
    const views = Math.floor(followers * 2.5 * (0.8 + Math.random() * 0.4));
    const d = date.toISOString().slice(0, 19).replace("T", " ");
    sql += `INSERT INTO influencerMetrics (influencerId, metricType, value, recordAt) VALUES (${infId}, 'followers', ${followers}, '${d}'),(${infId}, 'engagement_rate', ${engagement}, '${d}'),(${infId}, 'likes', ${likes}, '${d}'),(${infId}, 'comments', ${comments}, '${d}'),(${infId}, 'views', ${views}, '${d}');`;
  }
}

await conn.query(sql);
await conn.end();
console.log("Seeded metrics for 7 influencers x 30 days");
