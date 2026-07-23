import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb, getRawConnection } from "./queries/connection.js";
import { negotiationRecords, influencers } from "../db/schema.js";
import { eq, and, asc, sql } from "drizzle-orm";
import { createNotification, getAdminUnionIds, getInfluencerCreator, getInfluencerName, getBeijingTimeFull } from "./notification-router.js";
import { moveIntoReview, moveOutOfReview } from "./influencer-router.js";

export const negotiationRouter = createRouter({
  // List all negotiation records, optionally filtered by influencerIds
  listAll: publicQuery
    .input(z.object({ influencerIds: z.array(z.number()).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      if (input?.influencerIds && input.influencerIds.length > 0) {
        const idList = input.influencerIds.join(",");
        const [rows] = await db.execute(
          `SELECT * FROM negotiationRecords WHERE influencerId IN (${idList}) AND isTest = ${isTestTarget} ORDER BY round ASC`
        );
        return rows as any[];
      }
      return db.select().from(negotiationRecords).where(eq(negotiationRecords.isTest, isTestTarget)).orderBy(asc(negotiationRecords.round));
    }),

  list: publicQuery
    .input(z.object({ influencerId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const result = await db
        .select()
        .from(negotiationRecords)
        .where(and(
          eq(negotiationRecords.influencerId, input.influencerId),
          eq(negotiationRecords.isTest, isTestTarget)
        ))
        .orderBy(asc(negotiationRecords.round));
      return result;
    }),

  create: authedQuery
    .input(z.object({
      influencerId: z.number(),
      userPrice: z.number().default(0),
      adminPrice: z.number().default(0),
      userPriceLocal: z.number().nullable().optional(),
      userPriceCurrency: z.string().nullable().optional(),
      exchangeRate: z.string().nullable().optional(),
      notes: z.string().optional(),
      createdAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      // Auto-assign round number
      const existing = await db
        .select()
        .from(negotiationRecords)
        .where(eq(negotiationRecords.influencerId, input.influencerId));
      const nextRound = existing.length > 0
        ? Math.max(...existing.map((n) => n.round)) + 1
        : 1;

      const result = await db.insert(negotiationRecords).values({
        influencerId: input.influencerId,
        round: nextRound,
        userPrice: input.userPrice,
        adminPrice: input.adminPrice,
        userPriceLocal: input.userPriceLocal ?? null,
        userPriceCurrency: input.userPriceCurrency ?? null,
        exchangeRate: input.exchangeRate ?? null,
        notes: input.notes || null,
        isTest: isTestTarget,
        createdAt: input.createdAt,
      });
      const insertId = Number(result[0].insertId);

      // Sync latest prices to influencer card cache (raw mysql2 for reliability)
      try {
        const rawConn = await getRawConnection();
        const nowStr = getBeijingTimeFull();
        await rawConn.execute(
          `UPDATE influencers SET userPrice = ?, adminPrice = ?, userPriceLocal = ?, userPriceCurrency = ?, userPriceUpdatedAt = ?, adminPriceUpdatedAt = ? WHERE id = ?`,
          [input.userPrice, input.adminPrice, input.userPriceLocal ?? null, input.userPriceCurrency ?? null, nowStr, nowStr, input.influencerId]
        );
      } catch { /* ignore sync failure */ }

      // Send notifications
      try {
        const infName = await getInfluencerName(input.influencerId);
        const isAdmin = ctx.user.role === "admin";
        if (isAdmin && input.adminPrice > 0) {
          // Admin reviewed: notify influencer creator
          const creatorId = await getInfluencerCreator(input.influencerId);
          if (creatorId) {
            await createNotification({
              receiverUnionId: creatorId,
              type: "negotiation_reviewed",
              title: "谈价记录已审核",
              message: `管理员审核了网红「${infName}」的第${nextRound}轮谈价，审核报价为 $${input.adminPrice.toLocaleString()}`,
              relatedId: input.influencerId,
              relatedType: "influencer",
              isTest: ctx.testMode,
            });
          }
        } else if (!isAdmin) {
          // User submitted: notify admins
          const adminIds = await getAdminUnionIds();
          for (const adminId of adminIds) {
            await createNotification({
              receiverUnionId: adminId,
              type: "negotiation_created",
              title: "新谈价记录待审核",
              message: `网红「${infName}」有新的第${nextRound}轮谈价记录（网红报价 $${input.userPrice.toLocaleString()}），请审核`,
              relatedId: input.influencerId,
              relatedType: "influencer",
              isTest: ctx.testMode,
            });
          }
        }
      } catch { /* ignore notification failure */ }

      // 管理员直接创建带审核报价的谈价记录时，同样自动移出「审核中」
      if (ctx.user.role === "admin" && input.adminPrice > 0) {
        await moveOutOfReview(input.influencerId);
      }
      // 普通用户提交谈价记录 → 卡片移入「审核中」等待管理员审核
      if (ctx.user.role !== "admin") {
        await moveIntoReview(input.influencerId);
      }

      const row = await db.select().from(negotiationRecords).where(eq(negotiationRecords.id, insertId)).limit(1);
      return row[0];
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      adminPrice: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const setData: any = {};
      if (input.adminPrice !== undefined) setData.adminPrice = input.adminPrice;
      if (input.notes !== undefined) setData.notes = input.notes;
      if (Object.keys(setData).length === 0) throw new Error("No fields to update");

      await db.update(negotiationRecords)
        .set(setData)
        .where(eq(negotiationRecords.id, input.id));

      // Get the updated record
      const row = await db.select().from(negotiationRecords)
        .where(eq(negotiationRecords.id, input.id))
        .limit(1);

      // Sync to influencer card
      try {
        const rawConn = await getRawConnection();
        const nowStr2 = getBeijingTimeFull();
        await rawConn.execute(
          `UPDATE influencers SET adminPrice = ?, adminPriceUpdatedAt = ? WHERE id = ?`,
          [input.adminPrice, nowStr2, row[0].influencerId]
        );
      } catch { /* ignore */ }

      // 审核报价生效后，卡片自动从「审核中」移入「对接中」
      if (input.adminPrice !== undefined && input.adminPrice > 0) {
        await moveOutOfReview(row[0].influencerId);
      }

      // Notify creator
      try {
        const infName = await getInfluencerName(row[0].influencerId);
        const creatorId = await getInfluencerCreator(row[0].influencerId);
        if (creatorId) {
          await createNotification({
            receiverUnionId: creatorId,
            type: "negotiation_reviewed",
            title: "谈价记录已审核",
            message: `管理员审核了网红「${infName}」的第${row[0].round}轮谈价，审核报价为 $${input.adminPrice.toLocaleString()}`,
            relatedId: row[0].influencerId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch { /* ignore */ }

      return row[0];
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(negotiationRecords).where(eq(negotiationRecords.id, input.id));
      return { success: true };
    }),
});
