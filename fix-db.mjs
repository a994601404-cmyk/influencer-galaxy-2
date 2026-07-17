import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

// Parse the URL to extract connection params
const parsed = new URL(url);
const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port || 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
});

const tables = [
  "campaignInfluencers",
  "campaigns",
  "storyboards",
  "scripts",
  "trendingTopics",
  "influencers",
  "users",
];

for (const table of tables) {
  try {
    await conn.execute(`DROP TABLE IF EXISTS ${table}`);
    console.log(`Dropped ${table}`);
  } catch (e) {
    console.log(`Error dropping ${table}: ${e.message}`);
  }
}

try {
  await conn.execute("DROP TABLE IF EXISTS __drizzle_migrations");
  console.log("Dropped __drizzle_migrations");
} catch (e) {
  console.log("No __drizzle_migrations table");
}

await conn.end();
console.log("Done");
