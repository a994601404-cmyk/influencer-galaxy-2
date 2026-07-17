import { useState } from "react";
import { useCreateInfluencer, useCreateNegotiation } from "@/lib/influencer-api";
import { useSocialStatus, API_PLATFORMS, PLATFORM_LABELS } from "@/lib/social-service";
import { useFetchInfluencerMutation } from "@/lib/social-service";
import { formatCountry } from "@/lib/countries";
import CountrySelect from "@/components/CountrySelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (inf: any) => void;
}

export default function AddInfluencerModal({ open, onClose, onAdded }: Props) {
  // Platform selection for API fetch
  const [fetchPlatform, setFetchPlatform] = useState<string>("instagram");
  const [fetchHandle, setFetchHandle] = useState("");
  const [fetchResult, setFetchResult] = useState<any>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const { data: apiStatus } = useSocialStatus();
  const fetchMutation = useFetchInfluencerMutation();

  // Form state
  const [formName, setFormName] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram");
  const [formNiche, setFormNiche] = useState("lifestyle");
  const [formBio, setFormBio] = useState("");
  const [formFollowers, setFormFollowers] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formGender, setFormGender] = useState("other");
  const [formProfileUrl, setFormProfileUrl] = useState("");
  const [formUserPrice, setFormUserPrice] = useState("");
  const [formError, setFormError] = useState("");

  const createMutation = useCreateInfluencer();
  const createNegMutation = useCreateNegotiation();

  // Check if current fetchPlatform is configured
  const isConfigured = apiStatus ? (apiStatus as Record<string, boolean>)[fetchPlatform] : false;

  const handleFetch = async () => {
    if (!fetchHandle.trim() || fetchMutation.isPending) return;
    setFetchResult(null);
    setFetchError(null);
    try {
      const result = await fetchMutation.mutateAsync({
        platform: fetchPlatform as "instagram" | "tiktok" | "youtube",
        handle: fetchHandle.trim(),
      });
      setFetchResult(result);
      // Auto-fill form
      const d = result as any;
      if (d.name) setFormName(d.name);
      if (d.handle) setFormHandle(d.handle);
      if (d.bio) setFormBio(d.bio);
      if (d.followers) setFormFollowers(String(d.followers));
      if (d.location) setFormLocation(d.location);
      if (d.platform) setFormPlatform(d.platform);
      // Auto-generate profile URL from platform + handle
      const cleanHandle = (d.handle || "").replace(/^@/, "");
      if (cleanHandle && d.platform) {
        const platformUrls: Record<string, string> = {
          instagram: `https://instagram.com/${cleanHandle}`,
          tiktok: `https://tiktok.com/@${cleanHandle}`,
          youtube: `https://youtube.com/@${cleanHandle}`,
        };
        if (platformUrls[d.platform]) setFormProfileUrl(platformUrls[d.platform]);
      }
    } catch (e: any) {
      setFetchError(e);
    }
  };

  const fetching = fetchMutation.isPending;

  const resetAll = () => {
    setFetchHandle(""); setFetchResult(null); setFetchError(null); setFetchPlatform("instagram");
    setFormName(""); setFormHandle(""); setFormPlatform("instagram");
    setFormNiche("lifestyle"); setFormBio(""); setFormFollowers("");
    setFormLocation(""); setFormGender("other"); setFormProfileUrl("");
    setFormUserPrice(""); setFormError("");
  };

  const handleAdd = async () => {
    if (!formName || !formHandle) { setFormError("请填写名称和账号"); return; }

    try {
      const userPriceVal = parseInt(formUserPrice) || 0;
      const newInf = await createMutation.mutateAsync({
        name: formName,
        handle: formHandle.startsWith("@") ? formHandle : "@" + formHandle,
        platform: formPlatform as "instagram" | "tiktok" | "xiaohongshu" | "douyin",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formHandle)}`,
        bio: formBio || `${formName}是一位${formNiche}领域的创作者`,
        followers: formFollowers ? parseInt(formFollowers) : 10000,
        engagementRate: 3.5,
        niche: formNiche,
        location: formLocation || "Unknown",
        gender: formGender as "male" | "female" | "other",
        profileUrl: formProfileUrl || undefined,
        userPrice: userPriceVal > 0 ? userPriceVal : undefined,
        audienceGender: { male: 30, female: 70 },
        audienceAge: [
          { range: "18-24", pct: 35 }, { range: "25-34", pct: 40 },
          { range: "35-44", pct: 20 }, { range: "45+", pct: 5 },
        ],
        audienceDevices: [
          { type: "Mobile", pct: 82 }, { type: "Desktop", pct: 12 }, { type: "Tablet", pct: 6 },
        ],
        topPosts: [],
      });

      // Auto-create round 1 negotiation record if userPrice provided
      if (userPriceVal > 0) {
        await createNegMutation.mutateAsync({
          influencerId: newInf.id,
          userPrice: userPriceVal,
          adminPrice: 0,
          createdAt: new Date().toISOString().split("T")[0],
        });
      }

      resetAll();
      onAdded(newInf);
    } catch (e: any) {
      setFormError(e.message || "添加失败");
    }
  };

  const handleClose = () => { resetAll(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md bg-[#141414] border border-white/[0.06] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2 text-base">
            <Plus className="w-5 h-5 text-[#ccff00]" />添加新网红
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* ─── Auto-fetch from Social API ────────────────── */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#ccff00]/5 to-transparent border border-[#ccff00]/10">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#ccff00]" />
              <span className="text-xs font-bold text-white">从社交媒体自动获取</span>
              {apiStatus && (
                <span className="flex gap-1">
                  {API_PLATFORMS.map((p) => (
                    <span key={p}
                      className={`text-[8px] px-1 py-0.5 rounded ${(apiStatus as Record<string, boolean>)[p] ? "bg-[#ccff00]/15 text-[#ccff00]" : "bg-white/[0.03] text-[#555]"}`}>
                      {p}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {/* Platform tabs */}
            <div className="flex gap-1 mb-2">
              {API_PLATFORMS.map((p) => {
                const cfg = apiStatus ? (apiStatus as Record<string, boolean>)[p] : false;
                return (
                  <button key={p} onClick={() => { setFetchPlatform(p); setFetchEnabled(false); }}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      fetchPlatform === p
                        ? cfg ? "bg-[#ccff00]/15 text-[#ccff00] border border-[#ccff00]/25" : "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-white/[0.02] text-[#666] border border-transparent hover:bg-white/[0.04]"
                    }`}>
                    {PLATFORM_LABELS[p]?.label || p}
                    {!cfg && " (未配置)"}
                  </button>
                );
              })}
            </div>

            {isConfigured ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fetchHandle}
                  onChange={(e) => setFetchHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                  placeholder={`输入 ${PLATFORM_LABELS[fetchPlatform]?.label} 用户名`}
                  className="flex-1 bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30"
                />
                <button
                  onClick={handleFetch}
                  disabled={fetching || !fetchHandle.trim()}
                  className="btn-lime text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  获取
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-[#666]">
                <AlertCircle className="w-3 h-3 text-[#f59e0b] flex-shrink-0" />
                {PLATFORM_LABELS[fetchPlatform]?.label} API 未配置，请联系管理员配置 RapidAPI Key
              </div>
            )}

            {fetchError && (
              <div className="mt-1.5 space-y-1">
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  获取失败：{fetchError.message || "请检查用户名是否正确或 API 配置是否有效"}
                </p>
                <button
                  onClick={handleFetch}
                  className="text-[10px] text-[#ccff00] hover:underline"
                >
                  重试
                </button>
              </div>
            )}
            {fetchResult && (
              <p className="text-[10px] text-[#ccff00] mt-1.5">
                已获取 {fetchResult.name} 的数据，表单已自动填充
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.04]" />
            <span className="text-[10px] text-[#555]">或手动填写</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>

          {/* ─── Form ──────────────────────────────────────── */}
          {formError && <p className="text-xs text-red-400 bg-red-400/10 p-2 rounded-lg">{formError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">名称 *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Lisa Chen"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">账号 *</label>
              <input value={formHandle} onChange={(e) => setFormHandle(e.target.value)} placeholder="@lisachen"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">平台</label>
              <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="xiaohongshu">小红书</option>
                <option value="douyin">抖音</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">领域</label>
              <select value={formNiche} onChange={(e) => setFormNiche(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                <option value="beauty">美妆</option>
                <option value="fitness">健身</option>
                <option value="fashion">时尚</option>
                <option value="tech">数码</option>
                <option value="food">美食</option>
                <option value="travel">旅行</option>
                <option value="lifestyle">生活方式</option>
                <option value="ai-creator">AI创作者</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">粉丝数</label>
              <input type="number" value={formFollowers} onChange={(e) => setFormFollowers(e.target.value)} placeholder="500000"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">网红报价 ($)</label>
              <input type="number" value={formUserPrice} onChange={(e) => setFormUserPrice(e.target.value)} placeholder="网红自报价格"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">性别</label>
              <select value={formGender} onChange={(e) => setFormGender(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
                <option value="female">女</option>
                <option value="male">男</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#666] mb-1 block">国家/地区</label>
              <CountrySelect value={formLocation} onChange={setFormLocation} />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#666] mb-1 block">主页链接</label>
            <input value={formProfileUrl} onChange={(e) => setFormProfileUrl(e.target.value)} placeholder="https://instagram.com/..."
              className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
          </div>

          <div>
            <label className="text-[11px] text-[#666] mb-1 block">简介</label>
            <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} placeholder="简短介绍..." rows={2}
              className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1 text-[#666] hover:text-white hover:bg-white/[0.05] rounded-xl"
              onClick={handleClose}>取消</Button>
            <Button className="flex-1 bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold rounded-xl gap-1"
              onClick={handleAdd}><Plus className="w-4 h-4" />添加</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */
