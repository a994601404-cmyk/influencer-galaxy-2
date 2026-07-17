// ─── Social Media API Proxy (YouTube + TikTok + Instagram) ───
// Proxies requests to RapidAPI, keeping API keys secure server-side.
// Each platform has its own RapidAPI host/key env vars.

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { apiConfigs } from "../db/schema.js";
import { eq } from "drizzle-orm";

const db = getDb();

// ─── Cache ────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── Platform Config ──────────────────────────────────────────
// Each platform reads its own env vars so you can use different APIs
interface PlatformConfig {
  apiKey: string;
  apiHost: string;
  infoEndpoint: string;   // profile/user info
  postsEndpoint: string;  // recent posts
  infoParams: (handle: string) => Record<string, string>;
  normalizeProfile: (raw: any) => NormalizedProfile | null;
}

interface NormalizedProfile {
  name: string;
  handle: string;
  platform: string;
  avatar: string;
  bio: string;
  followers: number;
  following?: number;
  posts?: number;
  engagementRate: number;
  niche: string;
  location: string;
  gender: string;
  audienceGender: { male: number; female: number };
  audienceAge: Array<{ range: string; pct: number }>;
  audienceDevices: Array<{ type: string; pct: number }>;
  topPosts: Array<{ title: string; views: number; likes: number }>;
  raw: unknown;
}

// Load config from database first, fallback to env vars
async function getDbConfig(platform: string): Promise<{ apiKey: string; apiHost: string } | null> {
  try {
    const rows = await db
      .select()
      .from(apiConfigs)
      .where(eq(apiConfigs.platform, platform))
      .limit(1);
    if (rows.length > 0 && rows[0].isActive === 1) {
      return { apiKey: rows[0].apiKey, apiHost: rows[0].apiHost };
    }
  } catch {
    // DB may not have the table yet; silently fall through
  }
  return null;
}

function getConfig(platform: string): PlatformConfig | null;
function getConfig(platform: string, dbConfig?: { apiKey: string; apiHost: string }): PlatformConfig | null;
function getConfig(platform: string, dbConfig?: { apiKey: string; apiHost: string }): PlatformConfig | null {
  switch (platform) {
    case "instagram": {
      const key = dbConfig?.apiKey || process.env.RAPIDAPI_KEY || "";
      const host = dbConfig?.apiHost || process.env.RAPIDAPI_INSTAGRAM_HOST || "";
      if (!key || !host) return null;
      return {
        apiKey: key,
        apiHost: host,
        infoEndpoint: "/ig/info/",
        postsEndpoint: "/ig/posts/",
        infoParams: (h) => ({ user_name: h }),
        normalizeProfile: (raw) => {
          const u = raw.user || raw.data || raw;
          return {
            name: u.full_name || u.username || "",
            handle: `@${u.username || ""}`,
            platform: "instagram",
            avatar: u.profile_pic_url || u.hd_profile_pic_url_info?.url || "",
            bio: u.biography || u.bio || "",
            followers: u.follower_count || u.edge_followed_by?.count || 0,
            following: u.following_count || 0,
            posts: u.media_count || u.edge_owner_to_timeline_media?.count || 0,
            engagementRate: 0,
            niche: "lifestyle",
            location: u.city_name || "Unknown",
            gender: "other",
            audienceGender: { male: 30, female: 70 },
            audienceAge: [
              { range: "18-24", pct: 35 }, { range: "25-34", pct: 40 },
              { range: "35-44", pct: 20 }, { range: "45+", pct: 5 },
            ],
            audienceDevices: [
              { type: "Mobile", pct: 82 }, { type: "Desktop", pct: 12 }, { type: "Tablet", pct: 6 },
            ],
            topPosts: [],
            raw: u,
          };
        },
      };
    }
    case "tiktok": {
      const key = dbConfig?.apiKey || process.env.RAPIDAPI_TIKTOK_KEY || process.env.RAPIDAPI_KEY || "";
      const host = dbConfig?.apiHost || process.env.RAPIDAPI_TIKTOK_HOST || "";
      if (!key || !host) return null;
      return {
        apiKey: key,
        apiHost: host,
        infoEndpoint: "/v1/user/info",
        postsEndpoint: "/v1/user/posts",
        infoParams: (h) => ({ username: h }),
        normalizeProfile: (raw) => {
          const u = raw.user || raw.data || raw;
          return {
            name: u.nickname || u.uniqueId || "",
            handle: `@${u.uniqueId || u.username || ""}`,
            platform: "tiktok",
            avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb || "",
            bio: u.signature || u.bio || "",
            followers: u.followerCount || u.stats?.followerCount || 0,
            following: u.followingCount || 0,
            posts: u.videoCount || u.stats?.videoCount || 0,
            engagementRate: 0,
            niche: "lifestyle",
            location: "Unknown",
            gender: "other",
            audienceGender: { male: 30, female: 70 },
            audienceAge: [
              { range: "13-17", pct: 20 }, { range: "18-24", pct: 40 },
              { range: "25-34", pct: 25 }, { range: "35+", pct: 15 },
            ],
            audienceDevices: [
              { type: "Mobile", pct: 95 }, { type: "Desktop", pct: 3 }, { type: "Tablet", pct: 2 },
            ],
            topPosts: [],
            raw: u,
          };
        },
      };
    }
    case "youtube": {
      const key = dbConfig?.apiKey || process.env.RAPIDAPI_YOUTUBE_KEY || process.env.RAPIDAPI_KEY || "";
      const host = dbConfig?.apiHost || process.env.RAPIDAPI_YOUTUBE_HOST || "";
      if (!key || !host) return null;
      return {
        apiKey: key,
        apiHost: host,
        infoEndpoint: "/channel/about",
        postsEndpoint: "/channel/videos",
        infoParams: (h) => ({ handle: h }),
        normalizeProfile: (raw) => {
          const u = raw.channel || raw.data || raw;
          return {
            name: u.title || u.channelName || "",
            handle: `@${u.handle || u.customUrl || u.username || ""}`,
            platform: "youtube",
            avatar: u.avatar?.url || u.thumbnail || u.image || "",
            bio: u.description || u.bio || u.about || "",
            followers: u.subscriberCount || u.subscriber_count || u.stats?.subscribers || 0,
            following: 0,
            posts: u.videoCount || u.videosCount || u.stats?.videos || 0,
            engagementRate: 0,
            niche: "lifestyle",
            location: u.country || u.location || "Unknown",
            gender: "other",
            audienceGender: { male: 40, female: 60 },
            audienceAge: [
              { range: "13-17", pct: 15 }, { range: "18-24", pct: 30 },
              { range: "25-34", pct: 30 }, { range: "35+", pct: 25 },
            ],
            audienceDevices: [
              { type: "Mobile", pct: 60 }, { type: "Desktop", pct: 30 }, { type: "Tablet", pct: 10 },
            ],
            topPosts: [],
            raw: u,
          };
        },
      };
    }
    default:
      return null;
  }
}

