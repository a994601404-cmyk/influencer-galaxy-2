import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb, getRawConnection } from "./queries/connection.js";
import { influencers, negotiationRecords } from "../db/schema.js";
import { eq, ne, like, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createNotification, getAdminUnionIds, getBeijingTimeFull } from "./notification-router.js";
import { extractKeysFromProfileUrl, normalizeNameKey } from "./lib/link-normalize.js";

// ─── 去重机制（2026-07-24）────────────────────────────────────
// 跨用户匹配全站卡片（垃圾箱 hidden=2 除外），防止多人对接同一网红撞车。
// 只向外暴露最小信息：卡片名称、创建者用户名、创建者视角的分类状态；
// 报价/备注/谈价记录等一律不泄露。
export interface DuplicateMatch {
  influencerId: number;
  name: string;
  matchType: "link" | "name"; // link=平台+handle 相同（强）；name=仅名称相同（弱）
  isSelf: boolean;            // 是否撞上自己已创建的卡
  creatorUnionId: string;
  creatorName: string;
  categoryName: string | null; // 创建者视角的分类名（审核中/对接中/...），无则为 null
  notCooperating: boolean;    // 创建者已标记不合作
}

export async function findDuplicates(opts: {
  name: string;
  profileUrl: string | null | undefined;
  selfUnionId: string;
  testMode?: boolean;
}): Promise<DuplicateMatch[]> {
  const conn = await getRawConnection();
  let sqlText = `SELECT id, name, profileUrl, createdByUnionId, coopStatus FROM influencers WHERE hidden != 2`;
  if (!opts.testMode) sqlText += ` AND isTest = 0`;
  const [rows] = await conn.execute(sqlText);

  const newKeys = new Set(extractKeysFromProfileUrl(opts.profileUrl));
  const nameKey = normalizeNameKey(opts.name);
  const linkRows: any[] = [];
  const nameRows: any[] = [];
  for (const r of rows as any[]) {
    if (newKeys.size > 0 && extractKeysFromProfileUrl(r.profileUrl).some((k) => newKeys.has(k))) {
      linkRows.push(r);
    } else if (nameKey && normalizeNameKey(r.name || "") === nameKey) {
      nameRows.push(r);
    }
  }
  const combined = [
    ...linkRows.map((r) => ({ r, t: "link" as const })),
    ...nameRows.map((r) => ({ r, t: "name" as const })),
  ];
  if (combined.length === 0) return [];

  // 创建者用户名（name → email → unionId 依次兜底）
  const creatorIds = [...new Set(combined.map((m) => String(m.r.createdByUnionId || "")))].filter(Boolean);
  const nameMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const [users] = await conn.execute(
      `SELECT unionId, name, email FROM users WHERE unionId IN (${creatorIds.map(() => "?").join(",")})`,
      creatorIds
    );
    for (const u of users as any[]) {
      nameMap.set(String(u.unionId), u.name || u.email || String(u.unionId));
    }
  }

  // 创建者视角的分类状态
  const infIds = combined.map((m) => Number(m.r.id));
  const catMap = new Map<string, string>();
  if (infIds.length > 0) {
    const [catRows] = await conn.execute(
      `SELECT c.influencerId, cat.userUnionId, cat.name FROM cardCategoryItems c
       JOIN cardCategories cat ON cat.id = c.categoryId
       WHERE c.influencerId IN (${infIds.map(() => "?").join(",")})`,
      infIds
    );
    for (const c of catRows as any[]) {
      catMap.set(`${c.influencerId}:${c.userUnionId}`, c.name);
    }
  }

  return combined.map(({ r, t }) => {
    const creator = String(r.createdByUnionId || "");
    return {
      influencerId: Number(r.id),
      name: r.name,
      matchType: t,
      isSelf: creator === opts.selfUnionId,
      creatorUnionId: creator,
      creatorName: nameMap.get(creator) || creator,
      categoryName: catMap.get(`${r.id}:${creator}`) || null,
      notCooperating: r.coopStatus === "not-cooperating",
    };
  });
}

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

// Move an influencer's cards out of the locked "审核中" category into
// "对接中" once the admin has made a price decision
export async function moveOutOfReview(influencerId: number) {
  try {
    const conn = await getRawConnection();
    const [rows] = await conn.execute(
      `SELECT c.id as itemId, cat.userUnionId as ownerId FROM cardCategoryItems c
       JOIN cardCategories cat ON c.categoryId = cat.id
       WHERE c.influencerId = ? AND cat.name = '审核中'`,
      [influencerId]
    );
    for (const row of rows as any[]) {
      const [targetRows] = await conn.execute(
        `SELECT id FROM cardCategories WHERE userUnionId = ? AND name = '对接中' LIMIT 1`,
        [row.ownerId]
      );
      let targetId = (targetRows as any[])[0]?.id;
      if (!targetId) {
        const [maxCat] = await conn.execute(
          `SELECT MAX(sortOrder) as m FROM cardCategories WHERE userUnionId = ?`,
          [row.ownerId]
        );
        const [ins] = await conn.execute(
          `INSERT INTO cardCategories (userUnionId, name, sortOrder, isExpanded) VALUES (?, '对接中', ?, 1)`,
          [row.ownerId, ((maxCat as any[])[0]?.m ?? -1) + 1]
        );
        targetId = (ins as any).insertId;
      }
      const [maxItem] = await conn.execute(
        `SELECT MAX(sortOrder) as m FROM cardCategoryItems WHERE categoryId = ?`,
        [targetId]
      );
      await conn.execute(
        `UPDATE cardCategoryItems SET categoryId = ?, sortOrder = ? WHERE id = ?`,
        [targetId, ((maxItem as any[])[0]?.m ?? -1) + 1, row.itemId]
      );
    }
  } catch { /* best effort — don't fail the price update */ }
}

