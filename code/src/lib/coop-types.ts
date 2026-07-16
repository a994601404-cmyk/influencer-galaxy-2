// Cooperation type definitions
export interface CoopTypeItem {
  platform: string;
  types: string[];
}

export const COOP_TYPE_OPTIONS: Record<string, string[]> = {
  Instagram: ["Post", "Reel", "Story", "Highlight"],
  TikTok: ["Video", "Photos"],
  YouTube: ["插播", "专题", "Shorts"],
};

export function formatCoopTypes(jsonStr?: string | null): string {
  if (!jsonStr) return "";
  try {
    const items: CoopTypeItem[] = JSON.parse(jsonStr);
    return items
      .map((i) => `${i.platform}: ${i.types.join(", ")}`)
      .join(" | ");
  } catch {
    return jsonStr;
  }
}

export function coopTypesToJson(items: CoopTypeItem[]): string {
  return JSON.stringify(items);
}

export function parseCoopTypes(jsonStr?: string | null): CoopTypeItem[] {
  if (!jsonStr) return [];
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}

// Platform color mapping
export const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#E4405F",
  TikTok: "#000000",
  YouTube: "#FF0000",
};
