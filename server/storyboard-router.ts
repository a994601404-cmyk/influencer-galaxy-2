import { z } from "zod";
import { createRouter, publicQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { storyboards } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";

export const storyboardRouter = createRouter({
  getByScript: publicQuery
    .input(z.object({ scriptId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const items = await db
        .select()
        .from(storyboards)
        .where(eq(storyboards.scriptId, input.scriptId))
        .orderBy(asc(storyboards.sceneIndex));
      return items;
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        visualDescription: z.string().optional(),
        audioDescription: z.string().optional(),
        narration: z.string().optional(),
        generatedImageUrl: z.string().optional(),
        status: z.enum(["pending", "generating", "completed", "error"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(storyboards).set(data).where(eq(storyboards.id, id));
      const result = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1);
      return result[0];
    }),

  regenerateImage: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Update status to generating
      await db
        .update(storyboards)
        .set({ status: "generating" })
        .where(eq(storyboards.id, input.id));

      // In a real implementation, this would trigger an AI image generation
      // For demo, we'll mark it as completed after a simulated delay
      await db
        .update(storyboards)
        .set({ status: "completed" })
        .where(eq(storyboards.id, input.id));

      const result = await db.select().from(storyboards).where(eq(storyboards.id, input.id)).limit(1);
      return result[0];
    }),
});
