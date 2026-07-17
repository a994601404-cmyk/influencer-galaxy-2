import { z } from "zod";
import { createRouter, publicQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { influencerMetrics } from "../db/schema.js";
import { eq, and, desc, gte } from "drizzle-orm";

export const metricsRouter = createRouter({
  getByInfluencer: publicQuery
    .input(z.object({
      influencerId: z.number(),
      metricType: z.string().optional(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);

      const conditions = [
        eq(influencerMetrics.influencerId, input.influencerId),
        gte(influencerMetrics.recordedAt, cutoff),
      ];
      if (input.metricType && input.metricType !== "all") {
        conditions.push(eq(influencerMetrics.metricType, input.metricType as "followers" | "engagement_rate" | "likes" | "comments" | "shares" | "views"));
      }

      const items = await db
        .select()
        .from(influencerMetrics)
        .where(and(...conditions))
        .orderBy(influencerMetrics.recordedAt);

      return items;
    }),

  getLatest: publicQuery
    .input(z.object({
      influencerId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const types = ["followers", "engagement_rate", "likes", "comments", "views"];
      const latest: Record<string, { value: number; recordedAt: Date }> = {};

      for (const type of types) {
        const [row] = await db
          .select()
          .from(influencerMetrics)
          .where(and(
            eq(influencerMetrics.influencerId, input.influencerId),
            eq(influencerMetrics.metricType, type as any)
          ))
          .orderBy(desc(influencerMetrics.recordedAt))
          .limit(1);

        if (row) {
          latest[type] = {
            value: Number(row.value),
            recordedAt: row.recordedAt,
          };
        }
      }

      return latest;
    }),

  getGrowthSummary: publicQuery
    .input(z.object({
      influencerId: z.number(),
      days: z.number().default(30),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);

      const types = ["followers", "engagement_rate", "likes", "comments", "views"];
      const summary: Record<string, { current: number; previous: number; change: number; changePct: string }> = {};

      for (const type of types) {
        const [latest] = await db
          .select()
          .from(influencerMetrics)
          .where(and(
            eq(influencerMetrics.influencerId, input.influencerId),
            eq(influencerMetrics.metricType, type as any)
          ))
          .orderBy(desc(influencerMetrics.recordedAt))
          .limit(1);

        const [oldest] = await db
          .select()
          .from(influencerMetrics)
          .where(and(
            eq(influencerMetrics.influencerId, input.influencerId),
            eq(influencerMetrics.metricType, type as any),
            gte(influencerMetrics.recordedAt, cutoff)
          ))
          .orderBy(influencerMetrics.recordedAt)
          .limit(1);

        const current = Number(latest?.value || 0);
        const previous = Number(oldest?.value || current);
        const change = current - previous;
        const changePct = previous > 0 ? ((change / previous) * 100).toFixed(1) : "0";

        summary[type] = { current, previous, change, changePct };
      }

      return summary;
    }),

  record: publicQuery
    .input(z.object({
      influencerId: z.number(),
      metricType: z.enum(["followers", "engagement_rate", "likes", "comments", "shares", "views"]),
      value: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(influencerMetrics).values({
        influencerId: input.influencerId,
        metricType: input.metricType,
        value: String(input.value),
      });
      return { success: true };
    }),
});
