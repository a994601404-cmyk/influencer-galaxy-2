import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { hashtags, hashtagCategories } from "../db/schema.js";
import { eq, and, isNull, or } from "drizzle-orm";

export const hashtagRouter = createRouter({
  // ─── Categories ─────────────────────────────────────────────
  // All categories visible to everyone
  categoryList: publicQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      return db
        .select()
        .from(hashtagCategories)
        .where(eq(hashtagCategories.isTest, isTestTarget))
        .orderBy(hashtagCategories.id);
    }),

  categoryCreate: authedQuery
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().min(1).max(20),
      createdAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db.insert(hashtagCategories).values({
        name: input.name,
        color: input.color,
        isTest: isTestTarget,
        createdAt: input.createdAt,
        createdByUnionId: ctx.user.unionId,
      });
      const row = await db.select().from(hashtagCategories).where(eq(hashtagCategories.id, Number(result[0].insertId))).limit(1);
      return row[0];
    }),

  categoryDelete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isAdmin = ctx.user.role === "admin";
      // Only delete if admin or creator
      const condition = isAdmin
        ? eq(hashtagCategories.id, input.id)
        : and(eq(hashtagCategories.id, input.id), eq(hashtagCategories.createdByUnionId, ctx.user.unionId));
      // Set categoryId to NULL for all hashtags in this category
      await db.update(hashtags).set({ categoryId: null }).where(eq(hashtags.categoryId, input.id));
      await db.delete(hashtagCategories).where(condition);
      return { success: true };
    }),

  // ─── Hashtags ───────────────────────────────────────────────
  // All hashtags visible to everyone
  list: publicQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      return db
        .select()
        .from(hashtags)
        .where(eq(hashtags.isTest, isTestTarget))
        .orderBy(hashtags.id);
    }),

  create: authedQuery
    .input(z.object({
      name: z.string().min(1),
      url: z.string().min(1),
      categoryId: z.number().nullable().optional(),
      createdAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db.insert(hashtags).values({
        name: input.name,
        url: input.url,
        categoryId: input.categoryId || null,
        isTest: isTestTarget,
        createdAt: input.createdAt,
        createdByUnionId: ctx.user.unionId,
      });
      const row = await db.select().from(hashtags).where(eq(hashtags.id, Number(result[0].insertId))).limit(1);
      return row[0];
    }),

  update: authedQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      url: z.string().optional(),
      categoryId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const clean: Record<string, any> = {};
      if (updates.name !== undefined) clean.name = updates.name;
      if (updates.url !== undefined) clean.url = updates.url;
      if (updates.categoryId !== undefined) clean.categoryId = updates.categoryId;
      await db.update(hashtags).set(clean).where(eq(hashtags.id, id));
      const row = await db.select().from(hashtags).where(eq(hashtags.id, id)).limit(1);
      return row[0];
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isAdmin = ctx.user.role === "admin";
      const condition = isAdmin
        ? eq(hashtags.id, input.id)
        : and(eq(hashtags.id, input.id), eq(hashtags.createdByUnionId, ctx.user.unionId));
      await db.delete(hashtags).where(condition);
      return { success: true };
    }),
});
