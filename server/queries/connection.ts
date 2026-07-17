import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env.js";
import * as schema from "../../db/schema.js";
import * as relations from "../../db/relations.js";
import mysql from "mysql2/promise";

const fullSchema = { ...schema, ...relations };

// Parse DATABASE_URL into an explicit mysql2 config.
// Hosts like PlanetScale require TLS, but their `sslaccept` URL parameter
// is silently ignored by mysql2 ("Ignoring invalid configuration option"),
// which makes drizzle connect over plaintext and get rejected by the server.
// Translate the URL's SSL intent into a real `ssl` option.
function parseDbUrl(url: string) {
  const u = new URL(url);
  const sslHint =
    u.searchParams.get("sslaccept") ??
    u.searchParams.get("ssl") ??
    u.searchParams.get("sslmode");
  const wantsSsl = !!sslHint && !["false", "disabled"].includes(sslHint.toLowerCase());
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectTimeout: 15000,
    ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (!instance) {
    const pool = mysql.createPool({
      ...parseDbUrl(env.databaseUrl),
      // Serverless: keep the pool tiny so warm instances don't exhaust DB connections
      connectionLimit: 2,
    });
    instance = drizzle(pool, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}

// Raw mysql2 connection for operations that need direct SQL
let rawConn: mysql.Connection | null = null;
export async function getRawConnection(): Promise<mysql.Connection> {
  if (!rawConn) {
    rawConn = await mysql.createConnection(parseDbUrl(env.databaseUrl));
  }
  return rawConn;
}
