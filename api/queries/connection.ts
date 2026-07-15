import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";
import mysql from "mysql2/promise";

const fullSchema = { ...schema, ...relations };

// Parse DATABASE_URL
function parseDbUrl(url: string) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+?)(?:\?|$)/);
  if (!match) throw new Error("Invalid DATABASE_URL format: " + url.substring(0, 30) + "...");
  const [, user, password, host, portStr, database] = match;
  return { user, password, host, port: portStr ? parseInt(portStr) : 3306, database: database.split("?")[0] };
}

// Create mysql2 pool with SSL support for TiDB Cloud
function createPool() {
  const cfg = parseDbUrl(env.databaseUrl);
  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 5,
    queueLimit: 0,
    waitForConnections: true,
    connectTimeout: 30000,
    enableKeepAlive: true,
  });
}

let pool: mysql.Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    pool = createPool();
    instance = drizzle(pool, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}

// Raw mysql2 connection with auto-reconnect
let rawConn: mysql.Connection | null = null;

export async function getRawConnection(): Promise<mysql.Connection> {
  if (rawConn) {
    try {
      await rawConn.execute("SELECT 1");
      return rawConn;
    } catch {
      try { await rawConn.end(); } catch { /* ignore */ }
      rawConn = null;
    }
  }
  const cfg = parseDbUrl(env.databaseUrl);
  rawConn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database,
    ssl: { rejectUnauthorized: false }, connectTimeout: 30000,
  });
  return rawConn;
}
