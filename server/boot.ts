import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { env } from "./lib/env.js";
import { createOAuthCallbackHandler } from "./kimi/auth.js";
import { Paths } from "../contracts/constants.js";
import { addConnection, removeConnection } from "./sse-manager.js";
import { Buffer } from "buffer";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// Global CORS — must come BEFORE route handlers
// Hono's "/*" matches ALL paths including multi-level like /api/trpc/influencer.create
app.use("/*", cors({
  origin: (origin) => {
    if (!origin) return "*";
    if (origin.match(/^https:\/\/[a-z0-9-]+\.ok\.kimi\.link$/i)) return origin;
    if (origin.includes("localhost")) return origin;
    if (origin.includes("kimi.site")) return origin;
    return "*";
  },
  allowHeaders: ["Content-Type", "Authorization", "x-local-auth-meta", "x-local-auth-token"],
  allowMethods: ["POST", "GET", "OPTIONS"],
  credentials: true,
  exposeHeaders: ["x-local-auth-meta", "x-local-auth-token"],
}));

// SSE endpoint for real-time notifications
// Registered BEFORE tRPC catch-all to avoid being intercepted
app.get("/api/sse/notifications", async (c) => {
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token");
  if (!token) return c.json({ error: "Missing token" }, 401);

  // Decode base64 auth meta from token param
  let unionId: string;
  try {
    const meta = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    unionId = `local_${meta.email}`;
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      // Send heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Store connection
      const writer = new WritableStream({
        write(chunk) { controller.enqueue(chunk); },
        close() { clearInterval(heartbeat); },
        abort() { clearInterval(heartbeat); },
      });
      const conn = { writer: writer.getWriter(), unionId, connectedAt: Date.now() };
      addConnection(unionId, conn);

      // Clean up on close
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeConnection(unionId, conn);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

// tRPC handler — match ALL HTTP methods including OPTIONS
app.all("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // Surface the underlying cause (e.g. DB connection errors) in Vercel logs
      console.error(`[trpc] ${path ?? "unknown"} failed:`, error.cause ?? error);
    },
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// Production server startup (only for standalone Node.js deployment, NOT Vercel)
if (env.isProduction && !process.env.VERCEL) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite.js");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
