import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware.js";
import { getRawConnection } from "./queries/connection.js";

export const cardCategoryRouter = createRouter({
  // List categories with their cards for current user
  list: authedQuery
    .query(async ({ ctx }) => {
      const conn = await getRawConnection();
      const unionId = ctx.user.unionId;
      const isAdmin = ctx.user.role === "admin";

      // Get categories for this user
      const [catRows] = await conn.execute(
        `SELECT * FROM cardCategories WHERE userUnionId = ? ORDER BY sortOrder ASC`,
        [unionId]
      );
      const categories = catRows as any[];

      // Get all items with influencer data
      const [itemRows] = await conn.execute(
        `SELECT c.*, i.* FROM cardCategoryItems c
         JOIN influencers i ON c.influencerId = i.id
         WHERE c.categoryId IN (SELECT id FROM cardCategories WHERE userUnionId = ?)
         ORDER BY c.isPinned DESC, c.sortOrder ASC`,
        [unionId]
      );
      const items = (itemRows as any[]).map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        influencerId: row.influencerId,
        sortOrder: row.sortOrder,
        isPinned: row.isPinned,
        influencer: {
          id: row.influencerId,
          name: row.name,
          handle: row.handle,
          platform: row.platform,
          avatar: row.avatar,
          location: row.location,
          niche: row.niche,
          bio: row.bio,
          profileUrl: row.profileUrl,
          userPrice: row.userPrice,
          adminPrice: row.adminPrice,
          currency: row.currency,
          adminCurrency: row.adminCurrency,
          coopStatus: row.coopStatus,
          hidden: row.hidden,
          createdByUnionId: row.createdByUnionId,
          coopTypes: row.coopTypes,
          userPriceUpdatedAt: row.userPriceUpdatedAt,
          adminPriceUpdatedAt: row.adminPriceUpdatedAt,
        },
      }));

      return { categories, items, isAdmin };
    }),

  // Create a new category
  create: authedQuery
    .input(z.object({ name: z.string().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Get max sortOrder
      const [rows] = await conn.execute(
        `SELECT MAX(sortOrder) as maxOrder FROM cardCategories WHERE userUnionId = ?`,
        [ctx.user.unionId]
      );
      const maxOrder = ((rows as any[])[0]?.maxOrder ?? -1) + 1;

      const [result] = await conn.execute(
        `INSERT INTO cardCategories (userUnionId, name, sortOrder, isExpanded) VALUES (?, ?, ?, 1)`,
        [ctx.user.unionId, input.name, maxOrder]
      );
      return { id: (result as any).insertId, name: input.name };
    }),

  // Update category name
  update: authedQuery
    .input(z.object({ id: z.number(), name: z.string().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      await conn.execute(
        `UPDATE cardCategories SET name = ? WHERE id = ? AND userUnionId = ?`,
        [input.name, input.id, ctx.user.unionId]
      );
      return { success: true };
    }),

  // Delete a category (move all cards to default "网红库" category)
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Find "网红库" category
      const [rows] = await conn.execute(
        `SELECT id FROM cardCategories WHERE userUnionId = ? AND name = '网红库' LIMIT 1`,
        [ctx.user.unionId]
      );
      const defaultCat = (rows as any[])[0];
      if (defaultCat && defaultCat.id !== input.id) {
        // Move items to default
        await conn.execute(
          `UPDATE cardCategoryItems SET categoryId = ? WHERE categoryId = ?`,
          [defaultCat.id, input.id]
        );
      } else {
        // Delete items
        await conn.execute(`DELETE FROM cardCategoryItems WHERE categoryId = ?`, [input.id]);
      }
      await conn.execute(
        `DELETE FROM cardCategories WHERE id = ? AND userUnionId = ?`,
        [input.id, ctx.user.unionId]
      );
      return { success: true };
    }),

  // Toggle category expanded/collapsed
  toggleExpand: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      await conn.execute(
        `UPDATE cardCategories SET isExpanded = NOT isExpanded WHERE id = ? AND userUnionId = ?`,
        [input.id, ctx.user.unionId]
      );
      return { success: true };
    }),

  // Move a card to another category
  moveCard: authedQuery
    .input(z.object({
      influencerId: z.number(),
      fromCategoryId: z.number(),
      toCategoryId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Get max sortOrder in target category
      const [rows] = await conn.execute(
        `SELECT MAX(sortOrder) as maxOrder FROM cardCategoryItems WHERE categoryId = ?`,
        [input.toCategoryId]
      );
      const newOrder = ((rows as any[])[0]?.maxOrder ?? -1) + 1;

      // Move card (update categoryId, keep pin status)
      await conn.execute(
        `UPDATE cardCategoryItems SET categoryId = ?, sortOrder = ? WHERE influencerId = ? AND categoryId = ?`,
        [input.toCategoryId, newOrder, input.influencerId, input.fromCategoryId]
      );
      return { success: true };
    }),

  // Toggle pin within a category (no limit on pin count)
  togglePin: authedQuery
    .input(z.object({
      itemId: z.number(),
      categoryId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Get current pin state
      const [rows] = await conn.execute(
        `SELECT isPinned FROM cardCategoryItems WHERE id = ? AND categoryId IN (SELECT id FROM cardCategories WHERE userUnionId = ?)`,
        [input.itemId, ctx.user.unionId]
      );
      const existing = (rows as any[])[0];
      const newPinned = existing ? (existing.isPinned ? 0 : 1) : 1;

      await conn.execute(
        `UPDATE cardCategoryItems SET isPinned = ? WHERE id = ?`,
        [newPinned, input.itemId]
      );
      return { success: true, isPinned: newPinned === 1 };
    }),

  // Save category sort order
  saveCategoryOrder: authedQuery
    .input(z.object({
      orders: z.array(z.object({ id: z.number(), sortOrder: z.number() })),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      for (const o of input.orders) {
        await conn.execute(
          `UPDATE cardCategories SET sortOrder = ? WHERE id = ? AND userUnionId = ?`,
          [o.sortOrder, o.id, ctx.user.unionId]
        );
      }
      return { success: true };
    }),

  // Save card sort order within a category
  saveCardOrder: authedQuery
    .input(z.object({
      categoryId: z.number(),
      orders: z.array(z.object({ itemId: z.number(), sortOrder: z.number() })),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      for (const o of input.orders) {
        await conn.execute(
          `UPDATE cardCategoryItems SET sortOrder = ? WHERE id = ? AND categoryId = ?`,
          [o.sortOrder, o.itemId, input.categoryId]
        );
      }
      return { success: true };
    }),

  // Assign influencer to a category (when creating new influencer)
  assignCard: authedQuery
    .input(z.object({
      influencerId: z.number(),
      categoryId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const conn = await getRawConnection();
      // Check if already assigned
      const [existing] = await conn.execute(
        `SELECT id FROM cardCategoryItems WHERE influencerId = ?`,
        [input.influencerId]
      );
      if ((existing as any[]).length > 0) {
        // Update category
        await conn.execute(
          `UPDATE cardCategoryItems SET categoryId = ? WHERE influencerId = ?`,
          [input.categoryId, input.influencerId]
        );
      } else {
        // Get max sortOrder
        const [rows] = await conn.execute(
          `SELECT MAX(sortOrder) as maxOrder FROM cardCategoryItems WHERE categoryId = ?`,
          [input.categoryId]
        );
        const newOrder = ((rows as any[])[0]?.maxOrder ?? -1) + 1;
        await conn.execute(
          `INSERT INTO cardCategoryItems (categoryId, influencerId, sortOrder, isPinned) VALUES (?, ?, ?, 0)`,
          [input.categoryId, input.influencerId, newOrder]
        );
      }
      return { success: true };
    }),
});
