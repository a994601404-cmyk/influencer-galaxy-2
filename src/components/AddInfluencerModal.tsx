import { useState, useEffect } from "react";
import { useCreateInfluencer, useCreateNegotiation } from "@/lib/influencer-api";
import { useSocialStatus, useFetchInfluencerMutation } from "@/lib/social-service";
import { formatCountry } from "@/lib/countries";
import { CURRENCY_OPTIONS, convertToUSD, convertToUSDSync, prefetchRates } from "@/lib/currency";
import { COOP_TYPE_OPTIONS, coopTypesToJson, type CoopTypeItem } from "@/lib/coop-types";
import CountrySelect from "@/components/CountrySelect";
import {
  Plus, X, Loader2, AlertCircle, Zap,
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

const PRESET_NICHES: Record<string, string> = {
  beauty: "美妆", fitness: "健身", fashion: "时尚", tech: "数码",
  food: "美食", travel: "旅行", lifestyle: "生活方式", "ai-creator": "AI创作者",
  "ai-virtual": "AI 虚拟网红", "ai-prompts": "AI prompts博主", "ai-vertical": "AI 垂类",
  "tech-general": "科技泛类博主", "content-creator": "Content Creator",
};

export default function AddInfluencerModal({ open, onClose, onAdded }: Props) {
  // API fetch
  const [fetchPlatform, setFetchPlatform] = useState<string>("instagram");
  const [fetchHandle, setFetchHandle] = useState("");
  const [fetchResult, setFetchResult] = useState<any>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const { data: apiStatus } = useSocialStatus();
  const fetchMutation = useFetchInfluencerMutation();

  // Form
  const [formName, setFormName] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram");
  const [formNiche, setFormNiche] = useState("lifestyle");
  const [formBio, setFormBio] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formGender, setFormGender] = useState("other");
  const [formProfileUrl, setFormProfileUrl] = useState("");

  // Currency + price
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formLocalPrice, setFormLocalPrice] = useState("");
  const [usdPreview, setUsdPreview] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  // Prefetch exchange rates when modal opens
  useEffect(() => {
    if (open) prefetchRates();
  }, [open]);

  // Update USD preview when price or currency changes
  useEffect(() => {
    const amount = parseInt(formLocalPrice) || 0;
    if (amount > 0) {
      // Use sync fallback for immediate preview, async for accuracy
      setUsdPreview(convertToUSDSync(amount, formCurrency));
      convertToUSD(amount, formCurrency).then(setUsdPreview).catch(() => {});
    } else {
      setUsdPreview(null);
    }
  }, [formLocalPrice, formCurrency]);

  // Cooperation types
  const [coopTypes, setCoopTypes] = useState<CoopTypeItem[]>([]);

  // Custom niches
  const [customNiches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("customNiches") || "[]"); } catch { return []; }
  });
  const [showAddNiche, setShowAddNiche] = useState(false);
  const [newNicheName, setNewNicheName] = useState("");

  const createMutation = useCreateInfluencer();
  const createNegMutation = useCreateNegotiation();

  const isConfigured = apiStatus ? (apiStatus as Record<string, boolean>)[fetchPlatform] : false;

  const allNiches = { ...PRESET_NICHES };
  customNiches.forEach((n) => { if (!allNiches[n]) allNiches[n] = n; });

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

  const resetForm = () => {
    setFormName(""); setFormHandle(""); setFormPlatform("instagram"); setFormNiche("lifestyle");
    setFormBio(""); setFormLocation(""); setFormGender("other"); setFormProfileUrl("");
    setFormCurrency("USD"); setFormLocalPrice(""); setFormError("");
    setCoopTypes([]); setFetchResult(null); setFetchError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formHandle.trim()) { setFormError("请填写名称和账号"); return; }
    setFormError("");
    const localAmount = parseInt(formLocalPrice) || 0;
    const usdPrice = localAmount > 0 ? await convertToUSD(localAmount, formCurrency) : 0;
    createMutation.mutate({
      name: formName.trim(),
      handle: formHandle.trim(),
      platform: formPlatform as any,
      avatar: fetchResult?.avatar || null,
      bio: formBio.trim() || null,
      niche: formNiche || null,
      location: formLocation || null,
      gender: formGender as any,
      profileUrl: formProfileUrl.trim() || null,
      userPrice: usdPrice,
      coopTypes: coopTypes.length > 0 ? coopTypesToJson(coopTypes) : null,
    }, {
      onSuccess: (inf) => {
        if (usdPrice > 0) {
          createNegMutation.mutate({
            influencerId: inf.id,
            userPrice: usdPrice,
            adminPrice: 0,
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
      <div className="relative w-full max-w-[560px] mx-4 max-h-[90vh] overflow-y-auto bg-[#141414] border border-white/[0.06] rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#ccff00]" />添加新网红
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.1] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Handle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">名称 *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Lisa Chen" required
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">账号 *</label>
              <input value={formHandle} onChange={(e) => setFormHandle(e.target.value)} placeholder="@lisachen" required
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
          </div>

          {/* Platform + Niche */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">平台</label>
              <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="xiaohongshu">小红书</option>
                <option value="douyin">抖音</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">领域</label>
              <div className="relative">
                <select value={formNiche} onChange={(e) => setFormNiche(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30 pr-16">
                  {Object.entries(allNiches).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddNiche(!showAddNiche)}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-[#ccff00] hover:text-white transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {showAddNiche && (
                <div className="mt-2 flex items-center gap-2">
                  <input value={newNicheName} onChange={(e) => setNewNicheName(e.target.value)}
                    placeholder="新领域名称" autoFocus
                    className="flex-1 bg-[#0a0a0a] border border-[#ccff00]/20 rounded-lg px-2 py-1 text-xs text-white placeholder:text-[#444] focus:outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomNiche(); } }} />
                  <button type="button" onClick={handleAddCustomNiche} className="px-2 py-1 rounded bg-[#ccff00] text-black text-[10px] font-bold">添加</button>
                  <button type="button" onClick={() => { setShowAddNiche(false); setNewNicheName(""); }} className="px-2 py-1 rounded bg-white/[0.04] text-[#666] text-[10px]">取消</button>
                </div>
              )}
            </div>
          </div>

          {/* Currency + Price */}
          <div>
            <label className="text-[11px] text-[#666] mb-1 block">网红报价</label>
            <div className="flex items-center gap-2">
              <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}
                className="w-28 bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input type="number" value={formLocalPrice} onChange={(e) => setFormLocalPrice(e.target.value)}
                placeholder={`输入${formCurrency}金额`}
                className="flex-1 bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
            {usdPreview !== null && usdPreview > 0 && (
              <p className="text-[10px] text-[#ccff00] mt-1">
                ≈ ${usdPreview.toLocaleString()} USD
              </p>
            )}
          </div>

          {/* Cooperation Types */}
          <div>
            <label className="text-[11px] text-[#666] mb-2 block">合作方式（可多选）</label>
            <div className="space-y-2">
              {Object.entries(COOP_TYPE_OPTIONS).map(([platform, types]) => (
                <div key={platform} className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] font-medium text-white mb-1.5">{platform}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((type) => {
                      const selected = isCoopSelected(platform, type);
                      return (
                        <button key={type} type="button" onClick={() => toggleCoopType(platform, type)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                            selected
                              ? "bg-[#ccff00]/15 text-[#ccff00] border-[#ccff00]/30"
                              : "bg-white/[0.03] text-[#888] border-white/[0.06] hover:bg-white/[0.06]"
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

          {/* Gender + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">性别</label>
              <select value={formGender} onChange={(e) => setFormGender(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                <option value="other">其他</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">国家/地区</label>
              <CountrySelect value={formLocation} onChange={setFormLocation} />
            </div>
          </div>

          {/* Profile URL */}
          <div>
            <label className="text-[11px] text-[#666] mb-1 block">主页链接</label>
            <input type="url" value={formProfileUrl} onChange={(e) => setFormProfileUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
          </div>

          {/* Bio */}
          <div>
            <label className="text-[11px] text-[#666] mb-1 block">简介</label>
            <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} placeholder="简短介绍..."
              rows={2} className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[#666] text-sm font-medium hover:bg-white/[0.03] transition-all">
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
