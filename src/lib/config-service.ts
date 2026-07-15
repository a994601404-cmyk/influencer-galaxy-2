// ─── API Config Service ──────────────────────────────────────
// Frontend hooks for managing RapidAPI configurations

import { trpc } from "@/providers/trpc";

// List all API configs
export function useApiConfigList() {
  return trpc.config.list.useQuery(undefined, {
    staleTime: 1000 * 30,
  });
}

// Upsert (create/update) a config — admin only
export function useUpsertApiConfig() {
  const utils = trpc.useUtils();
  return trpc.config.upsert.useMutation({
    onSuccess: () => {
      utils.config.list.invalidate();
      utils.config.status.invalidate();
      utils.social.status.invalidate();
    },
  });
}

// Toggle active status — admin only
export function useToggleApiConfig() {
  const utils = trpc.useUtils();
  return trpc.config.toggle.useMutation({
    onSuccess: () => {
      utils.config.list.invalidate();
      utils.config.status.invalidate();
      utils.social.status.invalidate();
    },
  });
}

// Delete config — admin only
export function useDeleteApiConfig() {
  const utils = trpc.useUtils();
  return trpc.config.delete.useMutation({
    onSuccess: () => {
      utils.config.list.invalidate();
      utils.config.status.invalidate();
    },
  });
}

// Get status of all platforms
export function useApiConfigStatus() {
  return trpc.config.status.useQuery(undefined, {
    staleTime: 1000 * 30,
  });
}

// Platform metadata for UI
export interface PlatformMeta {
  key: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  rapidApiUrl: string;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  instagram: {
    key: "instagram",
    label: "Instagram",
    color: "#E1306C",
    icon: "instagram",
    description: "抓取 Instagram 用户资料、粉丝数、最新帖子",
    rapidApiUrl: "https://rapidapi.com/search/instagram",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    color: "#00F2EA",
    icon: "tiktok",
    description: "抓取 TikTok 用户信息、粉丝数据、视频列表",
    rapidApiUrl: "https://rapidapi.com/search/tiktok",
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    color: "#FF0000",
    icon: "youtube",
    description: "抓取 YouTube 频道信息、订阅数、视频数据",
    rapidApiUrl: "https://rapidapi.com/search/youtube",
  },
};
