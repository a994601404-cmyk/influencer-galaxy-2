import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

// Use platform-provided DB URL if available (for backend-building platform),
// fallback to .env file value. This handles cases where the platform
// rotates the database endpoint.
function resolveDatabaseUrl(): string {
  // Check if the .env DB URL is still valid (not the privatelink that may be stale)
  const envUrl = process.env.DATABASE_URL ?? "";
  // If platform provides a separate DB URL, use it as primary
  const platformUrl = process.env.PLATFORM_DATABASE_URL ?? process.env.TIDB_URL ?? "";
  if (platformUrl && platformUrl !== envUrl) {
    return platformUrl;
  }
  return envUrl;
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  // Dedicated key for signing login-session JWTs. Deliberately separate from
  // APP_SECRET (OAuth client secret) so a leaked APP_SECRET cannot be used to
  // forge sessions. Generated once, lives only in Vercel env vars.
  sessionSecret: required("SESSION_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: resolveDatabaseUrl(),
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};
