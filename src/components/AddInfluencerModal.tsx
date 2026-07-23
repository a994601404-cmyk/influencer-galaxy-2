import { useState, useEffect } from "react";
import { useCreateInfluencer, useCreateNegotiation } from "@/lib/influencer-api";
import { CURRENCY_OPTIONS, convertToUSD, convertToUSDSync, parseAmountInput, prefetchRates } from "@/lib/currency";
import { COOP_TYPE_OPTIONS, coopTypesToJson, type CoopTypeItem } from "@/lib/coop-types";
import { SELECTABLE_NICHES } from "@/lib/niche-map";
import CountrySelect from "@/components/CountrySelect";
import {
  Plus, X, Loader2, AlertCircle, Trash2, Link2,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (inf: any) => void;
}

function nowBeijing(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
}

const LINK_PLATFORM_OPTIONS = ["Instagram", "TikTok", "YouTube", "X", "小红书", "抖音", "其他"];

interface LinkRow {
  platform: string;
  url: string;
}

// Derive a handle for the (hidden) DB column: prefer the last path segment
// of the first profile link, otherwise fall back to the influencer name.
function deriveHandle(name: string, links: LinkRow[]): string {
  const firstUrl = links.find((l) => l.url.trim())?.url.trim();
  if (firstUrl) {
    try {
      const u = new URL(firstUrl.startsWith("http") ? firstUrl : `https://${firstUrl}`);
      const segments = u.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return `@${last}`.slice(0, 255);
    } catch { /* fall through */ }
  }
  const fromName = name.trim().toLowerCase().replace(/\s+/g, "");
  return (`@${fromName || "user"}`).slice(0, 255);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[11px] font-bold text-brand tracking-wider">{children}</span>
      <div className="flex-1 h-px bg-hover" />
    </div>
  );
}

