// Vercel Serverless Function Entry Point
// This file handles all /api/* requests on Vercel

import app from "./boot";

// Node.js runtime is required because mysql2 needs native Node.js modules
export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  // Convert Node.js req to standard Web Request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, String(value));
      }
    }
  }

  // Build body
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const request = new Request(url, {
    method: req.method || "GET",
    headers,
    body,
  });

  try {
    const response = await app.fetch(request);

    // Send response
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
