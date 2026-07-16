// ─── Social Media API Service ────────────────────────────────
// Unified interface for Instagram / TikTok / YouTube data
// Calls backend tRPC proxy → RapidAPI → Platform data

import { trpc } from "@/providers/trpc";

// Check which platforms are configured
export function useSocialStatus() {
  return trpc.social.status.useQuery(undefined, { retry: false });
}

// Fetch normalized influencer data from any platform
export function useFetchInfluencer(platform: string, handle: string) {
  const validPlatform = platform as "instagram" | "tiktok" | "youtube";
  return trpc.social.fetchInfluencer.useQuery(
    { platform: validPlatform, handle },
    { enabled: !!handle && ["instagram", "tiktok", "youtube"].includes(platform), retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Raw profile data
export function useSocialProfile(platform: string, handle: string) {
  const validPlatform = platform as "instagram" | "tiktok" | "youtube";
  return trpc.social.getProfile.useQuery(
    { platform: validPlatform, handle },
    { enabled: !!handle && ["instagram", "tiktok", "youtube"].includes(platform), retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Posts
export function useSocialPosts(platform: string, handle: string) {
  const validPlatform = platform as "instagram" | "tiktok" | "youtube";
  return trpc.social.getPosts.useQuery(
    { platform: validPlatform, handle },
    { enabled: !!handle && ["instagram", "tiktok", "youtube"].includes(platform), retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Fetch influencer data via mutation (for button clicks)
export function useFetchInfluencerMutation() {
  const utils = trpc.useUtils();
  return trpc.social.fetchInfluencerAction.useMutation({
    onSuccess: () => {
      utils.social.fetchInfluencer.invalidate();
    },
  });
}

// Type for normalized data
export interface SocialInfluencerData {
  name: string;
  handle: string;
  platform: string;
  avatar: string;
  bio: string;
  followers: number;
  engagementRate: number;
  niche: string;
  location: string;
  gender: string;
  audienceGender: { male: number; female: number };
  audienceAge: Array<{ range: string; pct: number }>;
  audienceDevices: Array<{ type: string; pct: number }>;
  topPosts: Array<{ title: string; views: number; likes: number }>;
  raw: unknown;
  _error?: string;
}

// Format numbers
export function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

// Platform labels
export const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  instagram: { label: "Instagram", color: "#E1306C" },
  tiktok: { label: "TikTok", color: "#00F2EA" },
  youtube: { label: "YouTube", color: "#FF0000" },
  xiaohongshu: { label: "小红书", color: "#FF2442" },
  douyin: { label: "抖音", color: "#000000" },
};

// Which platforms support API auto-fetch
export const API_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
