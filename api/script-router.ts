import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { scripts, storyboards } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { generateScript } from "./ai-service";

const listInput = z.object({
  userId: z.number().optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

export const scriptRouter = createRouter({
  list: publicQuery
    .input(listInput.optional())
    .query(async ({ input }) => {
      const db = getDb();
      const userId = input?.userId;
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const where = userId ? eq(scripts.userId, userId) : undefined;

      const items = await db
        .select()
        .from(scripts)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(scripts.createdAt));

      return items;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(scripts)
        .where(eq(scripts.id, input.id))
        .limit(1);

      if (!result[0]) return null;

      const sbs = await db
        .select()
        .from(storyboards)
        .where(eq(storyboards.scriptId, input.id))
        .orderBy(storyboards.sceneIndex);

      return { ...result[0], storyboards: sbs };
    }),

  create: publicQuery
    .input(
      z.object({
        userId: z.number(),
        influencerId: z.number(),
        productName: z.string().min(1),
        productCategory: z.string().optional(),
        sellingPoints: z.string().min(1),
        personaStyle: z.enum(["koc_share", "expert_review", "lifestyle_vlog", "comedy", "educational"]).default("koc_share"),
        duration: z.number().default(60),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(scripts).values({
        ...input,
        scriptContent: JSON.stringify({ segments: [] }),
        status: "draft",
      });
      return result;
    }),

  generate: publicQuery
    .input(z.object({
      userId: z.number().default(1),
      influencerId: z.number(),
      productName: z.string().min(1),
      productCategory: z.string().optional(),
      sellingPoints: z.string().min(1),
      personaStyle: z.enum(["koc_share", "expert_review", "lifestyle_vlog", "comedy", "educational"]).default("koc_share"),
      duration: z.number().default(60),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Step 1: Create script entry
      await db.insert(scripts).values({
        userId: input.userId,
        influencerId: input.influencerId,
        productName: input.productName,
        productCategory: input.productCategory,
        sellingPoints: input.sellingPoints,
        personaStyle: input.personaStyle,
        duration: input.duration,
        scriptContent: JSON.stringify({ segments: [] }),
        status: "generating",
      });

      // Get the inserted ID
      const inserted = await db
        .select()
        .from(scripts)
        .where(eq(scripts.userId, input.userId))
        .orderBy(desc(scripts.createdAt))
        .limit(1);

      const scriptId = inserted[0]?.id;
      if (!scriptId) throw new Error("Failed to create script");

      // Step 2: Generate with AI
      const generated = await generateScript(
        scriptId,
        input.productName,
        input.sellingPoints,
        input.personaStyle,
        input.duration,
        input.influencerId
      );

      return { ...generated, scriptId };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        productName: z.string().optional(),
        productCategory: z.string().optional(),
        sellingPoints: z.string().optional(),
        personaStyle: z.enum(["koc_share", "expert_review", "lifestyle_vlog", "comedy", "educational"]).optional(),
        duration: z.number().optional(),
        scriptContent: z.string().optional(),
        status: z.enum(["draft", "generating", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(scripts).set(data).where(eq(scripts.id, id));
      const result = await db.select().from(scripts).where(eq(scripts.id, id)).limit(1);
      return result[0];
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(storyboards).where(eq(storyboards.scriptId, input.id));
      await db.delete(scripts).where(eq(scripts.id, input.id));
      return { success: true };
    }),
});
