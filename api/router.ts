import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { influencerRouter } from "./influencer-router";
import { negotiationRouter } from "./negotiation-router";
import { scriptReviewRouter } from "./script-review-router";
import { videoReviewRouter } from "./video-review-router";
import { notificationRouter } from "./notification-router";
import { trendingRouter } from "./trending-router";
import { scriptRouter } from "./script-router";
import { storyboardRouter } from "./storyboard-router";
import { campaignRouter } from "./campaign-router";
import { analyticsRouter } from "./analytics-router";
import { metricsRouter } from "./metrics-router";
import { instagramRouter } from "./instagram-router";
import { socialRouter } from "./social-router";
import { configRouter } from "./config-router";
import { invitationRouter } from "./invitation-router";
import { postRouter } from "./post-router";
import { hashtagRouter } from "./hashtag-router";
import { cardPreferenceRouter } from "./card-preference-router";
import { cardCategoryRouter } from "./card-category-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  diag: publicQuery.query(async () => {
    const mysql = await import("mysql2/promise");
    const url = process.env.DATABASE_URL || "";
    const masked = url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
    const results: Record<string, any> = { envUrl: masked };

    // Parse URL
    const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^\/]+)(?::(\d+))?\/(.+?)(?:\?|$)/);
    if (!m) {
      results.parse = "INVALID_URL";
      return results;
    }
    const [, user, pass, host, port, db] = m;
    results.parsed = { user, host, port: port || "3306", database: db.split("?")[0] };

    // Test direct connection
    try {
      const conn = await mysql.createConnection({
        host, port: parseInt(port || "3306"), user, password: pass,
        database: db.split("?")[0], ssl: { rejectUnauthorized: false },
        connectTimeout: 15000,
      });
      const [r] = await conn.execute("SELECT 1 as ok");
      results.directQuery = "OK: " + JSON.stringify(r[0]);

      const [tables] = await conn.execute("SHOW TABLES");
      results.tables = tables.map((t: any) => Object.values(t)[0]);

      await conn.end();
    } catch (e: any) {
      results.directQuery = "FAIL: " + e.code + " - " + e.message.substring(0, 100);
    }

    // Test pool + Drizzle
    try {
      const { drizzle } = await import("drizzle-orm/mysql2");
      const pool = mysql.createPool({
        host, port: parseInt(port || "3306"), user, password: pass,
        database: db.split("?")[0], ssl: { rejectUnauthorized: false },
        connectionLimit: 2, connectTimeout: 15000,
      });
      const ddb = drizzle(pool, { mode: "default" });
      const { users } = await import("@db/schema");
      const { eq } = await import("drizzle-orm");
      const r = await ddb.select().from(users).where(eq(users.unionId, "local_admin@pulseboost.ai")).limit(1);
      results.drizzleQuery = "OK: " + (r[0]?.name || "no rows");
      await pool.end();
    } catch (e: any) {
      results.drizzleQuery = "FAIL: " + e.message?.substring(0, 150);
    }

    return results;
  }),
  auth: authRouter,
  influencer: influencerRouter,
  negotiation: negotiationRouter,
  scriptReview: scriptReviewRouter,
  videoReview: videoReviewRouter,
  notification: notificationRouter,
  trending: trendingRouter,
  script: scriptRouter,
  storyboard: storyboardRouter,
  campaign: campaignRouter,
  analytics: analyticsRouter,
  metrics: metricsRouter,
  instagram: instagramRouter,
  social: socialRouter,
  config: configRouter,
  invitation: invitationRouter,
  post: postRouter,
  hashtag: hashtagRouter,
  cardPreference: cardPreferenceRouter,
  cardCategory: cardCategoryRouter,
});

export type AppRouter = typeof appRouter;
