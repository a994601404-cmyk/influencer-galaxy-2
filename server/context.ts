import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../db/schema.js";
import { authenticateRequest } from "./kimi/auth.js";
import { findUserByUnionId, upsertUser } from "./queries/users.js";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  testMode: boolean; // true when x-test-mode header is set
};

// Additional user info from local auth header (x-local-auth-meta)
// Format: base64(JSON({ name, email, role }))
function resolveLocalAuthMeta(headers: Headers): { name: string; email: string; role: string } | undefined {
  const meta = headers.get("x-local-auth-meta");
  if (!meta) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(meta, "base64").toString("utf-8"));
    if (parsed && parsed.email && parsed.role) return parsed;
  } catch { /* ignore */ }
  return undefined;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const isTestMode = opts.req.headers.get("x-test-mode") === "1";
  const ctx: TrpcContext = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    testMode: isTestMode,
  };

  // Try OAuth first
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // OAuth not available, try local auth
  }

  // Fallback to local auth metadata from header (for localStorage-based login)
  if (!ctx.user) {
    const meta = resolveLocalAuthMeta(opts.req.headers);
    if (meta) {
      const unionId = `local_${meta.email}`;
      // Try find first — only upsert if not found to reduce DB writes
      let dbUser = await findUserByUnionId(unionId);
      if (!dbUser) {
        // First time seeing this user — sync to DB with atomic upsert
        dbUser = await upsertUser({
          unionId,
          name: meta.name || meta.email.split("@")[0],
          email: meta.email,
          avatar: null,
          role: meta.role as "user" | "admin",
        });
      }
      if (dbUser) ctx.user = dbUser;
    }
  }

  return ctx;
}
