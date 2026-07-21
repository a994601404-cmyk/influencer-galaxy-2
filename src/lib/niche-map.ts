// Niche display name mapping
// Preset niches with Chinese labels. Legacy keys are kept here so older
// cards still render a proper label; the selectable options live in
// SELECTABLE_NICHES below.
const PRESET_NICHES: Record<string, string> = {
  beauty: "美妆",
  fitness: "健身",
  fashion: "时尚",
  tech: "数码",
  food: "美食",
  travel: "旅行",
  lifestyle: "生活方式",
  "ai-creator": "AI创作者",
  "ai-virtual": "AI 虚拟网红",
  "ai-prompts": "AI prompts博主",
  "ai-vertical": "AI 垂类",
  "tech-general": "科技泛类博主",
  "content-creator": "Content Creator",
  other: "其他",
};

// Niches offered in dropdowns (添加/编辑/筛选)
export const SELECTABLE_NICHES: Record<string, string> = {
  lifestyle: "生活方式",
  "ai-creator": "AI创作者",
  "ai-virtual": "AI 虚拟网红",
  "ai-prompts": "AI prompts博主",
  "ai-vertical": "AI 垂类",
  "tech-general": "科技泛类博主",
  "content-creator": "Content Creator",
  other: "其他",
};

// Get display name for a niche key
export function getNicheLabel(key: string): string {
  if (PRESET_NICHES[key]) return PRESET_NICHES[key];
  // Check custom niches in localStorage
  try {
    const names: Record<string, string> = JSON.parse(localStorage.getItem("customNicheNames") || "{}");
    if (names[key]) return names[key];
  } catch { /* ignore */ }
  // Return key as-is if no mapping found
  return key;
}

// Get all preset niches as options
export function getPresetNicheOptions(): Record<string, string> {
  return { ...PRESET_NICHES };
}

// Get all niches including custom ones
export function getAllNicheOptions(): Record<string, string> {
  const all = { ...PRESET_NICHES };
  try {
    const customKeys: string[] = JSON.parse(localStorage.getItem("customNiches") || "[]");
    const customNames: Record<string, string> = JSON.parse(localStorage.getItem("customNicheNames") || "{}");
    customKeys.forEach((key) => {
      if (!all[key]) all[key] = customNames[key] || key;
    });
  } catch { /* ignore */ }
  return all;
}

// Selectable options = curated list + custom niches (with proper names)
export function getSelectableNicheOptions(): Record<string, string> {
  const all = { ...SELECTABLE_NICHES };
  try {
    const customKeys: string[] = JSON.parse(localStorage.getItem("customNiches") || "[]");
    const customNames: Record<string, string> = JSON.parse(localStorage.getItem("customNicheNames") || "{}");
    customKeys.forEach((key) => {
      if (!all[key]) all[key] = customNames[key] || key;
    });
  } catch { /* ignore */ }
  return all;
}
