#!/usr/bin/env node
/**
 * apply-vercel-fixes.mjs — 一键恢复 Vercel 部署所需的全部修复。
 *
 * 背景：Kimi 平台同步会覆盖本仓库，把以下针对 Vercel 的修复冲掉，导致
 * Vercel 部署失败（ERR_MODULE_NOT_FOUND / DB SSL / 函数打包错误等）。
 * 每次从平台同步代码后，在本仓库根目录运行：
 *
 *   node scripts/apply-vercel-fixes.mjs          # 应用修复并校验
 *   node scripts/apply-vercel-fixes.mjs check    # 只校验不修改
 *
 * 脚本是幂等的：已经修好的项目会全部显示 ok，不会产生任何改动。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv[2] === "check";

let changed = 0, okCount = 0, failed = 0;
const ok = (m) => { okCount++; console.log("  ok    " + m); };
const fix = (m) => { changed++; console.log("  FIXED " + m); };
const warn = (m) => { failed++; console.log("  WARN  " + m); };

function ensureFile(rel, content, label) {
  const p = path.join(ROOT, rel);
  const existing = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  if (existing === content) return ok(label + " 已是目标状态");
  if (CHECK_ONLY) return warn(label + " 需要修复（运行不带 check 参数以应用）");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  fix(label + " 已写入标准内容");
}

// ─── 1. vercel.json ─────────────────────────────────────────
const VERCEL_JSON = `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "vite build",
  "outputDirectory": "dist/public",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/index"
    },
    {
      "source": "/assets/:path*",
      "destination": "/assets/:path*"
    },
    {
      "source": "/([^./]+)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
`;

// ─── 2. api/index.ts（/api 下唯一文件，Vercel 单函数入口）────
const API_INDEX_TS = `// Vercel Serverless Function entry point.
// IMPORTANT: this must be the ONLY file in /api — Vercel turns every file
// under /api into a separate Serverless Function. All backend code lives
// in /server and is bundled into this single function at build time.

import { handle } from "@hono/node-server/vercel";
import app from "../server/boot.js";

// Node.js runtime is required because mysql2 needs native Node.js modules
export const config = {
  maxDuration: 30,
};

export default handle(app);
`;

// ─── 3. tsconfig.server.json ────────────────────────────────
const TSCONFIG_SERVER = `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@contracts/*": ["./contracts/*"],
      "@db/*": ["./db/*"]
    }
  },
  "include": ["api", "server", "contracts", "db"]
}
`;

console.log("\n[1] 标准配置文件");
ensureFile("vercel.json", VERCEL_JSON, "vercel.json");
ensureFile("api/index.ts", API_INDEX_TS, "api/index.ts");
if (!fs.existsSync(path.join(ROOT, "tsconfig.server.json"))) {
  ensureFile("tsconfig.server.json", TSCONFIG_SERVER, "tsconfig.server.json");
} else ok("tsconfig.server.json 存在");

// /api 下不应有除 index.ts 以外的文件
const apiExtra = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f !== "index.ts");
if (apiExtra.length > 0) warn("/api 下存在多余文件（会导致 Vercel 拆成多个函数）: " + apiExtra.join(", "));
else ok("/api 仅含 index.ts");

// ─── 4. 相对导入 .js 扩展名 codemod ─────────────────────────
// Vercel 用 nodenext 语义编译 serverless 函数，相对导入必须显式带 .js
console.log("\n[2] 相对导入 .js 扩展名（server/ db/ contracts/ api/）");
const SCAN_DIRS = ["server", "db", "contracts", "api"];
const IMPORT_RE = /(from\s*|import\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

function listTs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTs(p));
    else if (entry.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let patchedFiles = 0, patchedSpecs = 0, unresolved = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const file of listTs(abs)) {
    const src = fs.readFileSync(file, "utf8");
    let touched = 0;
    const next = src.replace(IMPORT_RE, (whole, prefix, quote, spec) => {
      if (/\.(js|json|css|ts|tsx|mjs|cjs)$/.test(spec)) return whole;
      const base = path.resolve(path.dirname(file), spec);
      let rep = null;
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        if (fs.existsSync(path.join(base, "index.ts"))) rep = spec + "/index.js";
      } else if (fs.existsSync(base + ".ts")) {
        rep = spec + ".js";
      }
      if (rep) { touched++; return `${prefix}${quote}${rep}${quote}`; }
      unresolved.push(`${path.relative(ROOT, file)}: ${spec}`);
      return whole;
    });
    if (touched > 0) {
      patchedFiles++; patchedSpecs += touched;
      if (!CHECK_ONLY) fs.writeFileSync(file, next);
    }
  }
}
if (patchedSpecs > 0) fix(`补齐 ${patchedSpecs} 处导入扩展名（${patchedFiles} 个文件）${CHECK_ONLY ? "（check 模式未写入）" : ""}`);
else ok("所有相对导入均已带 .js 扩展名");
if (unresolved.length > 0) warn("无法自动解析的导入（请人工检查）: " + unresolved.join(" | "));

// ─── 5. server/queries/connection.ts — TiDB 强制 TLS ───────
console.log("\n[3] 数据库连接 SSL（TiDB 要求）");
const CONN = path.join(ROOT, "server/queries/connection.ts");
const CONNECTION_TS = `import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env.js";
import * as schema from "../../db/schema.js";
import * as relations from "../../db/relations.js";
import mysql from "mysql2/promise";

const fullSchema = { ...schema, ...relations };

// Parse DATABASE_URL
function parseDbUrl(url: string) {
  const match = url.match(/mysql:\\/\\/([^:]+):([^@]+)@([^:\\/]+)(?::(\\d+))?\\/(.+?)(?:\\?|$)/);
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
`;
if (fs.existsSync(CONN) && fs.readFileSync(CONN, "utf8").includes("rejectUnauthorized")) {
  ok("connection.ts 已启用 SSL");
} else {
  ensureFile("server/queries/connection.ts", CONNECTION_TS, "connection.ts (SSL)");
}

// ─── 6. server/kimi/auth.ts — JWKS 懒加载 ───────────────────
console.log("\n[4] Kimi JWKS 懒加载（冷启动保护）");
const KAUTH = path.join(ROOT, "server/kimi/auth.ts");
const kauth = fs.existsSync(KAUTH) ? fs.readFileSync(KAUTH, "utf8") : "";
if (kauth.includes("getJwks")) {
  ok("kimi/auth.ts JWKS 已是懒加载");
} else if (CHECK_ONLY) {
  warn("kimi/auth.ts 需要恢复 JWKS 懒加载（参考 git 历史或 HANDOVER.md）");
} else {
  // 平台版常见写法：顶层 const jwks = jose.createRemoteJWKSet(new URL(...))
  const topLevel = /const jwks = jose\.createRemoteJWKSet\(\s*new URL\(`\$\{env\.kimiAuthUrl\}\/api\/\.well-known\/jwks\.json`\),?\s*\);?/;
  if (topLevel.test(kauth)) {
    const lazy = `// Lazy init: creating the JWKS at module top level crashes the entire
// serverless function on cold start when KIMI_AUTH_URL is not configured.
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | undefined;
function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(
      new URL(\`\${env.kimiAuthUrl}/api/.well-known/jwks.json\`),
    );
  }
  return jwks;
}`;
    let next = kauth.replace(topLevel, lazy);
    next = next.replace(/jwtVerify\(accessToken, jwks\)/, "jwtVerify(accessToken, getJwks())");
    fs.writeFileSync(KAUTH, next);
    fix("kimi/auth.ts 已改为 JWKS 懒加载");
  } else {
    warn("kimi/auth.ts 结构不识别，请人工恢复 JWKS 懒加载（git show backup 分支或 HANDOVER.md）");
  }
}

// ─── 7. server/boot.ts — tRPC onError 日志 ──────────────────
console.log("\n[5] tRPC onError 日志");
const BOOT = path.join(ROOT, "server/boot.ts");
const boot = fs.existsSync(BOOT) ? fs.readFileSync(BOOT, "utf8") : "";
if (boot.includes("onError")) {
  ok("boot.ts tRPC 已带 onError 日志");
} else if (CHECK_ONLY) {
  warn("boot.ts 缺少 tRPC onError 日志");
} else {
  const anchor = /(fetchRequestHandler\(\{[\s\S]*?createContext,)\s*\}\)/;
  if (anchor.test(boot)) {
    const next = boot.replace(anchor, `$1
      onError({ path, error }) {
        // Surface the underlying cause (e.g. DB connection errors) in Vercel logs
        console.error(\`[trpc] \${path ?? "unknown"} failed:\`, error.cause ?? error);
      },
    })`);
    fs.writeFileSync(BOOT, next);
    fix("boot.ts 已添加 tRPC onError 日志");
  } else {
    warn("boot.ts fetchRequestHandler 结构不识别，请人工添加 onError");
  }
}

// ─── 8. .env 泄露检测 ───────────────────────────────────────
console.log("\n[6] 敏感文件检测");
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  if (/DATABASE_URL|APP_SECRET/.test(envContent)) {
    warn(".env 含生产密钥！禁止提交 git，禁止部署到 Vercel（密钥应只存在于 Vercel 环境变量）。请删除 .env。");
  } else {
    ok(".env 存在但不含敏感项");
  }
} else ok("无 .env 文件");

// ─── 汇总 ───────────────────────────────────────────────────
console.log(`\n结果: ${okCount} 项正常, ${changed} 项已修复, ${failed} 项需人工处理`);
if (failed > 0) process.exit(1);
console.log("可以安全执行 git push（Vercel 将自动部署）。\n");
