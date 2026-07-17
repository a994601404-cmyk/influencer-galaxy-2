import { z } from "zod";
import { createRouter, authedQuery } from "./middleware.js";
import { getRawConnection } from "./queries/connection.js";

export const cardPreferenceRouter = createRouter({
  // Get current user's card preferences (sort order + pinned)
  list: authedQuery
    .query(async ({ ctx }) => {
      const conn = await getRawConnection();
      const [rows] = await conn.execute(
        `SELECT influencerId, sortOrder, isPinned FROM userCardPreferences WHERE userUnionId = ? ORDER BY isPinned DESC, sortOrder ASC`,
        [ctx.user.unionId]
      );
      const prefs = rows as any[];
      const pinnedId = prefs.find((p) => p.isPinned === 1)?.influencerId ?? null;
      return {
        pinnedId,
        orderMap: Object.fromEntries(prefs.map((p) => [p.influencerId, p.sortOrder])),
      };
    }),

  // Save sort order for multiple cards
  saveOrder: authedQuery
    .input(z.object({
      orders: z.array(z.object({
        influencerId: z.number(),
        sortOrder: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      for (const o of input.orders) {
        await conn.execute(
          `INSERT INTO userCardPreferences (userUnionId, influencerId, sortOrder, isPinned)
           VALUES (?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE sortOrder = VALUES(sortOrder)`,
          [ctx.user.unionId, o.influencerId, o.sortOrder]
        );
      }
      return { success: true };
    }),

  // Toggle pin status for a card
  togglePin: authedQuery
    .input(z.object({
      influencerId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Check current state
      const [rows] = await conn.execute(
        `SELECT isPinned FROM userCardPreferences WHERE userUnionId = ? AND influencerId = ?`,
        [ctx.user.unionId, input.influencerId]
      );
      const existing = (rows as any[])[0];
      const newPinned = existing ? (existing.isPinned ? 0 : 1) : 1;

      // If pinning, unpin any previously pinned card first
      if (newPinned === 1) {
        await conn.execute(
          `UPDATE userCardPreferences SET isPinned = 0 WHERE userUnionId = ? AND isPinned = 1`,
          [ctx.user.unionId]
        );
      }

      await conn.execute(
        `INSERT INTO userCardPreferences (userUnionId, influencerId, sortOrder, isPinned)
         VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE isPinned = VALUES(isPinned), sortOrder = VALUES(sortOrder)`,
        [ctx.user.unionId, input.influencerId, newPinned]
      );

      return { success: true, isPinned: newPinned === 1 };
    }),
});
