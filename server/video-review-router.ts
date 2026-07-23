import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { videoReviews } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { createNotification, getAdminUnionIds, getInfluencerCreator, getInfluencerName } from "./notification-router.js";
import { moveIntoReview, moveOutOfReview } from "./influencer-router.js";

export const videoReviewRouter = createRouter({
  list: publicQuery
    .input(z.object({ influencerId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      return db
        .select()
        .from(videoReviews)
        .where(and(
          eq(videoReviews.influencerId, input.influencerId),
          eq(videoReviews.isTest, isTestTarget)
        ))
        .orderBy(asc(videoReviews.round));
    }),

  // List all video reviews across influencers (for the review center)
  listAll: publicQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      return db
        .select()
        .from(videoReviews)
        .where(eq(videoReviews.isTest, isTestTarget))
        .orderBy(asc(videoReviews.round));
    }),

  create: authedQuery
    .input(z.object({
      influencerId: z.number(),
      videoUrl: z.string().min(1),
      videoFileName: z.string().optional(),
      userNote: z.string().optional(),
      submittedAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const existing = await db
        .select()
        .from(videoReviews)
        .where(eq(videoReviews.influencerId, input.influencerId));
      const nextRound = existing.length > 0
        ? Math.max(...existing.map((v) => v.round)) + 1
        : 1;

      const result = await db.insert(videoReviews).values({
        influencerId: input.influencerId,
        round: nextRound,
        videoUrl: input.videoUrl,
        videoFileName: input.videoFileName || null,
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
            type: "video_created",
            title: "新视频初稿待处理",
            message: `网红「${infName}」提交了第${nextRound}次视频初稿，请查看`,
            relatedId: input.influencerId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch { /* ignore */ }

      // 普通用户提交视频初稿 → 卡片移入「审核中」
      if (ctx.user.role !== "admin") {
        await moveIntoReview(input.influencerId);
      }

      const row = await db.select().from(videoReviews).where(eq(videoReviews.id, insertId)).limit(1);
      return row[0];
    }),

  review: adminQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const now = new Date().toISOString().split("T")[0];
      await db.update(videoReviews).set({
        status: input.status,
        adminNote: input.adminNote || null,
        reviewedAt: now,
      }).where(eq(videoReviews.id, input.id));
      const row = await db.select().from(videoReviews).where(eq(videoReviews.id, input.id)).limit(1);

      // 管理员审核完毕（通过/不通过）→ 卡片移回「对接中」
      await moveOutOfReview(row[0].influencerId);

      // Notify influencer creator
      try {
        const infName = await getInfluencerName(row[0].influencerId);
        const creatorId = await getInfluencerCreator(row[0].influencerId);
        if (creatorId) {
          const statusText = input.status === "approved" ? "通过" : "不通过";
          await createNotification({
            receiverUnionId: creatorId,
            type: "video_reviewed",
            title: `视频初稿审核${statusText}`,
            message: `管理员审核了网红「${infName}」的第${row[0].round}次视频初稿：${statusText}${input.adminNote ? " - " + input.adminNote : ""}`,
            relatedId: row[0].influencerId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch (e) { console.error("[VideoReview] notify error:", e); }

      return row[0];
    }),
});
