// Vercel Serverless Function entry point.
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
