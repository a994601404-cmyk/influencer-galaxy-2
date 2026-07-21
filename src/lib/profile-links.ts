// Parse the profileUrl field which may be either:
//   - a legacy plain URL string ("https://instagram.com/foo")
//   - a JSON array of link objects: [{"platform":"instagram","url":"https://..."}]
// Always returns a normalized array of { platform, url }.

export interface ProfileLink {
  platform: string; // note label, e.g. "Instagram" / "TikTok" / "其他"
  url: string;
}

export function parseProfileLinks(raw: string | null | undefined): ProfileLink[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr
          .filter((x: any) => x && typeof x.url === "string" && x.url.trim())
          .map((x: any) => ({
            platform: typeof x.platform === "string" && x.platform.trim() ? x.platform : "链接",
            url: x.url.trim(),
          }));
      }
    } catch {
      // fall through to legacy handling
    }
  }
  return [{ platform: "主页", url: trimmed }];
}
