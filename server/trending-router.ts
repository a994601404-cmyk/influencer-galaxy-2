import { z } from "zod";
import { createRouter, publicQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { trendingTopics } from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";

const listInput = z.object({
  platform: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export const trendingRouter = createRouter({
  list: publicQuery
    .input(listInput.optional())
    .query(async ({ input }) => {
      const db = getDb();
      const platform = input?.platform;
      const category = input?.category;
      const limit = input?.limit ?? 20;

      const conditions = [];

      if (platform && platform !== "all") {
        conditions.push(eq(trendingTopics.platform, platform as "instagram" | "tiktok" | "xiaohongshu" | "douyin" | "weibo"));
      }
      if (category && category !== "all") {
        conditions.push(eq(trendingTopics.category, category));
      }

      const where = conditions.length > 0 ? sql`${conditions.join(" AND ")}` : undefined;

      const items = await db
        .select()
        .from(trendingTopics)
        .where(where)
        .limit(limit)
        .orderBy(desc(trendingTopics.heat));

      return items;
    }),

  getCategories: publicQuery.query(async () => {
    const db = getDb();
    const result = await db
      .selectDistinct({ category: trendingTopics.category })
      .from(trendingTopics)
      .where(sql`${trendingTopics.category} IS NOT NULL`);
    return result.map((r) => r.category).filter(Boolean);
  }),
});
