import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb, getRawConnection } from "./queries/connection.js";
import { notifications, users } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { pushNotification } from "./sse-manager.js";

// ─── Helper: Get all admin unionIds ──────────────────────────
export async function getAdminUnionIds(): Promise<string[]> {
  const conn = await getRawConnection();
  const [rows] = await conn.execute(
    `SELECT unionId FROM users WHERE role = 'admin'`
  );
  return (rows as any[]).map(r => r.unionId).filter(Boolean);
}

// ─── Helper: Get influencer creator unionId ───────────────────
export async function getInfluencerCreator(influencerId: number): Promise<string | null> {
  const conn = await getRawConnection();
  const [rows] = await conn.execute(
    `SELECT createdByUnionId FROM influencers WHERE id = ?`, [influencerId]
  );
  return (rows as any[])[0]?.createdByUnionId || null;
}

// ─── Helper: Get influencer name ──────────────────────────────
export async function getInfluencerName(influencerId: number): Promise<string | null> {
  const conn = await getRawConnection();
  const [rows] = await conn.execute(
    `SELECT name FROM influencers WHERE id = ?`, [influencerId]
  );
  return (rows as any[])[0]?.name || null;
}

// ─── Helper: Beijing time formatter ──────────────────────────
function getBeijingTime(): string {
  const now = new Date();
  // UTC+8 offset in minutes
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${beijing.getFullYear()}-${pad(beijing.getMonth() + 1)}-${pad(beijing.getDate())} ${pad(beijing.getHours())}:${pad(beijing.getMinutes())}`;
}

// Full datetime with seconds (YYYY-MM-DD HH:mm:ss)
export function getBeijingTimeFull(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${beijing.getFullYear()}-${pad(beijing.getMonth() + 1)}-${pad(beijing.getDate())} ${pad(beijing.getHours())}:${pad(beijing.getMinutes())}:${pad(beijing.getSeconds())}`;
}

// ─── Helper: Create notification ──────────────────────────────
// Notification delivery is best-effort: a failure (e.g. enum mismatch,
// DB hiccup) must never break the caller's main operation.
export async function createNotification(opts: {
  receiverUnionId: string;
  type: string;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
  isTest?: boolean;
}) {
  try {
    const conn = await getRawConnection();
    const now = getBeijingTime();
    const isTestVal = opts.isTest ? 1 : 0;
    const [result] = await conn.execute(
      `INSERT INTO notifications (receiverUnionId, type, title, message, relatedId, relatedType, isRead, isTest, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [opts.receiverUnionId, opts.type, opts.title, opts.message,
       opts.relatedId ?? null, opts.relatedType ?? null, isTestVal, now]
    );

    // Push to SSE if user has an active connection
    const insertId = (result as any)?.insertId ?? 0;
    pushNotification(opts.receiverUnionId, {
      type: "new_notification",
      id: insertId,
      notificationType: opts.type,
      title: opts.title,
      message: opts.message,
      relatedId: opts.relatedId,
      relatedType: opts.relatedType,
      createdAt: now,
    }).catch(() => { /* ignore SSE push failures */ });
  } catch (error) {
    console.error("[notification] createNotification failed (non-fatal):", error);
  }
}

// ─── Router ──────────────────────────────────────────────────
export const notificationRouter = createRouter({
  // List my notifications
  list: authedQuery
    .input(z.object({
      unreadOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const unionId = ctx.user.unionId;
      const baseFilter = ctx.testMode
        ? eq(notifications.isTest, 1)
        : eq(notifications.isTest, 0);
      if (input?.unreadOnly) {
        return db.select()
          .from(notifications)
          .where(and(
            baseFilter,
            eq(notifications.receiverUnionId, unionId),
            eq(notifications.isRead, 0)
          ))
          .orderBy(desc(notifications.id))
          .limit(50);
      }
      return db.select()
        .from(notifications)
        .where(and(baseFilter, eq(notifications.receiverUnionId, unionId)))
        .orderBy(desc(notifications.id))
        .limit(50);
    }),

  // Count unread
  unreadCount: authedQuery
    .query(async ({ ctx }) => {
      const conn = await getRawConnection();
      const isTestTarget = ctx.testMode ? 1 : 0;
      const [rows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM notifications WHERE receiverUnionId = ? AND isRead = 0 AND isTest = ?`,
        [ctx.user.unionId, isTestTarget]
      );
      return (rows as any[])[0]?.cnt ?? 0;
    }),

  // Mark as read
  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conn = await getRawConnection();
      await conn.execute(
        `UPDATE notifications SET isRead = 1 WHERE id = ? AND receiverUnionId = ?`,
        [input.id, ctx.user.unionId]
      );
      return { success: true };
    }),

  // Mark all as read
  markAllRead: authedQuery
    .mutation(async ({ ctx }) => {
      const conn = await getRawConnection();
      const isTestTarget = ctx.testMode ? 1 : 0;
      await conn.execute(
        `UPDATE notifications SET isRead = 1 WHERE receiverUnionId = ? AND isRead = 0 AND isTest = ?`,
        [ctx.user.unionId, isTestTarget]
      );
      return { success: true };
    }),

  // Admin: cleanup all test data
  cleanupTestData: adminQuery
    .mutation(async () => {
      const conn = await getRawConnection();
      const [influencers] = await conn.execute(`DELETE FROM influencers WHERE isTest = 1`);
      const [negs] = await conn.execute(`DELETE FROM negotiationRecords WHERE isTest = 1`);
      const [scripts] = await conn.execute(`DELETE FROM scriptReviews WHERE isTest = 1`);
      const [videos] = await conn.execute(`DELETE FROM videoReviews WHERE isTest = 1`);
      const [notifs] = await conn.execute(`DELETE FROM notifications WHERE isTest = 1`);
      return {
        success: true,
        deleted: {
          influencers: (influencers as any).affectedRows || 0,
          negotiations: (negs as any).affectedRows || 0,
          scripts: (scripts as any).affectedRows || 0,
          videos: (videos as any).affectedRows || 0,
          notifications: (notifs as any).affectedRows || 0,
        },
      };
    }),
});
