import { useState, useEffect } from "react";
import { useUpdateInfluencer } from "@/lib/influencer-api";
import { SELECTABLE_NICHES } from "@/lib/niche-map";
import { parseProfileLinks } from "@/lib/profile-links";
import CountrySelect from "@/components/CountrySelect";
import {
  X, Loader2, AlertCircle, Trash2, Link2, Pencil,
} from "lucide-react";

interface Props {
  influencer: any;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: any) => void;
}

const LINK_PLATFORM_OPTIONS = ["Instagram", "TikTok", "YouTube", "X", "其他"];

interface LinkRow {
  platform: string;
  url: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[11px] font-bold text-brand tracking-wider">{children}</span>
      <div className="flex-1 h-px bg-hover" />
    </div>
  );
}

export default function EditInfluencerModal({ influencer, open, onClose, onSaved }: Props) {
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram");
  const [formNiche, setFormNiche] = useState("lifestyle");
  const [formGender, setFormGender] = useState("other");
  const [formLocation, setFormLocation] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([{ platform: "Instagram", url: "" }]);
  const [formBio, setFormBio] = useState("");
  const [formError, setFormError] = useState("");

  const updateMutation = useUpdateInfluencer();

  // Prefill from the influencer each time the modal opens
  useEffect(() => {
    if (!open || !influencer) return;
    setFormName(influencer.name || "");
    setFormPlatform(influencer.platform || "instagram");
    setFormNiche(influencer.niche || "lifestyle");
    setFormGender(influencer.gender || "other");
    setFormLocation(influencer.location || "");
    const existing = parseProfileLinks(influencer.profileUrl);
    setLinks(existing.length > 0 ? existing.map((l) => ({ platform: l.platform === "主页" || l.platform === "链接" ? "其他" : l.platform, url: l.url })) : [{ platform: "Instagram", url: "" }]);
    setFormBio(influencer.bio || "");
    setFormError("");
  }, [open, influencer]);

  const [customNiches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("customNiches") || "[]"); } catch { return []; }
  });
  const [customNicheNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("customNicheNames") || "{}"); } catch { return {}; }
  });
  const allNiches: Record<string, string> = { ...SELECTABLE_NICHES };
  customNiches.forEach((key) => { if (!allNiches[key]) allNiches[key] = customNicheNames[key] || key; });
  // Keep the current niche selectable even if it's a legacy value
  if (formNiche && !allNiches[formNiche]) allNiches[formNiche] = formNiche;

  const updateLink = (idx: number, patch: Partial<LinkRow>) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLinkRow = () => setLinks((prev) => [...prev, { platform: "其他", url: "" }]);
  const removeLinkRow = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("请填写名称"); return; }
    if (!influencer?.id) return;
    setFormError("");
    const validLinks = links.filter((l) => l.url.trim());
    updateMutation.mutate({
      id: influencer.id,
      name: formName.trim(),
      platform: formPlatform as any,
      niche: formNiche || null,
      location: formLocation || null,
      gender: formGender as any,
      profileUrl: validLinks.length > 0 ? JSON.stringify(validLinks.map((l) => ({ platform: l.platform, url: l.url.trim() }))) : null,
      bio: formBio.trim() || null,
    }, {
      onSuccess: (updated) => {
        onSaved({ ...influencer, ...updated });
        onClose();
      },
      onError: (err: any) => setFormError(err.message || "保存失败"),
    });
  };

  if (!open || !influencer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] mx-4 max-h-[85vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-content flex items-center gap-2">
            <Pencil className="w-4 h-4 text-brand" />编辑资料
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
          <SectionTitle>网红基础信息</SectionTitle>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-faint mb-1 block">名称 *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} required
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30" />
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

          <div>
            <label className="text-[11px] text-faint mb-1 block">领域</label>
            <select value={formNiche} onChange={(e) => setFormNiche(e.target.value)}
              className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30">
              {Object.entries(allNiches).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

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

          <SectionTitle>合作详情</SectionTitle>

          <div>
            <label className="text-[11px] text-faint mb-1 block">备注</label>
            <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} placeholder="合作备注..."
              rows={3} className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
          </div>
          <p className="text-[10px] text-faint">报价请通过「谈价记录」更新，合作方式在卡片详情的合作区块编辑。</p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-line text-faint text-sm font-medium hover:bg-hover transition-all">
              取消
            </button>
            <button type="submit" disabled={updateMutation.isPending}
              className="flex-1 btn-lime flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
