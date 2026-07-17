// ─── Country/Region Data ─────────────────────────────────────
// Format: 🇺🇸-US-美国
// Special handling: 港澳台标注中国台湾、中国香港、中国澳门

export interface CountryOption {
  flag: string;   // Emoji flag
  code: string;   // ISO code / short code
  name: string;   // Chinese name
}

export const COUNTRIES: CountryOption[] = [
  // ── Special: China Regions ──
  { flag: "🇨🇳", code: "CN", name: "中国大陆" },
  { flag: "🇭🇰", code: "HK", name: "中国香港" },
  { flag: "🇲🇴", code: "MO", name: "中国澳门" },
  { flag: "🇨🇳", code: "TW", name: "中国台湾" },

  // ── Asia ──
  { flag: "🇯🇵", code: "JP", name: "日本" },
  { flag: "🇰🇷", code: "KR", name: "韩国" },
  { flag: "🇸🇬", code: "SG", name: "新加坡" },
  { flag: "🇹🇭", code: "TH", name: "泰国" },
  { flag: "🇲🇾", code: "MY", name: "马来西亚" },
  { flag: "🇮🇩", code: "ID", name: "印度尼西亚" },
  { flag: "🇵🇭", code: "PH", name: "菲律宾" },
  { flag: "🇻🇳", code: "VN", name: "越南" },
  { flag: "🇮🇳", code: "IN", name: "印度" },
  { flag: "🇧🇩", code: "BD", name: "孟加拉国" },
  { flag: "🇵🇰", code: "PK", name: "巴基斯坦" },
  { flag: "🇱🇰", code: "LK", name: "斯里兰卡" },
  { flag: "🇳🇵", code: "NP", name: "尼泊尔" },
  { flag: "🇲🇲", code: "MM", name: "缅甸" },
  { flag: "🇰🇭", code: "KH", name: "柬埔寨" },
  { flag: "🇱🇦", code: "LA", name: "老挝" },
  { flag: "🇧🇳", code: "BN", name: "文莱" },
  { flag: "🇹🇱", code: "TL", name: "东帝汶" },
  { flag: "🇲🇻", code: "MV", name: "马尔代夫" },
  { flag: "🇧🇹", code: "BT", name: "不丹" },
  { flag: "🇲🇳", code: "MN", name: "蒙古" },
  { flag: "🇰🇿", code: "KZ", name: "哈萨克斯坦" },
  { flag: "🇺🇿", code: "UZ", name: "乌兹别克斯坦" },
  { flag: "🇹🇲", code: "TM", name: "土库曼斯坦" },
  { flag: "🇰🇬", code: "KG", name: "吉尔吉斯斯坦" },
  { flag: "🇹🇯", code: "TJ", name: "塔吉克斯坦" },
  { flag: "🇦🇫", code: "AF", name: "阿富汗" },
  { flag: "🇮🇷", code: "IR", name: "伊朗" },
  { flag: "🇮🇶", code: "IQ", name: "伊拉克" },
  { flag: "🇸🇾", code: "SY", name: "叙利亚" },
  { flag: "🇱🇧", code: "LB", name: "黎巴嫩" },
  { flag: "🇯🇴", code: "JO", name: "约旦" },
  { flag: "🇮🇱", code: "IL", name: "以色列" },
  { flag: "🇵🇸", code: "PS", name: "巴勒斯坦" },
  { flag: "🇸🇦", code: "SA", name: "沙特阿拉伯" },
  { flag: "🇦🇪", code: "AE", name: "阿联酋" },
  { flag: "🇶🇦", code: "QA", name: "卡塔尔" },
  { flag: "🇰🇼", code: "KW", name: "科威特" },
  { flag: "🇧🇭", code: "BH", name: "巴林" },
  { flag: "🇴🇲", code: "OM", name: "阿曼" },
  { flag: "🇾🇪", code: "YE", name: "也门" },
  { flag: "🇹🇷", code: "TR", name: "土耳其" },
  { flag: "🇬🇪", code: "GE", name: "格鲁吉亚" },
  { flag: "🇦🇲", code: "AM", name: "亚美尼亚" },
  { flag: "🇦🇿", code: "AZ", name: "阿塞拜疆" },
  { flag: "🇰🇵", code: "KP", name: "朝鲜" },

  // ── Europe ──
  { flag: "🇬🇧", code: "GB", name: "英国" },
  { flag: "🇫🇷", code: "FR", name: "法国" },
  { flag: "🇩🇪", code: "DE", name: "德国" },
  { flag: "🇮🇹", code: "IT", name: "意大利" },
  { flag: "🇪🇸", code: "ES", name: "西班牙" },
  { flag: "🇵🇹", code: "PT", name: "葡萄牙" },
  { flag: "🇳🇱", code: "NL", name: "荷兰" },
  { flag: "🇧🇪", code: "BE", name: "比利时" },
  { flag: "🇨🇭", code: "CH", name: "瑞士" },
  { flag: "🇦🇹", code: "AT", name: "奥地利" },
  { flag: "🇸🇪", code: "SE", name: "瑞典" },
  { flag: "🇳🇴", code: "NO", name: "挪威" },
  { flag: "🇩🇰", code: "DK", name: "丹麦" },
  { flag: "🇫🇮", code: "FI", name: "芬兰" },
  { flag: "🇮🇸", code: "IS", name: "冰岛" },
  { flag: "🇮🇪", code: "IE", name: "爱尔兰" },
  { flag: "🇵🇱", code: "PL", name: "波兰" },
  { flag: "🇨🇿", code: "CZ", name: "捷克" },
  { flag: "🇸🇰", code: "SK", name: "斯洛伐克" },
  { flag: "🇭🇺", code: "HU", name: "匈牙利" },
  { flag: "🇷🇴", code: "RO", name: "罗马尼亚" },
  { flag: "🇧🇬", code: "BG", name: "保加利亚" },
  { flag: "🇭🇷", code: "HR", name: "克罗地亚" },
  { flag: "🇸🇮", code: "SI", name: "斯洛文尼亚" },
  { flag: "🇪🇪", code: "EE", name: "爱沙尼亚" },
  { flag: "🇱🇻", code: "LV", name: "拉脱维亚" },
  { flag: "🇱🇹", code: "LT", name: "立陶宛" },
  { flag: "🇺🇦", code: "UA", name: "乌克兰" },
  { flag: "🇧🇾", code: "BY", name: "白俄罗斯" },
  { flag: "🇷🇺", code: "RU", name: "俄罗斯" },
  { flag: "🇷🇸", code: "RS", name: "塞尔维亚" },
  { flag: "🇧🇦", code: "BA", name: "波黑" },
  { flag: "🇲🇰", code: "MK", name: "北马其顿" },
  { flag: "🇦🇱", code: "AL", name: "阿尔巴尼亚" },
  { flag: "🇲🇪", code: "ME", name: "黑山" },
  { flag: "🇲🇩", code: "MD", name: "摩尔多瓦" },
  { flag: "🇨🇾", code: "CY", name: "塞浦路斯" },
  { flag: "🇲🇹", code: "MT", name: "马耳他" },
  { flag: "🇱🇺", code: "LU", name: "卢森堡" },
  { flag: "🇲🇨", code: "MC", name: "摩纳哥" },
  { flag: "🇦🇩", code: "AD", name: "安道尔" },
  { flag: "🇱🇮", code: "LI", name: "列支敦士登" },
  { flag: "🇸🇲", code: "SM", name: "圣马力诺" },
  { flag: "🇬🇷", code: "GR", name: "希腊" },

  // ── North America ──
  { flag: "🇺🇸", code: "US", name: "美国" },
  { flag: "🇨🇦", code: "CA", name: "加拿大" },
  { flag: "🇲🇽", code: "MX", name: "墨西哥" },
  { flag: "🇬🇹", code: "GT", name: "危地马拉" },
  { flag: "🇧🇿", code: "BZ", name: "伯利兹" },
  { flag: "🇸🇻", code: "SV", name: "萨尔瓦多" },
  { flag: "🇭🇳", code: "HN", name: "洪都拉斯" },
  { flag: "🇳🇮", code: "NI", name: "尼加拉瓜" },
  { flag: "🇨🇷", code: "CR", name: "哥斯达黎加" },
  { flag: "🇵🇦", code: "PA", name: "巴拿马" },
  { flag: "🇨🇺", code: "CU", name: "古巴" },
  { flag: "🇯🇲", code: "JM", name: "牙买加" },
  { flag: "🇭🇹", code: "HT", name: "海地" },
  { flag: "🇩🇴", code: "DO", name: "多米尼加" },
  { flag: "🇹🇹", code: "TT", name: "特立尼达和多巴哥" },
  { flag: "🇧🇸", code: "BS", name: "巴哈马" },
  { flag: "🇧🇧", code: "BB", name: "巴巴多斯" },

  // ── South America ──
  { flag: "🇧🇷", code: "BR", name: "巴西" },
  { flag: "🇦🇷", code: "AR", name: "阿根廷" },
  { flag: "🇨🇱", code: "CL", name: "智利" },
  { flag: "🇨🇴", code: "CO", name: "哥伦比亚" },
  { flag: "🇵🇪", code: "PE", name: "秘鲁" },
  { flag: "🇻🇪", code: "VE", name: "委内瑞拉" },
  { flag: "🇪🇨", code: "EC", name: "厄瓜多尔" },
  { flag: "🇧🇴", code: "BO", name: "玻利维亚" },
  { flag: "🇵🇾", code: "PY", name: "巴拉圭" },
  { flag: "🇺🇾", code: "UY", name: "乌拉圭" },
  { flag: "🇬🇾", code: "GY", name: "圭亚那" },
  { flag: "🇸🇷", code: "SR", name: "苏里南" },

  // ── Oceania ──
  { flag: "🇦🇺", code: "AU", name: "澳大利亚" },
  { flag: "🇳🇿", code: "NZ", name: "新西兰" },
  { flag: "🇫🇯", code: "FJ", name: "斐济" },
  { flag: "🇵🇬", code: "PG", name: "巴布亚新几内亚" },

  // ── Africa ──
  { flag: "🇪🇬", code: "EG", name: "埃及" },
  { flag: "🇿🇦", code: "ZA", name: "南非" },
  { flag: "🇳🇬", code: "NG", name: "尼日利亚" },
  { flag: "🇰🇪", code: "KE", name: "肯尼亚" },
  { flag: "🇪🇹", code: "ET", name: "埃塞俄比亚" },
  { flag: "🇬🇭", code: "GH", name: "加纳" },
  { flag: "🇹🇿", code: "TZ", name: "坦桑尼亚" },
  { flag: "🇺🇬", code: "UG", name: "乌干达" },
  { flag: "🇲🇦", code: "MA", name: "摩洛哥" },
  { flag: "🇹🇳", code: "TN", name: "突尼斯" },
  { flag: "🇩🇿", code: "DZ", name: "阿尔及利亚" },
  { flag: "🇱🇾", code: "LY", name: "利比亚" },
  { flag: "🇸🇩", code: "SD", name: "苏丹" },
  { flag: "🇸🇴", code: "SO", name: "索马里" },
  { flag: "🇿🇼", code: "ZW", name: "津巴布韦" },
  { flag: "🇿🇲", code: "ZM", name: "赞比亚" },
  { flag: "🇧🇼", code: "BW", name: "博茨瓦纳" },
  { flag: "🇲🇿", code: "MZ", name: "莫桑比克" },
  { flag: "🇲🇬", code: "MG", name: "马达加斯加" },
  { flag: "🇸🇳", code: "SN", name: "塞内加尔" },
  { flag: "🇲🇱", code: "ML", name: "马里" },
  { flag: "🇧🇫", code: "BF", name: "布基纳法索" },
  { flag: "🇳🇪", code: "NE", name: "尼日尔" },
  { flag: "🇹🇩", code: "TD", name: "乍得" },
  { flag: "🇨🇲", code: "CM", name: "喀麦隆" },
  { flag: "🇨🇩", code: "CD", name: "刚果（金）" },
  { flag: "🇨🇬", code: "CG", name: "刚果（布）" },
  { flag: "🇬🇦", code: "GA", name: "加蓬" },
  { flag: "🇦🇴", code: "AO", name: "安哥拉" },
  { flag: "🇳🇦", code: "NA", name: "纳米比亚" },
  { flag: "🇷🇼", code: "RW", name: "卢旺达" },
  { flag: "🇧🇮", code: "BI", name: "布隆迪" },

  // ── Other ──
  { flag: "🇶🇦", code: "OTHER", name: "其他" },
];

// Lookup helper: find country by any input (code, name, flag)
export function findCountry(input: string): CountryOption | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase();
  return COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === normalized ||
      c.name.toLowerCase() === normalized ||
      `${c.flag}-${c.code}-${c.name}` === input
  );
}

// Format display: 🇺🇸-US-美国
export function formatCountry(input: string): string {
  if (!input) return "";
  // Already in full format
  if (input.includes("-")) return input;
  // Try to find and format
  const found = findCountry(input);
  if (found) return `${found.flag}-${found.code}-${found.name}`;
  return input;
}

// Extract flag + name for compact display (e.g. "🇺🇸 美国")
export function displayCountry(input: string): string {
  if (!input) return "";
  const found = findCountry(input);
  if (found) return `${found.flag} ${found.name}`;
  return input;
}

// Extract just the flag for icon display
export function countryFlag(input: string): string {
  if (!input) return "";
  const found = findCountry(input);
  return found?.flag || "";
}
