// Vercel Serverless Function entry point.
// IMPORTANT: this must be the ONLY file in /api — Vercel turns every file
// under /api into a separate Serverless Function. All backend code lives
// in /server and is bundled into this single function at build time.
//
// NOTE: we deliberately do NOT use @hono/node-server/vercel's `handle`.
// Its lazy Readable.toWeb() body bridging hangs on Vercel's pre-buffered
// request streams — every POST mutation timed out after 30s (GET worked).
// This handler buffers the Node request body itself and builds a standard
// Fetch Request, so body parsing is fully under our control. Responses
// (including the SSE stream) are piped back incrementally.

import app from "../server/boot.js";

export const config = {
  maxDuration: 30,
};

const SKIP_REQ_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
]);

export default async function handler(req: any, res: any) {
  try {
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers.host as string) || "localhost";
    const url = proto + "://" + host + req.url;

    // Forward headers (undici recomputes host/content-length)
    const headers = new Headers();
    for (const [key, value] of Object.entries(
      req.headers as Record<string, string | string[] | undefined>,
    )) {
      if (value === undefined || SKIP_REQ_HEADERS.has(key.toLowerCase())) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    // Buffer the request body from the Node stream
    let body: Buffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
      }
      if (chunks.length > 0) body = Buffer.concat(chunks);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
      // @ts-ignore — Node undici requires this when a body is present
      duplex: "half",
    });

    // incoming/outgoing are passed as Hono bindings (same as the adapter does)
    const response = await app.fetch(request, { incoming: req, outgoing: res });

    // Status + headers (set-cookie needs per-value handling)
    res.statusCode = response.status;
    const getSetCookie = (response.headers as any).getSetCookie?.bind(response.headers);
    const cookies: string[] = typeof getSetCookie === "function" ? getSetCookie() : [];
    if (cookies.length > 0) res.setHeader("set-cookie", cookies);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") return;
      res.setHeader(key, value);
    });

    // Stream the response body (keeps SSE alive)
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (error: any) {
    console.error("[api] handler failed:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
    }
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}
