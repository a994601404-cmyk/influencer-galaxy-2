// ─── Frontend Instagram API Service ──────────────────────────
// Calls backend tRPC proxy → RapidAPI → Instagram data

import { trpc } from "@/providers/trpc";

// Check if RapidAPI is configured on the backend
export function useInstagramStatus() {
  return trpc.instagram.status.useQuery(undefined, { retry: false });
}

// Fetch Instagram profile by username
export function useInstagramProfile(username: string) {
  return trpc.instagram.getProfile.useQuery(
    { username },
    { enabled: !!username, retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Fetch Instagram posts by username
export function useInstagramPosts(username: string) {
  return trpc.instagram.getPosts.useQuery(
    { username },
    { enabled: !!username, retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Fetch and normalize influencer data from Instagram
export function useFetchInfluencer(username: string) {
  return trpc.instagram.fetchInfluencer.useQuery(
    { username },
    { enabled: !!username, retry: false, staleTime: 1000 * 60 * 5 }
  );
}

// Type for normalized influencer data from Instagram
export interface InstagramInfluencerData {
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
}

// Format large numbers
export function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}
