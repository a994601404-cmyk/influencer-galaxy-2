// ─── API Configuration Router ─────────────────────────────────
// Manage RapidAPI keys for Instagram / TikTok / YouTube
// Only admins can write; all authenticated users can read status

import { z } from "zod";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { apiConfigs } from "@db/schema";
import { eq } from "drizzle-orm";

const db = getDb();

export const configRouter = createRouter({
  // List all API configs (admin sees full keys, others see masked)
  list: publicQuery.query(async ({ ctx }) => {
    const rows = await db.select().from(apiConfigs);
    const isAdmin = ctx.user?.role === "admin";
    return rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      apiHost: r.apiHost,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      // Only admin sees full key; others see masked version
      apiKey: isAdmin ? r.apiKey : maskKey(r.apiKey),
    }));
  }),

  // Get a single config
  get: publicQuery
    .input(z.object({ platform: z.string() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(apiConfigs)
        .where(eq(apiConfigs.platform, input.platform))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Upsert API config (admin only)
  upsert: adminQuery
    .input(
      z.object({
        platform: z.enum(["instagram", "tiktok", "youtube"]),
        apiKey: z.string().min(1, "API Key is required"),
        apiHost: z.string().min(1, "API Host is required"),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db
        .select()
        .from(apiConfigs)
        .where(eq(apiConfigs.platform, input.platform))
        .limit(1);

      if (existing.length > 0) {
        // Update
        await db
          .update(apiConfigs)
          .set({
            apiKey: input.apiKey,
            apiHost: input.apiHost,
            isActive: input.isActive ? 1 : 0,
            updatedAt: new Date(),
          })
          .where(eq(apiConfigs.platform, input.platform));
      } else {
        // Insert
        await db.insert(apiConfigs).values({
          platform: input.platform,
          apiKey: input.apiKey,
          apiHost: input.apiHost,
          isActive: input.isActive ? 1 : 0,
        });
      }

      return { success: true, platform: input.platform };
    }),

  // Toggle active status (admin only)
  toggle: adminQuery
    .input(z.object({ platform: z.string() }))
    .mutation(async ({ input }) => {
      const rows = await db
        .select()
        .from(apiConfigs)
        .where(eq(apiConfigs.platform, input.platform))
        .limit(1);

      if (rows.length === 0) {
        throw new Error(`No config found for platform: ${input.platform}`);
      }

      const newActive = rows[0].isActive === 1 ? 0 : 1;
      await db
        .update(apiConfigs)
        .set({ isActive: newActive, updatedAt: new Date() })
        .where(eq(apiConfigs.platform, input.platform));

      return { success: true, platform: input.platform, isActive: newActive === 1 };
    }),

  // Delete config (admin only)
  delete: adminQuery
    .input(z.object({ platform: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .delete(apiConfigs)
        .where(eq(apiConfigs.platform, input.platform));
      return { success: true };
    }),

  // Get active platform status (public)
  status: publicQuery.query(async () => {
    const rows = await db.select().from(apiConfigs);
    const result: Record<string, boolean> = {
      instagram: false,
      tiktok: false,
      youtube: false,
    };
    for (const row of rows) {
      if (row.isActive === 1 && row.apiKey && row.apiHost) {
        result[row.platform] = true;
      }
    }
    return result;
  }),
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
