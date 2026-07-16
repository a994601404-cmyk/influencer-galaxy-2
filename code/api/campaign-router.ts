import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { campaigns, campaignInfluencers, influencers } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

const listInput = z.object({
  userId: z.number().optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

export const campaignRouter = createRouter({
  list: publicQuery
    .input(listInput.optional())
    .query(async ({ input }) => {
      const db = getDb();
      const userId = input?.userId;
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const where = userId ? eq(campaigns.userId, userId) : undefined;

      const items = await db
        .select()
        .from(campaigns)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(campaigns.createdAt));

      return items;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!result[0]) return null;

      const ci = await db
        .select()
        .from(campaignInfluencers)
        .where(eq(campaignInfluencers.campaignId, input.id));

      const influencerIds = ci.map((c) => c.influencerId);
      const infData = influencerIds.length > 0
        ? await db.select().from(influencers).where(sql`${influencers.id} IN (${influencerIds.join(",")})`)
        : [];

      const ciWithInfluencers = ci.map((c) => ({
        ...c,
        influencer: infData.find((i) => i.id === c.influencerId),
      }));

      return { ...result[0], influencers: ciWithInfluencers };
    }),

  create: publicQuery
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        budget: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(campaigns).values({
        ...input,
        status: "draft",
        budget: input.budget || "0",
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
      return result;
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
        budget: z.string().optional(),
        spent: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, startDate, endDate, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
      const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
      return result[0];
    }),

  addInfluencer: publicQuery
    .input(
      z.object({
        campaignId: z.number(),
        influencerId: z.number(),
        scriptId: z.number().optional(),
        fee: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(campaignInfluencers).values({
        campaignId: input.campaignId,
        influencerId: input.influencerId,
        scriptId: input.scriptId,
        fee: input.fee || "0",
        status: "pending",
      });
      return result;
    }),

  updateInfluencerStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "content_sent", "published", "completed"]),
        performanceData: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(campaignInfluencers).set(data).where(eq(campaignInfluencers.id, id));
      const result = await db.select().from(campaignInfluencers).where(eq(campaignInfluencers.id, id)).limit(1);
      return result[0];
    }),
});
