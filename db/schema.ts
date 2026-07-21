import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users (Auth) ──────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  // Local email/password auth (scrypt). NULL for OAuth-only accounts.
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordSalt: varchar("passwordSalt", { length: 255 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Influencers (KOLs) ────────────────────────────────────────
export const influencers = mysqlTable("influencers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  handle: varchar("handle", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "xiaohongshu", "douyin"]).notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  engagementRate: decimal("engagementRate", { precision: 4, scale: 2 }).default("0"),
  // Cooperation types (JSON string): [{platform:"instagram",types:["Post","Reel"]}, ...]
  coopTypes: text("coopTypes"),
  niche: varchar("niche", { length: 255 }),
  location: varchar("location", { length: 255 }),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  profileUrl: text("profileUrl"),
  // Pricing
  userPrice: int("userPrice").default(0),
  userPriceUpdatedAt: varchar("userPriceUpdatedAt", { length: 20 }),
  adminPrice: int("adminPrice").default(0),
  adminPriceUpdatedAt: varchar("adminPriceUpdatedAt", { length: 20 }),
  coopStatus: mysqlEnum("coopStatus", ["pending", "cooperating", "not-cooperating"]).default("pending"),
  // Audience (JSON strings)
  audienceGender: text("audienceGender"),
  audienceAge: text("audienceAge"),
  audienceDevices: text("audienceDevices"),
  topPosts: text("topPosts"),
  // Ownership & visibility
  createdByUnionId: varchar("createdByUnionId", { length: 320 }),
  hidden: int("hidden").default(0), // 0 = visible, 1 = hidden
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Influencer = typeof influencers.$inferSelect;
export type InsertInfluencer = typeof influencers.$inferInsert;

// ─── Negotiation Records (谈价记录) ────────────────────────────
export const negotiationRecords = mysqlTable("negotiationRecords", {
  id: serial("id").primaryKey(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  round: int("round").notNull(),
  userPrice: int("userPrice").default(0),
  adminPrice: int("adminPrice").default(0),
  notes: text("notes"),
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  createdAt: varchar("createdAt", { length: 20 }).notNull(), // YYYY-MM-DD
});

export type NegotiationRecord = typeof negotiationRecords.$inferSelect;

// ─── Script Reviews (脚本确认) ─────────────────────────────────
export const scriptReviews = mysqlTable("scriptReviews", {
  id: serial("id").primaryKey(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  round: int("round").notNull(),
  scriptText: text("scriptText").notNull(),
  userNote: text("userNote"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
  adminNote: text("adminNote"),
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  submittedAt: varchar("submittedAt", { length: 20 }).notNull(),
  reviewedAt: varchar("reviewedAt", { length: 20 }),
});

export type ScriptReview = typeof scriptReviews.$inferSelect;

// ─── Video Reviews (视频初稿) ──────────────────────────────────
export const videoReviews = mysqlTable("videoReviews", {
  id: serial("id").primaryKey(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  round: int("round").notNull(),
  videoUrl: text("videoUrl").notNull(),
  videoFileName: varchar("videoFileName", { length: 255 }),
  userNote: text("userNote"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
  adminNote: text("adminNote"),
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  submittedAt: varchar("submittedAt", { length: 20 }).notNull(),
  reviewedAt: varchar("reviewedAt", { length: 20 }),
});

export type VideoReview = typeof videoReviews.$inferSelect;

// ─── Trending Topics ────────────────────────────────────────────
export const trendingTopics = mysqlTable("trendingTopics", {
  id: serial("id").primaryKey(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "xiaohongshu", "douyin", "weibo"]).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  heat: int("heat").default(0),
  relatedInfluencers: text("relatedInfluencers"),
  sourceUrl: text("sourceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrendingTopic = typeof trendingTopics.$inferSelect;

// ─── Scripts ────────────────────────────────────────────────────
export const scripts = mysqlTable("scripts", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productCategory: varchar("productCategory", { length: 255 }),
  sellingPoints: text("sellingPoints").notNull(),
  personaStyle: mysqlEnum("personaStyle", ["koc_share", "expert_review", "lifestyle_vlog", "comedy", "educational"]).default("koc_share"),
  duration: int("duration").default(60),
  scriptContent: text("scriptContent").notNull(),
  status: mysqlEnum("status", ["draft", "generating", "completed", "archived"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Script = typeof scripts.$inferSelect;
export type InsertScript = typeof scripts.$inferInsert;

// ─── Storyboards ────────────────────────────────────────────────
export const storyboards = mysqlTable("storyboards", {
  id: serial("id").primaryKey(),
  scriptId: bigint("scriptId", { mode: "number", unsigned: true }).notNull(),
  sceneIndex: int("sceneIndex").notNull(),
  timestamp: varchar("timestamp", { length: 10 }).notNull(),
  visualDescription: text("visualDescription").notNull(),
  audioDescription: text("audioDescription").notNull(),
  narration: text("narration"),
  generatedImageUrl: text("generatedImageUrl"),
  status: mysqlEnum("status", ["pending", "generating", "completed", "error"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Storyboard = typeof storyboards.$inferSelect;

// ─── Campaigns ──────────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed"]).default("draft"),
  budget: decimal("budget", { precision: 12, scale: 2 }).default("0"),
  spent: decimal("spent", { precision: 12, scale: 2 }).default("0"),
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  conversions: int("conversions").default(0),
  roi: decimal("roi", { precision: 5, scale: 2 }).default("0"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Campaign = typeof campaigns.$inferSelect;

// ─── Campaign Influencers (junction) ────────────────────────────
export const campaignInfluencers = mysqlTable("campaignInfluencers", {
  id: serial("id").primaryKey(),
  campaignId: bigint("campaignId", { mode: "number", unsigned: true }).notNull(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  scriptId: bigint("scriptId", { mode: "number", unsigned: true }),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["pending", "confirmed", "content_sent", "published", "completed"]).default("pending"),
  performanceData: text("performanceData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignInfluencer = typeof campaignInfluencers.$inferSelect;

// ─── Influencer Metrics (tracking) ──────────────────────────────
export const influencerMetrics = mysqlTable("influencerMetrics", {
  id: serial("id").primaryKey(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  metricType: mysqlEnum("metricType", ["followers", "engagement_rate", "likes", "comments", "shares", "views"]).notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).notNull(),
  recordedAt: timestamp("recordAt").defaultNow().notNull(),
});

export type InfluencerMetric = typeof influencerMetrics.$inferSelect;

// ─── Notifications ─────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  receiverUnionId: varchar("receiverUnionId", { length: 320 }).notNull(),
  type: mysqlEnum("type", [
    "influencer_created",
    "negotiation_created",
    "script_created",
    "video_created",
    "negotiation_reviewed",
    "script_reviewed",
    "video_reviewed",
    "post_created",
    "post_reviewed",
    "password_reset_request",
    "password_reset_done",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedId: int("relatedId"),        // 关联记录ID（influencerId 或 negotiation/script/video id）
  relatedType: varchar("relatedType", { length: 50 }), // "influencer" | "negotiation" | "script" | "video"
  isRead: int("isRead").default(0).notNull(), // 0 = unread, 1 = read
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  createdAt: varchar("createdAt", { length: 20 }).notNull(), // YYYY-MM-DD HH:mm
});

export type Notification = typeof notifications.$inferSelect;

// ─── Invitation Codes ─────────────────────────────────────────
export const invitationCodes = mysqlTable("invitationCodes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  usedByUnionId: varchar("usedByUnionId", { length: 320 }),
  usedAt: varchar("usedAt", { length: 20 }),
  createdByUnionId: varchar("createdByUnionId", { length: 320 }),
  createdAt: varchar("createdAt", { length: 20 }).notNull(), // YYYY-MM-DD HH:mm
});

export type InvitationCode = typeof invitationCodes.$inferSelect;

// ─── Post Records (发布记录) ──────────────────────────────────
export const postRecords = mysqlTable("postRecords", {
  id: serial("id").primaryKey(),
  influencerId: bigint("influencerId", { mode: "number", unsigned: true }).notNull(),
  videoUrl: text("videoUrl").notNull(), // 发布视频链接
  nextDayExposures: int("nextDayExposures").default(0), // 次日曝光
  sevenDayExposures: int("sevenDayExposures").default(0), // 7日曝光
  likes: int("likes").default(0), // 点赞
  comments: int("comments").default(0), // 评论
  shares: int("shares").default(0), // 转发
  notes: text("notes"), // 备注
  isTest: int("isTest").default(0), // 0 = production, 1 = test data
  createdAt: varchar("createdAt", { length: 20 }).notNull(), // YYYY-MM-DD
  createdByUnionId: varchar("createdByUnionId", { length: 320 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
  adminNote: text("adminNote"),
  reviewedAt: varchar("reviewedAt", { length: 20 }),
});

export type PostRecord = typeof postRecords.$inferSelect;

// ─── Hashtag Categories ───────────────────────────────────────
export const hashtagCategories = mysqlTable("hashtagCategories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#ccff00"), // hex color
  isTest: int("isTest").default(0),
  createdAt: varchar("createdAt", { length: 20 }).notNull(),
  createdByUnionId: varchar("createdByUnionId", { length: 320 }),
});

export type HashtagCategory = typeof hashtagCategories.$inferSelect;

// ─── Hashtags ──────────────────────────────────────────────────
export const hashtags = mysqlTable("hashtags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // #GlowUp2025
  url: text("url").notNull(), // link to the hashtag page
  categoryId: bigint("categoryId", { mode: "number", unsigned: true }),
  isTest: int("isTest").default(0),
  createdAt: varchar("createdAt", { length: 20 }).notNull(),
  createdByUnionId: varchar("createdByUnionId", { length: 320 }),
});

export type Hashtag = typeof hashtags.$inferSelect;

// ─── API Configurations ────────────────────────────────────────
export const apiConfigs = mysqlTable("apiConfigs", {
  id: serial("id").primaryKey(),
  platform: varchar("platform", { length: 50 }).notNull().unique(), // instagram, tiktok, youtube
  apiKey: varchar("apiKey", { length: 500 }).notNull(),
  apiHost: varchar("apiHost", { length: 255 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ApiConfig = typeof apiConfigs.$inferSelect;
export type InsertApiConfig = typeof apiConfigs.$inferInsert;

// ─── Card Categories ───────────────────────────────────────────
export const cardCategories = mysqlTable("cardCategories", {
  id: serial("id").primaryKey(),
  userUnionId: varchar("userUnionId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isExpanded: int("isExpanded").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const cardCategoryItems = mysqlTable("cardCategoryItems", {
  id: serial("id").primaryKey(),
  categoryId: int("categoryId").notNull(),
  influencerId: int("influencerId").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPinned: int("isPinned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── User Card Preferences (sort order + pin, per-user) ────────
export const userCardPreferences = mysqlTable("userCardPreferences", {
  id: serial("id").primaryKey(),
  userUnionId: varchar("userUnionId", { length: 255 }).notNull(),
  influencerId: int("influencerId").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(), // 0=first, higher=later
  isPinned: int("isPinned").default(0).notNull(),   // 1=pinned, 0=normal
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type UserCardPreference = typeof userCardPreferences.$inferSelect;
