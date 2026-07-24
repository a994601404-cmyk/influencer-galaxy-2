// 去重机制：链接/名称归一化工具（服务端专用，逻辑与前端 parseProfileLinks 兼容）
//
// 比对键设计：
//   - 已知平台链接 → "平台:handle"，例如 instagram:lisachen、tiktok:@lisa 归一为 tiktok:lisa
//     这样 https://www.instagram.com/foo/?utm=xx 与 instagram.com/foo 视为同一人
//   - 未知平台链接 → "url:host/path"（去协议/www/末尾斜杠/查询串），兜底精确重复
//   - 名称 → 去全部空白 + 小写（"John Doe" 与 "johndoe" 视为同名，仅弱匹配）

export function normalizeNameKey(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function extractLinkKey(rawUrl: string): string | null {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
  const first = segs[0] || "";

  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    if (!first || ["p", "reel", "reels", "stories", "explore", "accounts"].includes(first)) return null;
    return `instagram:${first}`;
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const h = first.replace(/^@/, "");
    if (!h || ["discover", "tag", "music", "video"].includes(h)) return null;
    return `tiktok:${h}`;
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    const h = first.replace(/^@/, "");
    if (!h || ["watch", "shorts", "playlist", "results", "feed"].includes(h)) return null;
    return `youtube:${h}`;
  }
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) {
    if (!first || ["i", "home", "explore", "search", "hashtag", "settings"].includes(first)) return null;
    return `x:${first}`;
  }
  // 未知平台（小红书/抖音/个人站等）：归一化整条 URL 作兜底键
  const path = segs.join("/");
  return `url:${host}${path ? "/" + path : ""}`;
}

// profileUrl 兼容两种格式：JSON 数组 [{platform,url}] 或旧的单链接字符串
export function extractKeysFromProfileUrl(profileUrl: string | null | undefined): string[] {
  if (!profileUrl) return [];
  const trimmed = profileUrl.trim();
  if (!trimmed) return [];
  const keys = new Set<string>();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        for (const x of arr) {
          if (x && typeof x.url === "string") {
            const k = extractLinkKey(x.url);
            if (k) keys.add(k);
          }
        }
      }
    } catch {
      // fall through
    }
  } else {
    const k = extractLinkKey(trimmed);
    if (k) keys.add(k);
  }
  return [...keys];
}
