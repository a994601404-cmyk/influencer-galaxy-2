import * as jose from "jose";
import { env } from "../lib/env.js";
import type { SessionPayload } from "./types.js";

const JWT_ALG = "HS256";

// Sessions are signed with SESSION_SECRET — a dedicated key that exists only
// in Vercel env vars. It is intentionally NOT APP_SECRET (the OAuth client
// secret): APP_SECRET transits more systems and has been handled by humans,
// so it must not be able to mint login sessions.
function getSecret(): Uint8Array {
  if (!env.sessionSecret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    console.warn("[session] No token provided for verification.");
    return null;
  }
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      algorithms: [JWT_ALG],
    });
    const { unionId, clientId } = payload;
    if (!unionId || !clientId) {
      console.warn("[session] JWT payload missing required fields.");
      return null;
    }
    return { unionId, clientId } as SessionPayload;
  } catch (error) {
    console.warn("[session] JWT verification failed:", error);
    return null;
  }
}