// ─── Generic fetch ────────────────────────────────────────────
async function fetchFromRapidAPI(config: PlatformConfig, endpoint: string, params: Record<string, string>) {
  const url = new URL(`https://${config.apiHost}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": config.apiKey,
      "X-RapidAPI-Host": config.apiHost,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Router ───────────────────────────────────────────────────

export const socialRouter = createRouter({
  // Check which platforms are configured
  status: publicQuery.query(async () => {
    const ig = await getDbConfig("instagram");
    const tt = await getDbConfig("tiktok");
    const yt = await getDbConfig("youtube");
    return {
      instagram: !!(ig?.apiKey && ig?.apiHost) || !!getConfig("instagram"),
      tiktok: !!(tt?.apiKey && tt?.apiHost) || !!getConfig("tiktok"),
      youtube: !!(yt?.apiKey && yt?.apiHost) || !!getConfig("youtube"),
    };
  }),

  // Get raw profile info from a platform
  getProfile: publicQuery
    .input(z.object({ platform: z.enum(["instagram", "tiktok", "youtube"]), handle: z.string().min(1) }))
    .query(async ({ input }) => {
      const dbCfg = await getDbConfig(input.platform);
      const config = getConfig(input.platform, dbCfg || undefined);
      if (!config) throw new Error(`${input.platform} API not configured`);

      const cacheKey = `${input.platform}:profile:${input.handle}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const data = await fetchFromRapidAPI(config, config.infoEndpoint, config.infoParams(input.handle));
      setCached(cacheKey, data);
      return data;
    }),

  // Get recent posts
  getPosts: publicQuery
    .input(z.object({ platform: z.enum(["instagram", "tiktok", "youtube"]), handle: z.string().min(1) }))
    .query(async ({ input }) => {
      const dbCfg = await getDbConfig(input.platform);
      const config = getConfig(input.platform, dbCfg || undefined);
      if (!config) throw new Error(`${input.platform} API not configured`);

      const cacheKey = `${input.platform}:posts:${input.handle}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const data = await fetchFromRapidAPI(config, config.postsEndpoint, config.infoParams(input.handle));
      setCached(cacheKey, data);
      return data;
    }),

  // Fetch and normalize influencer data (query - for reactive reads)
  fetchInfluencer: publicQuery
    .input(z.object({ platform: z.enum(["instagram", "tiktok", "youtube"]), handle: z.string().min(1) }))
    .query(async ({ input }) => {
      const dbCfg = await getDbConfig(input.platform);
      const config = getConfig(input.platform, dbCfg || undefined);
      if (!config) throw new Error(`${input.platform} API not configured`);

      const cacheKey = `${input.platform}:norm:${input.handle}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const raw = await fetchFromRapidAPI(config, config.infoEndpoint, config.infoParams(input.handle));
      const normalized = config.normalizeProfile(raw);
      if (!normalized) throw new Error("Failed to parse profile data");
      setCached(cacheKey, normalized);
      return normalized;
    }),

  // Fetch and normalize influencer data (mutation - for button-triggered fetches)
  fetchInfluencerAction: publicQuery
    .input(z.object({ platform: z.enum(["instagram", "tiktok", "youtube"]), handle: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const dbCfg = await getDbConfig(input.platform);
      const config = getConfig(input.platform, dbCfg || undefined);
      if (!config) throw new Error(`${input.platform} API not configured`);

      const raw = await fetchFromRapidAPI(config, config.infoEndpoint, config.infoParams(input.handle));
      const normalized = config.normalizeProfile(raw);
      if (!normalized) throw new Error("Failed to parse profile data");
      return normalized;
    }),
});
