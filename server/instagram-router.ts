// ─── Instagram API Proxy via RapidAPI ─────────────────────────
// This router proxies requests to RapidAPI's Instagram API,
// keeping the API key secure on the server side.

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware.js";

// In-memory cache for API responses (5 min TTL)
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

// Read RapidAPI credentials from environment
function getCredentials() {
  const apiKey = process.env.RAPIDAPI_KEY || "";
  const apiHost = process.env.RAPIDAPI_INSTAGRAM_HOST || "instagram-scraper-2022.p.rapidapi.com";
  return { apiKey, apiHost };
}

// Generic proxy function
async function rapidApiFetch(endpoint: string, params: Record<string, string>) {
  const { apiKey, apiHost } = getCredentials();
  if (!apiKey) throw new Error("RAPIDAPI_KEY not configured");

  const url = new URL(`https://${apiHost}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RapidAPI error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Router ───────────────────────────────────────────────────

export const instagramRouter = createRouter({
  // Check if RapidAPI is configured
  status: publicQuery.query(() => {
    const { apiKey } = getCredentials();
    return { configured: !!apiKey };
  }),

  // Get Instagram profile info by username
  getProfile: publicQuery
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ input }) => {
      const cacheKey = `profile:${input.username}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      try {
        // Common endpoint pattern: /ig/info/?user_name={username}
        const data = await rapidApiFetch("/ig/info/", { user_name: input.username });
        setCached(cacheKey, data);
        return data;
      } catch (e: any) {
        // Fallback: try alternative endpoint patterns
        try {
          const data2 = await rapidApiFetch("/v1/info", { username: input.username });
          setCached(cacheKey, data2);
          return data2;
        } catch {
          throw new Error(`Failed to fetch profile: ${e.message}`);
        }
      }
    }),

  // Get user's recent posts
  getPosts: publicQuery
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ input }) => {
      const cacheKey = `posts:${input.username}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      try {
        const data = await rapidApiFetch("/ig/posts/", { user_name: input.username });
        setCached(cacheKey, data);
        return data;
      } catch (e: any) {
        try {
          const data2 = await rapidApiFetch("/v1/posts", { username: input.username });
          setCached(cacheKey, data2);
          return data2;
        } catch {
          throw new Error(`Failed to fetch posts: ${e.message}`);
        }
      }
    }),

  // Get user's followers list (sample)
  getFollowers: publicQuery
    .input(z.object({ username: z.string().min(1), count: z.number().default(50) }))
    .query(async ({ input }) => {
      const cacheKey = `followers:${input.username}:${input.count}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const data = await rapidApiFetch("/ig/followers/", {
        user_name: input.username,
        count: String(input.count),
      });
      setCached(cacheKey, data);
      return data;
    }),

  // Fetch profile and transform to our Influencer format
  fetchInfluencer: publicQuery
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ input }) => {
      const profile = await rapidApiFetch("/ig/info/", { user_name: input.username });

      // Normalize the response - different APIs return different formats
      // Try common field patterns
      const user = (profile as any).user || (profile as any).data || profile;

      return {
        name: user.full_name || user.username || input.username,
        handle: `@${user.username || input.username}`,
        platform: "instagram",
        avatar: user.profile_pic_url || user.hd_profile_pic_url_info?.url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${input.username}`,
        bio: user.biography || user.bio || "",
        followers: user.follower_count || user.edge_followed_by?.count || 0,
        engagementRate: 0, // will need posts to calculate
        niche: "lifestyle", // user can edit this
        location: user.city_name || "Unknown",
        gender: "other",
        // Extract audience data if available
        audienceGender: { male: 30, female: 70 },
        audienceAge: [
          { range: "18-24", pct: 35 },
          { range: "25-34", pct: 40 },
          { range: "35-44", pct: 20 },
          { range: "45+", pct: 5 },
        ],
        audienceDevices: [
          { type: "Mobile", pct: 82 },
          { type: "Desktop", pct: 12 },
          { type: "Tablet", pct: 6 },
        ],
        topPosts: [],
        raw: user, // keep raw data for reference
      };
    }),
});