// Move an influencer's cards INTO the locked "审核中" category when a user
// submits a review item (谈价/脚本/视频初稿). Mirrors moveOutOfReview:
// every user's personal category view moves together.
export async function moveIntoReview(influencerId: number) {
  try {
    const conn = await getRawConnection();
    // All categorized rows for this influencer not already in 「审核中」
    const [rows] = await conn.execute(
      `SELECT c.id as itemId, cat.userUnionId as ownerId FROM cardCategoryItems c
       JOIN cardCategories cat ON c.categoryId = cat.id
       WHERE c.influencerId = ? AND cat.name != '审核中'`,
      [influencerId]
    );
    const owners = new Set<string>((rows as any[]).map((r) => r.ownerId));
    // Also ensure the creator has a row (uncategorized cards fall back to 网红库 visually)
    const [infRows] = await conn.execute(`SELECT createdByUnionId FROM influencers WHERE id = ? LIMIT 1`, [influencerId]);
    const creatorId = (infRows as any[])[0]?.createdByUnionId;
    if (creatorId && !owners.has(creatorId)) owners.add(creatorId);

    for (const ownerId of owners) {
      // Find or create the owner's 「审核中」category (top position)
      const [targetRows] = await conn.execute(
        `SELECT id FROM cardCategories WHERE userUnionId = ? AND name = '审核中' LIMIT 1`,
        [ownerId]
      );
      let targetId = (targetRows as any[])[0]?.id;
      if (!targetId) {
        const [minCat] = await conn.execute(
          `SELECT MIN(sortOrder) as m FROM cardCategories WHERE userUnionId = ?`,
          [ownerId]
        );
        const [ins] = await conn.execute(
          `INSERT INTO cardCategories (userUnionId, name, sortOrder, isExpanded) VALUES (?, '审核中', ?, 1)`,
          [ownerId, (((minCat as any[])[0]?.m ?? 1) - 1)]
        );
        targetId = (ins as any).insertId;
      }
      // Move existing row, or insert a new one for the creator
      const [existing] = await conn.execute(
        `SELECT c.id FROM cardCategoryItems c JOIN cardCategories cat ON c.categoryId = cat.id
         WHERE c.influencerId = ? AND cat.userUnionId = ? LIMIT 1`,
        [influencerId, ownerId]
      );
      const [maxItem] = await conn.execute(
        `SELECT MAX(sortOrder) as m FROM cardCategoryItems WHERE categoryId = ?`,
        [targetId]
      );
      const nextOrder = (((maxItem as any[])[0]?.m ?? -1) + 1);
      if ((existing as any[])[0]?.id) {
        await conn.execute(
          `UPDATE cardCategoryItems SET categoryId = ?, sortOrder = ? WHERE id = ?`,
          [targetId, nextOrder, (existing as any[])[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO cardCategoryItems (categoryId, influencerId, sortOrder, isPinned) VALUES (?, ?, ?, 0)`,
          [targetId, influencerId, nextOrder]
        );
      }
    }
  } catch { /* best effort — don't fail the submit */ }
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

      // Trashed cards (hidden=2) are invisible to everyone in the main list
      conditions.push(ne(influencers.hidden, 2));

      // Non-admin users only see their OWN cards (server-side isolation);
      // unauthenticated callers see nothing. Admin sees everything.
      if (!isAdmin) {
        conditions.push(eq(influencers.hidden, 0));
        if (!ctx.user?.unionId) {
          return { items: [], total: 0 };
        }
        conditions.push(eq(influencers.createdByUnionId, ctx.user.unionId));
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
      // Trashed cards are not viewable (restore them from the recycle bin first)
      if (row.hidden === 2) return null;
      // Non-admin cannot see hidden cards
      if (row.hidden === 1 && ctx.user?.role !== "admin") return null;
      // Non-admin can only view their own cards
      if (ctx.user?.role !== "admin" && row.createdByUnionId !== ctx.user?.unionId) return null;
      return toDbRecord(row);
    }),

  // ─── 查重（添加前的服务端预检，前端不可绕过）─────────────────
  checkDuplicate: authedQuery
    .input(z.object({
      name: z.string().min(1),
      profileUrl: z.string().nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const matches = await findDuplicates({
        name: input.name,
        profileUrl: input.profileUrl,
        selfUnionId: ctx.user.unionId,
        testMode: ctx.testMode,
      });
      return { matches };
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
      userPriceLocal: z.number().nullable().optional(),
      userPriceCurrency: z.string().nullable().optional(),
      coopTypes: z.string().nullable().optional(),
      audienceGender: z.any().optional(),
      audienceAge: z.any().optional(),
      audienceDevices: z.any().optional(),
      topPosts: z.any().optional(),
      force: z.boolean().optional(), // 查重弹窗确认后放行（"自己同链接"的纯重复仍阻断）
    }))
    .mutation(async ({ input, ctx }) => {
      // 服务端强制查重：前端预检可被绕过，这里兜底
      const dupMatches = await findDuplicates({
        name: input.name,
        profileUrl: input.profileUrl,
        selfUnionId: ctx.user.unionId,
        testMode: ctx.testMode,
      });
      if (dupMatches.length > 0) {
        const selfLink = dupMatches.some((m) => m.isSelf && m.matchType === "link");
        if (selfLink) {
          throw new TRPCError({ code: "CONFLICT", message: "你已创建过该网红（主页链接相同），无需重复添加" });
        }
        if (!input.force) {
          throw new TRPCError({ code: "CONFLICT", message: "检测到重复网红，请先与相关人员确认" });
        }
      }
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
        userPriceLocal: input.userPriceLocal ?? null,
        userPriceCurrency: input.userPriceCurrency ?? null,
        audienceGender: serializeJsonField(input.audienceGender),
        audienceAge: serializeJsonField(input.audienceAge),
        audienceDevices: serializeJsonField(input.audienceDevices),
        topPosts: serializeJsonField(input.topPosts),
        createdByUnionId: ctx.user.unionId,
        hidden: 0,
        isTest: ctx.testMode ? 1 : 0,
      });
      const insertId = Number(result[0].insertId);

      // 新建网红在同一请求内直接进入创建者的「审核中」分类，
      // 前端无需再单独调 assignCard（消除第二次往返，卡片秒上屏）
      await moveIntoReview(insertId);

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

  // ─── Delete (soft → recycle bin) ───────────────────────────
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
      await db.update(influencers).set({
        hidden: 2,
        deletedAt: getBeijingTimeFull(),
        deletedByUnionId: ctx.user.unionId,
      }).where(eq(influencers.id, input.id));
      return { success: true };
    }),

  // ─── Recycle Bin ───────────────────────────────────────────
  // Admin sees every trashed card; users see only cards they trashed.
  trashList: authedQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      const conditions: any[] = [eq(influencers.hidden, 2)];
      if (ctx.user.role !== "admin") {
        conditions.push(eq(influencers.deletedByUnionId, ctx.user.unionId));
      }
      const rows = await db
        .select()
        .from(influencers)
        .where(and(...conditions))
        .orderBy(desc(influencers.deletedAt));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        handle: row.handle,
        platform: row.platform,
        avatar: row.avatar,
        niche: row.niche,
        location: row.location,
        deletedAt: row.deletedAt,
        deletedByUnionId: row.deletedByUnionId,
        createdByUnionId: row.createdByUnionId,
      }));
    }),

  restore: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      if (!existing[0] || existing[0].hidden !== 2) {
        throw new TRPCError({ code: "NOT_FOUND", message: "垃圾箱中不存在此网红" });
      }
      if (ctx.user.role !== "admin" && existing[0].deletedByUnionId !== ctx.user.unionId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权恢复此网红" });
      }
      await db.update(influencers).set({
        hidden: 0,
        deletedAt: null,
        deletedByUnionId: null,
      }).where(eq(influencers.id, input.id));
      return { success: true };
    }),

  destroy: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(influencers).where(eq(influencers.id, input.id)).limit(1);
      if (!existing[0] || existing[0].hidden !== 2) {
        throw new TRPCError({ code: "NOT_FOUND", message: "垃圾箱中不存在此网红" });
      }
      if (ctx.user.role !== "admin" && existing[0].deletedByUnionId !== ctx.user.unionId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权彻底删除此网红" });
      }
      await db.delete(influencers).where(eq(influencers.id, input.id));
      // Clean up related records so no orphan rows remain
      try {
        const conn = await getRawConnection();
        await conn.execute(`DELETE FROM cardCategoryItems WHERE influencerId = ?`, [input.id]);
        await conn.execute(`DELETE FROM negotiationRecords WHERE influencerId = ?`, [input.id]);
        await conn.execute(`DELETE FROM scriptReviews WHERE influencerId = ?`, [input.id]);
        await conn.execute(`DELETE FROM videoReviews WHERE influencerId = ?`, [input.id]);
        await conn.execute(`DELETE FROM postRecords WHERE influencerId = ?`, [input.id]);
      } catch { /* ignore cleanup failure */ }
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
      // Price decided → move the card out of the locked "审核中" category
      if (input.price > 0) await moveOutOfReview(input.id);
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
      // Decision made → also release from "审核中"
      await moveOutOfReview(input.id);
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
