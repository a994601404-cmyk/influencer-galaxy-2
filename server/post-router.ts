import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { postRecords } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

export const postRouter = createRouter({
  // List post records for an influencer
  list: publicQuery
    .input(z.object({ influencerId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db
        .select()
        .from(postRecords)
        .where(and(
          eq(postRecords.influencerId, input.influencerId),
          eq(postRecords.isTest, isTestTarget)
        ))
        .orderBy(desc(postRecords.createdAt));
      return result;
    }),

  // Create a post record
  create: authedQuery
    .input(z.object({
      influencerId: z.number(),
      videoUrl: z.string().min(1),
      nextDayExposures: z.number().default(0),
      sevenDayExposures: z.number().default(0),
      likes: z.number().default(0),
      comments: z.number().default(0),
      shares: z.number().default(0),
      notes: z.string().optional(),
      createdAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db.insert(postRecords).values({
        influencerId: input.influencerId,
        videoUrl: input.videoUrl,
        nextDayExposures: input.nextDayExposures,
        sevenDayExposures: input.sevenDayExposures,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        notes: input.notes || null,
        isTest: isTestTarget,
        createdAt: input.createdAt,
        createdByUnionId: ctx.user.unionId,
      });
      const insertId = Number(result[0].insertId);
      const row = await db.select().from(postRecords).where(eq(postRecords.id, insertId)).limit(1);
      return row[0];
    }),

  // Update a post record
  update: authedQuery
    .input(z.object({
      id: z.number(),
      videoUrl: z.string().optional(),
      nextDayExposures: z.number().optional(),
      sevenDayExposures: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const cleanUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      await db.update(postRecords).set(cleanUpdates).where(eq(postRecords.id, id));
      const row = await db.select().from(postRecords).where(eq(postRecords.id, id)).limit(1);
      return row[0];
    }),

  // Delete a post record
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(postRecords).where(eq(postRecords.id, input.id));
      return { success: true };
    }),

  // List all post records (for analytics)
  listAll: publicQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db
        .select()
        .from(postRecords)
        .where(eq(postRecords.isTest, isTestTarget))
        .orderBy(desc(postRecords.createdAt));
      return result;
    }),
});