export default function AddInfluencerModal({ open, onClose, onAdded }: Props) {
  // ── 网红基础信息 ──
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram");
  const [formNiche, setFormNiche] = useState("lifestyle");
  const [formGender, setFormGender] = useState("other");
  const [formLocation, setFormLocation] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([{ platform: "Instagram", url: "" }]);

  // ── 合作详情 ──
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formLocalPrice, setFormLocalPrice] = useState("");
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [coopTypes, setCoopTypes] = useState<CoopTypeItem[]>([]);
  const [formBio, setFormBio] = useState("");

  const [formError, setFormError] = useState("");

  // Prefetch exchange rates when modal opens
  useEffect(() => {
    if (open) prefetchRates();
  }, [open]);

  // Update USD preview when price or currency changes
  useEffect(() => {
    const amount = parseAmountInput(formLocalPrice);
    if (amount > 0) {
      setUsdPreview(convertToUSDSync(amount, formCurrency));
      convertToUSD(amount, formCurrency).then(setUsdPreview).catch(() => {});
    } else {
      setUsdPreview(null);
    }
  }, [formLocalPrice, formCurrency]);

  // Custom niches (keys stored in localStorage; display names in customNicheNames)
  const [customNiches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("customNiches") || "[]"); } catch { return []; }
  });
  const [customNicheNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("customNicheNames") || "{}"); } catch { return {}; }
  });
  const [showAddNiche, setShowAddNiche] = useState(false);
  const [newNicheName, setNewNicheName] = useState("");

  const createMutation = useCreateInfluencer();
  const createNegMutation = useCreateNegotiation();

  const allNiches: Record<string, string> = { ...SELECTABLE_NICHES };
  customNiches.forEach((key) => { if (!allNiches[key]) allNiches[key] = customNicheNames[key] || key; });

  const handleAddCustomNiche = () => {
    const name = newNicheName.trim();
    if (!name) return;
    const key = "custom_" + Date.now();
    const updated = [...customNiches, key];
    localStorage.setItem("customNiches", JSON.stringify(updated));
    const names: Record<string, string> = JSON.parse(localStorage.getItem("customNicheNames") || "{}");
    names[key] = name;
    localStorage.setItem("customNicheNames", JSON.stringify(names));
    setNewNicheName("");
    setShowAddNiche(false);
    setFormNiche(key);
  };

  const toggleCoopType = (platform: string, type: string) => {
    setCoopTypes((prev) => {
      const existing = prev.find((i) => i.platform === platform);
      if (existing) {
        if (existing.types.includes(type)) {
          const newTypes = existing.types.filter((t) => t !== type);
          if (newTypes.length === 0) return prev.filter((i) => i.platform !== platform);
          return prev.map((i) => i.platform === platform ? { ...i, types: newTypes } : i);
        } else {
          return prev.map((i) => i.platform === platform ? { ...i, types: [...i.types, type] } : i);
        }
      } else {
        return [...prev, { platform, types: [type] }];
      }
    });
  };

  const isCoopSelected = (platform: string, type: string) => {
    return coopTypes.some((i) => i.platform === platform && i.types.includes(type));
  };

  // Link rows helpers
  const updateLink = (idx: number, patch: Partial<LinkRow>) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLinkRow = () => setLinks((prev) => [...prev, { platform: "其他", url: "" }]);
  const removeLinkRow = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setFormName(""); setFormPlatform("instagram"); setFormNiche("lifestyle");
    setFormGender("other"); setFormLocation(""); setLinks([{ platform: "Instagram", url: "" }]);
    setFormCurrency("USD"); setFormLocalPrice(""); setFormError("");
    setCoopTypes([]); setFormBio("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("请填写名称"); return; }
    setFormError("");
    const validLinks = links.filter((l) => l.url.trim());
    const localAmount = parseAmountInput(formLocalPrice);
    const usdPrice = localAmount > 0 ? await convertToUSD(localAmount, formCurrency) : 0;
    const isForeign = formCurrency !== "USD" && localAmount > 0;
    createMutation.mutate({
      name: formName.trim(),
      handle: deriveHandle(formName, validLinks),
      platform: formPlatform as any,
      avatar: null,
      bio: formBio.trim() || null,
      niche: formNiche || null,
      location: formLocation || null,
      gender: formGender as any,
      profileUrl: validLinks.length > 0 ? JSON.stringify(validLinks.map((l) => ({ platform: l.platform, url: l.url.trim() }))) : null,
      userPrice: usdPrice,
      userPriceLocal: isForeign ? localAmount : null,
      userPriceCurrency: isForeign ? formCurrency : null,
      coopTypes: coopTypes.length > 0 ? coopTypesToJson(coopTypes) : null,
    }, {
      onSuccess: (inf) => {
        if (usdPrice > 0) {
          createNegMutation.mutate({
            influencerId: inf.id,
            userPrice: usdPrice,
            adminPrice: 0,
            userPriceLocal: isForeign ? localAmount : null,
            userPriceCurrency: isForeign ? formCurrency : null,
            notes: `添加网红 - 报价 ${formCurrency} ${formLocalPrice} = USD ${usdPrice}`,
            createdAt: nowBeijing(),
          });
        }
        onAdded(inf);
        resetForm();
      },
      onError: (err: any) => setFormError(err.message || "添加失败"),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] mx-4 max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-content flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand" />添加新网红
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ═══ 网红基础信息 ═══ */}
          <SectionTitle>网红基础信息</SectionTitle>

          {/* Name + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-faint mb-1 block">名称 *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Lisa Chen" required
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
            </div>
            <div>
              <label className="text-[11px] text-faint mb-1 block">平台</label>
              <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="xiaohongshu">小红书</option>
                <option value="douyin">抖音</option>
              </select>
            </div>
          </div>

          {/* Niche */}
          <div>
            <label className="text-[11px] text-faint mb-1 block">领域</label>
            <div className="relative">
              <select value={formNiche} onChange={(e) => setFormNiche(e.target.value)}
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30 pr-16">
                {Object.entries(allNiches).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" onClick={() => setShowAddNiche(!showAddNiche)}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-brand hover:text-content transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {showAddNiche && (
              <div className="mt-2 flex items-center gap-2">
                <input value={newNicheName} onChange={(e) => setNewNicheName(e.target.value)}
                  placeholder="新领域名称" autoFocus
                  className="flex-1 bg-base border border-brand/20 rounded-lg px-2 py-1 text-xs text-content placeholder:text-faint focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomNiche(); } }} />
                <button type="button" onClick={handleAddCustomNiche} className="px-2 py-1 rounded bg-lime text-black text-[10px] font-bold">添加</button>
                <button type="button" onClick={() => { setShowAddNiche(false); setNewNicheName(""); }} className="px-2 py-1 rounded bg-hover text-faint text-[10px]">取消</button>
              </div>
            )}
          </div>

          {/* Gender + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-faint mb-1 block">性别</label>
              <select value={formGender} onChange={(e) => setFormGender(e.target.value)}
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30">
                <option value="other">其他</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-faint mb-1 block">国家/地区</label>
              <CountrySelect value={formLocation} onChange={setFormLocation} />
            </div>
          </div>

          {/* Profile links (multiple, each with a platform note) */}
          <div>
            <label className="text-[11px] text-faint mb-1 block">主页链接（可添加多个）</label>
            <div className="space-y-2">
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={link.platform}
                    onChange={(e) => updateLink(idx, { platform: e.target.value })}
                    className="w-28 flex-shrink-0 bg-base border border-line rounded-xl px-2 py-2 text-xs text-content focus:outline-none focus:border-brand/30"
                  >
                    {LINK_PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(idx, { url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30"
                  />
                  {links.length > 1 && (
                    <button type="button" onClick={() => removeLinkRow(idx)}
                      className="w-8 h-8 flex-shrink-0 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLinkRow}
                className="flex items-center gap-1.5 text-[11px] text-cy/70 hover:text-cy transition-colors">
                <Link2 className="w-3 h-3" />再加一个链接
              </button>
            </div>
          </div>

          {/* ═══ 合作详情 ═══ */}
          <SectionTitle>合作详情</SectionTitle>

          {/* Currency + Price */}
          <div>
            <label className="text-[11px] text-faint mb-1 block">网红报价</label>
            <div className="flex items-center gap-2">
              <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}
                className="w-28 bg-base border border-line rounded-xl px-2 py-2 text-sm text-content focus:outline-none focus:border-brand/30">
                {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input type="number" value={formLocalPrice} onChange={(e) => setFormLocalPrice(e.target.value)}
                placeholder={`输入${formCurrency}金额`}
                className="flex-1 bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
            </div>
            {usdPreview !== null && usdPreview > 0 && (
              <p className="text-[10px] text-brand mt-1">
                ≈ ${usdPreview.toLocaleString()} USD
              </p>
            )}
          </div>

          {/* Cooperation Types */}
          <div>
            <label className="text-[11px] text-faint mb-2 block">合作方式（可多选）</label>
            <div className="space-y-2">
              {Object.entries(COOP_TYPE_OPTIONS).map(([platform, types]) => (
                <div key={platform} className="p-2 rounded-lg bg-hover">
                  <p className="text-[10px] font-medium text-content mb-1.5">{platform}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((type) => {
                      const selected = isCoopSelected(platform, type);
                      return (
                        <button key={type} type="button" onClick={() => toggleCoopType(platform, type)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                            selected
                              ? "bg-lime/15 text-brand border-brand/30"
                              : "bg-hover text-sub border-line hover:bg-hover"
                          }`}>
                          {selected && "✓ "}{type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bio (备注) */}
          <div>
            <label className="text-[11px] text-faint mb-1 block">备注</label>
            <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} placeholder="合作备注..."
              rows={2} className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-line text-faint text-sm font-medium hover:bg-hover transition-all">
              取消
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="flex-1 btn-lime flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
