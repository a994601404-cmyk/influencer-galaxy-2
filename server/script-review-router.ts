import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { scriptReviews } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { createNotification, getAdminUnionIds, getInfluencerCreator, getInfluencerName } from "./notification-router.js";

export const scriptReviewRouter = createRouter({
  list: publicQuery
    .input(z.object({ influencerId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      return db
        .select()
        .from(scriptReviews)
        .where(and(
          eq(scriptReviews.influencerId, input.influencerId),
          eq(scriptReviews.isTest, isTestTarget)
        ))
        .orderBy(asc(scriptReviews.round));
    }),

  create: authedQuery
    .input(z.object({
      influencerId: z.number(),
      scriptText: z.string().min(1),
      userNote: z.string().optional(),
      submittedAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const existing = await db
        .select()
        .from(scriptReviews)
        .where(eq(scriptReviews.influencerId, input.influencerId));
      const nextRound = existing.length > 0
        ? Math.max(...existing.map((s) => s.round)) + 1
        : 1;

      const result = await db.insert(scriptReviews).values({
        influencerId: input.influencerId,
        round: nextRound,
        scriptText: input.scriptText,
        userNote: input.userNote || null,
        status: "pending",
        adminNote: null,
        isTest: isTestTarget,
        submittedAt: input.submittedAt,
        reviewedAt: null,
      });
      const insertId = Number(result[0].insertId);

      // Notify admins
      try {
        const infName = await getInfluencerName(input.influencerId);
        const adminIds = await getAdminUnionIds();
        for (const adminId of adminIds) {
          await createNotification({
            receiverUnionId: adminId,
            type: "script_created",
            title: "新脚本审核待处理",
            message: `网红「${infName}」提交了第${nextRound}次脚本审核，请查看`,
            relatedId: input.influencerId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch { /* ignore */ }

      const row = await db.select().from(scriptReviews).where(eq(scriptReviews.id, insertId)).limit(1);
      return row[0];
    }),

  review: adminQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString().split("T")[0];
      await db.update(scriptReviews).set({
        status: input.status,
        adminNote: input.adminNote || null,
        reviewedAt: now,
      }).where(eq(scriptReviews.id, input.id));
      const row = await db.select().from(scriptReviews).where(eq(scriptReviews.id, input.id)).limit(1);

      // Notify influencer creator
      try {
        const infName = await getInfluencerName(row[0].influencerId);
        const creatorId = await getInfluencerCreator(row[0].influencerId);
        if (creatorId) {
          const statusText = input.status === "approved" ? "通过" : "不通过";
          await createNotification({
            receiverUnionId: creatorId,
            type: "script_reviewed",
            title: `脚本审核${statusText}`,
            message: `管理员审核了网红「${infName}」的第${row[0].round}次脚本：${statusText}${input.adminNote ? " - " + input.adminNote : ""}`,
            relatedId: row[0].influencerId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch { /* ignore */ }

      return row[0];
    }),
});
