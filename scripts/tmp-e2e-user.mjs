// TEMPORARY e2e test user setup — DELETE AFTER USE.
// node scripts/tmp-e2e-user.mjs <env-file> <create|cleanup>
import fs from "node:fs";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const [envFile, action] = process.argv.slice(2);
const raw = fs.readFileSync(envFile, "utf8");
const url = raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");
const p = new URL(url);
const conn = await mysql.createConnection({
  host: p.hostname, port: parseInt(p.port || "4000"),
  user: decodeURIComponent(p.username), password: decodeURIComponent(p.password),
  database: p.pathname.slice(1).split("?")[0],
  ssl: { rejectUnauthorized: false }, connectTimeout: 15000,
});

const EMAIL = "verify_e2e@example.com";
const UNION = `local_${EMAIL}`;

if (action === "create") {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync("Test1234!", salt, 64).toString("hex");
  await conn.execute(
    `INSERT INTO users (unionId, name, email, role, passwordHash, passwordSalt)
     VALUES (?, 'E2E验证', ?, 'user', ?, ?)
     ON DUPLICATE KEY UPDATE passwordHash=VALUES(passwordHash), passwordSalt=VALUES(passwordSalt)`,
    [UNION, EMAIL, hash, salt]
  );
  console.log("test user ready: " + EMAIL);
} else if (action === "cleanup") {
  await conn.execute(`DELETE FROM notifications WHERE receiverUnionId = ?`, [UNION]);
  await conn.execute(`DELETE FROM users WHERE unionId = ?`, [UNION]);
  console.log("test user removed");
}
await conn.end();
