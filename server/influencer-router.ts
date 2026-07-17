import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb, getRawConnection } from "./queries/connection.js";
import { influencers, negotiationRecords } from "../db/schema.js";
import { eq, like, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createNotification, getAdminUnionIds, getBeijingTimeFull } from "./notification-router.js";

// ─── Helpers ──────────────────────────────────────────────────
function serializeJsonField<T>(val: T | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  return JSON.stringify(val);
}

function parseJsonField<T>(val: string | null | undefined): T | undefined {
  if (!val) return undefined;
  try { return JSON.parse(val) as T; } catch { return undefined; }
}

function toDbRecord(row: any) {
  return {
    ...row,
    audienceGender: parseJsonField(row.audienceGender),
    audienceAge: parseJsonField(row.audienceAge),
    audienceDevices: parseJsonField(row.audienceDevices),
    topPosts: parseJsonField(row.topPosts),
    hidden: row.hidden === 1,
  };
}

// Fetch latest non-zero prices for each influencer
async function fetchLatestPrices(influencerIds: number[]): Promise<Map<number, { userPrice: number; adminPrice: number }>> {
  if (influencerIds.length === 0) return new Map();
  try {
    const conn = await getRawConnection();
    const idList = influencerIds.join(",");
    const [rows] = await conn.execute(
      `SELECT influencerId, round, userPrice, adminPrice FROM negotiationRecords WHERE influencerId IN (${idList}) ORDER BY round ASC`
    );
    const map = new Map<number, { userPrice: number; adminPrice: number }>();
    for (const r of rows as any[]) {
      const id = Number(r.influencerId);
      const existing = map.get(id) || { userPrice: 0, adminPrice: 0 };
      if (r.userPrice > 0) existing.userPrice = Number(r.userPrice);
      if (r.adminPrice > 0) existing.adminPrice = Number(r.adminPrice);
      map.set(id, existing);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ─── List ─────────────────────────────────────────────────────
const listInput = z.object({
  platform: z.string().optional(),
  niche: z.string().optional(),
  search: z.string().optional(),
  creator: z.string().optional(),
  limit: z.number().min(1).max(200).default(100),
  offset: z.number().min(0).default(0),
});

export const influencerRouter = createRouter({
  list: publicQuery
    .input(listInput.optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const isAdmin = ctx.user?.role === "admin";

      const conditions: any[] = [];

      // Non-admin users only see non-hidden cards
      if (!isAdmin) {
        conditions.push(eq(influencers.hidden, 0));
      }

      if (input?.platform && input.platform !== "all") {
        conditions.push(eq(influencers.platform, input.platform as any));
      }
      if (input?.niche && input.niche !== "all") {
        conditions.push(eq(influencers.niche, input.niche));
      }
      if (input?.search) {
        conditions.push(like(influencers.name, `%${input.search}%`));
      }
      if (input?.creator && input.creator !== "all") {
        conditions.push(eq(influencers.createdByUnionId, input.creator));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Exclude test data for normal users, include test data only in test mode
      const testFilter = ctx.testMode ? undefined : eq(influencers.isTest, 0);
      const finalWhere = where && testFilter ? and(where, testFilter) : (testFilter || where);

      const items = await db
        .select()
        .from(influencers)
        .where(finalWhere)
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0)
        .orderBy(desc(influencers.createdAt));

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(influencers)
        .where(finalWhere);

      return {
        items: items.map(toDbRecord),
        total: countResult[0]?.count || 0,
      };
    }),

  // ─── Get by ID ─────────────────────────────────────────────
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(influencers)
        .where(eq(influencers.id, input.id))
        .limit(1);
      const row = result[0];
      if (!row) return null;
      // Non-admin cannot see hidden cards
      if (row.hidden === 1 && ctx.user?.role !== "admin") return null;
      return toDbRecord(row);
    }),

  // ─── Create ────────────────────────────────────────────────
  create: authedQuery
    .input(z.object({
      name: z.string().min(1),
      handle: z.string().min(1),
      platform: z.enum(["instagram", "tiktok", "xiaohongshu", "douyin"]),
      avatar: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      engagementRate: z.number().optional(),
      niche: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      profileUrl: z.string().nullable().optional(),
      userPrice: z.number().optional(),
      coopTypes: z.string().nullable().optional(),
      audienceGender: z.any().optional(),
      audienceAge: z.any().optional(),
      audienceDevices: z.any().optional(),
      topPosts: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const now = getBeijingTimeFull();
      const result = await db.insert(influencers).values({
        name: input.name,
        handle: input.handle,
        platform: input.platform,
        avatar: input.avatar || null,
        bio: input.bio || null,
        engagementRate: input.engagementRate ? String(input.engagementRate) : "0",
        coopTypes: input.coopTypes || null,
        niche: input.niche || null,
        location: input.location || null,
        gender: input.gender || "other",
        profileUrl: input.profileUrl || null,
        userPrice: input.userPrice || 0,
        userPriceUpdatedAt: input.userPrice ? now : null,
        audienceGender: serializeJsonField(input.audienceGender),
        audienceAge: serializeJsonField(input.audienceAge),
        audienceDevices: serializeJsonField(input.audienceDevices),
        topPosts: serializeJsonField(input.topPosts),
        createdByUnionId: ctx.user.unionId,
        hidden: 0,
        isTest: ctx.testMode ? 1 : 0,
      });
      const insertId = Number(result[0].insertId);

      // Notify admins: new influencer created
      try {
        const adminIds = await getAdminUnionIds();
        const creatorName = ctx.user.name || ctx.user.email || "用户";
        for (const adminId of adminIds) {
          await createNotification({
            receiverUnionId: adminId,
            type: "influencer_created",
            title: "新网红待审核",
            message: `${creatorName} 添加了网红「${input.name}」(${input.handle})，请审核报价`,
            relatedId: insertId,
            relatedType: "influencer",
            isTest: ctx.testMode,
          });
        }
      } catch { /* ignore notification failure */ }

      const row = await db.select().from(influencers).where(eq(influencers.id, insertId)).limit(1);
      return toDbRecord(row[0]);
    }),

  // ─── Update ────────────────────────────────────────────────
  update: authedQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      handle: z.string().optional(),
      platform: z.enum(["instagram", "tiktok", "xiaohongshu", "douyin"]).optional(),
      avatar: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      engagementRate: z.number().optional(),
      niche: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      profileUrl: z.string().nullable().optional(),
      coopTypes: z.string().nullable().optional(),
      audienceGender: z.any().optional(),
      audienceAge: z.any().optional(),
      audienceDevices: z.any().optional(),
      topPosts: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "网红不存在" });
      // Only admin or owner can update
      if (ctx.user.role !== "admin" && existing[0].createdByUnionId !== ctx.user.unionId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权修改此网红" });
      }
      const { id, ...data } = input;
      const setData: any = {};
      if (data.name !== undefined) setData.name = data.name;
      if (data.handle !== undefined) setData.handle = data.handle;
      if (data.platform !== undefined) setData.platform = data.platform;
      if (data.avatar !== undefined) setData.avatar = data.avatar;
      if (data.bio !== undefined) setData.bio = data.bio;
      if (data.engagementRate !== undefined) setData.engagementRate = String(data.engagementRate);
      if (data.coopTypes !== undefined) setData.coopTypes = data.coopTypes;
      if (data.niche !== undefined) setData.niche = data.niche;
      if (data.location !== undefined) setData.location = data.location;
      if (data.gender !== undefined) setData.gender = data.gender;
      if (data.profileUrl !== undefined) setData.profileUrl = data.profileUrl;
      if (data.audienceGender !== undefined) setData.audienceGender = serializeJsonField(data.audienceGender);
      if (data.audienceAge !== undefined) setData.audienceAge = serializeJsonField(data.audienceAge);
      if (data.audienceDevices !== undefined) setData.audienceDevices = serializeJsonField(data.audienceDevices);
      if (data.topPosts !== undefined) setData.topPosts = serializeJsonField(data.topPosts);

      await db.update(influencers).set(setData).where(eq(influencers.id, id));
      const row = await db.select().from(influencers).where(eq(influencers.id, id)).limit(1);
      return toDbRecord(row[0]);
    }),

  // ─── Delete ────────────────────────────────────────────────
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "网红不存在" });
      // Admin can delete any; normal users can only delete their own
      if (ctx.user.role !== "admin" && existing[0].createdByUnionId !== ctx.user.unionId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权删除此网红" });
      }
      await db.delete(influencers).where(eq(influencers.id, input.id));
      return { success: true };
    }),

  // ─── Hide / Unhide (admin only) ────────────────────────────
  hide: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(influencers).set({ hidden: 1 }).where(eq(influencers.id, input.id));
      return { success: true };
    }),

  unhide: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(influencers).set({ hidden: 0 }).where(eq(influencers.id, input.id));
      return { success: true };
    }),

  // ─── Update User Price ─────────────────────────────────────
  updateUserPrice: authedQuery
    .input(z.object({ id: z.number(), price: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND" });
      // Only admin or owner can update price
      if (ctx.user.role !== "admin" && existing[0].createdByUnionId !== ctx.user.unionId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权修改" });
      }
      const now = getBeijingTimeFull();
      await db.update(influencers).set({
        userPrice: input.price,
        userPriceUpdatedAt: now,
      }).where(eq(influencers.id, input.id));
      const row = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      return toDbRecord(row[0]);
    }),

  // ─── Update Admin Price ────────────────────────────────────
  updateAdminPrice: adminQuery
    .input(z.object({ id: z.number(), price: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = getBeijingTimeFull();
      await db.update(influencers).set({
        adminPrice: input.price,
        adminPriceUpdatedAt: now,
        coopStatus: input.price > 0 ? "cooperating" : "pending",
      }).where(eq(influencers.id, input.id));
      const row = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      return toDbRecord(row[0]);
    }),

  // ─── Set Not Cooperating ───────────────────────────────────
  setNotCooperating: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(influencers).set({
        adminPrice: 0,
        coopStatus: "not-cooperating",
      }).where(eq(influencers.id, input.id));
      const row = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      return toDbRecord(row[0]);
    }),

  // ─── Get Niches ────────────────────────────────────────────
  getNiches: publicQuery.query(async () => {
    const db = getDb();
    const result = await db
      .selectDistinct({ niche: influencers.niche })
      .from(influencers)
      .where(sql`${influencers.niche} IS NOT NULL`);
    return result.map((r) => r.niche).filter(Boolean);
  }),

  // ─── Get Creator Options ───────────────────────────────────
  getCreators: publicQuery.query(async () => {
    const db = getDb();
    const result = await db
      .selectDistinct({ createdByUnionId: influencers.createdByUnionId })
      .from(influencers)
      .where(sql`${influencers.createdByUnionId} IS NOT NULL`);
    return result.map((r) => r.createdByUnionId).filter(Boolean) as string[];
  }),
});
