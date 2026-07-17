import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../db/schema.js";
import { authenticateRequest } from "./kimi/auth.js";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  testMode: boolean; // true when x-test-mode header is set
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const isTestMode = opts.req.headers.get("x-test-mode") === "1";
  const ctx: TrpcContext = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    testMode: isTestMode,
  };

  // Server-trusted identity comes ONLY from the signed session cookie
  // (Kimi OAuth or email/password login — both mint the same JWT).
  // Never trust client-supplied identity headers.
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // No valid session — request proceeds unauthenticated.
  }

  return ctx;
}
