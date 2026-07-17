import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { displayCountry } from "@/lib/countries";
import { compressVideo, type CompressProgress } from "@/lib/video-compress";
import {
  useNegotiationList,
  useCreateNegotiation,
  useDeleteNegotiation,
  useScriptReviewList,
  useCreateScriptReview,
  useReviewScript,
  useVideoReviewList,
  useCreateVideoReview,
  useReviewVideo,
  useSetNotCooperating,
} from "@/lib/influencer-api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, Handshake, Plus, Trash2, CheckCircle2, XCircle, Clock,
  FileText, Video, Send, ChevronDown, Upload, Link as LinkIcon, X,
} from "lucide-react";

interface Props {
  influencer: any | null;
  open: boolean;
  onClose: () => void;
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default function InfluencerDetail({ influencer, open, onClose }: Props) {
  const { user, isAdmin } = useAuth();
  const inf = influencer;
  const infId = inf?.id ?? null;

  // Permission: admin can edit ALL; normal users can only edit their own cards
  const currentUnionId = user?.email ? `local_${user.email}` : user ? `oauth_${user.id}` : "";
  const canEdit = isAdmin || (!!user && inf?.createdByUnionId === currentUnionId);

  const [activeTab, setActiveTab] = useState<"price" | "script" | "video">("price");

  // ─── Data: Negotiations ─────────────────────────────────────
  const { data: negotiations = [] } = useNegotiationList(infId);
  const createNeg = useCreateNegotiation();
  const deleteNeg = useDeleteNegotiation();
  const [showNegForm, setShowNegForm] = useState(false);
  const [negUserPrice, setNegUserPrice] = useState("");
  const [negAdminPrice, setNegAdminPrice] = useState("");
  const [negNotes, setNegNotes] = useState("");

  // ─── Data: Scripts ──────────────────────────────────────────
  const { data: scripts = [] } = useScriptReviewList(infId);
  const createScript = useCreateScriptReview();
  const reviewScriptMut = useReviewScript();
  const [showScriptForm, setShowScriptForm] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [scriptNote, setScriptNote] = useState("");
  const [scriptAdminNote, setScriptAdminNote] = useState("");
  const [reviewingScriptId, setReviewingScriptId] = useState<number | null>(null);

  // ─── Data: Videos ───────────────────────────────────────────
  const { data: videos = [] } = useVideoReviewList(infId);
  const createVideo = useCreateVideoReview();
  const reviewVideoMut = useReviewVideo();
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [videoNote, setVideoNote] = useState("");
  const [videoAdminNote, setVideoAdminNote] = useState("");
  const [reviewingVideoId, setReviewingVideoId] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<CompressProgress>({ phase: "loading", percent: 0, message: "" });
  const [compressInfo, setCompressInfo] = useState("");

  // ─── Price editing ──────────────────────────────────────────
  const setNotCoopMut = useSetNotCooperating();
  const [editingAdminPrice, setEditingAdminPrice] = useState(false);
  const [tempAdminPrice, setTempAdminPrice] = useState("");
  const [priceSaved, setPriceSaved] = useState(false);

  // Reset forms when influencer changes
  useEffect(() => {
    setShowNegForm(false); setNegUserPrice(""); setNegAdminPrice(""); setNegNotes("");
    setShowScriptForm(false); setScriptText(""); setScriptNote("");
    setShowVideoForm(false); setVideoUrl(""); setVideoFile(""); setVideoFileName(""); setVideoNote(""); setCompressInfo("");
    setEditingAdminPrice(false);
    setReviewingScriptId(null); setReviewingVideoId(null);
    setActiveTab("price");
  }, [infId]);

  if (!inf) return null;

  const followers = inf.followers || 0;
  const lastScript = scripts[scripts.length - 1];
  const lastVideo = videos[videos.length - 1];

  // ─── Handlers ───────────────────────────────────────────────

  // Admin reviews price: create a new negotiation round with admin price
  const handleAdminPriceSave = () => {
    if (!isAdmin) return;
    const p = parseInt(tempAdminPrice) || 0;
    // Carry forward the latest userPrice from existing negotiations
    const latestUserPrice = negotiations.length > 0
      ? negotiations[negotiations.length - 1].userPrice || 0
      : inf.userPrice || 0;
    createNeg.mutate({
      influencerId: inf.id,
      userPrice: latestUserPrice,
      adminPrice: p,
      notes: "管理员审核报价",
      createdAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => { setEditingAdminPrice(false); setPriceSaved(true); setTimeout(() => setPriceSaved(false), 2000); }
    });
  };

  const handleNotCooperating = () => {
    if (!isAdmin) return;
    setNotCoopMut.mutate({ id: inf.id }, {
      onSuccess: () => { setEditingAdminPrice(false); setPriceSaved(true); setTimeout(() => setPriceSaved(false), 2000); }
    });
  };

  const handleAddNegotiation = () => {
    if (!negUserPrice && !negAdminPrice) return;
    createNeg.mutate({
      influencerId: inf.id,
      userPrice: parseInt(negUserPrice) || 0,
      adminPrice: parseInt(negAdminPrice) || 0,
      notes: negNotes,
      createdAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => { setNegUserPrice(""); setNegAdminPrice(""); setNegNotes(""); setShowNegForm(false); }
    });
  };

  const handleDeleteNeg = (id: number) => {
    if (!confirm("确定删除这条谈价记录？")) return;
    deleteNeg.mutate({ id });
  };

  const handleAddScript = () => {
    if (!scriptText.trim()) return;
    createScript.mutate({
      influencerId: inf.id,
      scriptText: scriptText.trim(),
      userNote: scriptNote.trim(),
      submittedAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => { setScriptText(""); setScriptNote(""); setShowScriptForm(false); }
    });
  };

  const handleReviewScript = (id: number, status: "approved" | "rejected") => {
    reviewScriptMut.mutate({ id, status, adminNote: scriptAdminNote }, {
      onSuccess: () => { setScriptAdminNote(""); setReviewingScriptId(null); }
    });
  };

  const handleAddVideo = () => {
    const finalUrl = uploadMode === "file" ? videoFile : videoUrl.trim();
    if (!finalUrl) return;
    createVideo.mutate({
      influencerId: inf.id,
      videoUrl: finalUrl,
      videoFileName: uploadMode === "file" ? videoFileName : undefined,
      userNote: videoNote.trim(),
      submittedAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => {
        setVideoUrl(""); setVideoFile(""); setVideoFileName(""); setVideoNote(""); setCompressInfo("");
        setShowVideoForm(false);
      }
    });
  };

  const handleReviewVideo = (id: number, status: "approved" | "rejected") => {
    reviewVideoMut.mutate({ id, status, adminNote: videoAdminNote }, {
      onSuccess: () => { setVideoAdminNote(""); setReviewingVideoId(null); }
    });
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { alert("请选择视频文件"); return; }
    setCompressing(true);
    try {
      const result = await compressVideo(file, (p) => setCompressProgress(p));
      setVideoFile(result.dataUrl);
      setVideoFileName(result.fileName);
      const savedMB = ((result.originalSize - result.compressedSize) / 1024 / 1024).toFixed(1);
      const compressRatio = Math.round((result.compressedSize / result.originalSize) * 100);
      setCompressInfo(`${result.originalW}×${result.originalH} → ${result.outputW}×${result.outputH} · ${(result.originalSize / 1024 / 1024).toFixed(1)}MB → ${(result.compressedSize / 1024 / 1024).toFixed(1)}MB (${compressRatio}%) · 节省 ${savedMB}MB`);
    } catch (err: any) { alert(err.message || "压缩失败"); }
    finally { setCompressing(false); e.target.value = ""; }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-[#141414] border border-white/[0.06] text-white max-h-[85vh] overflow-y-auto scrollbar-thin rounded-2xl">
        <DialogHeader><DialogTitle className="sr-only">{inf.name}</DialogTitle></DialogHeader>

        {/* Header */}
        <div className="flex items-start gap-4 -mt-2">
          <img src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`} alt={inf.name}
            className="w-16 h-16 rounded-2xl object-cover border border-white/[0.06]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white tracking-tight">{inf.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-[#888] font-medium">{platformLabels[inf.platform]}</span>
              {inf.coopStatus === "not-cooperating" && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold">不合作</span>
              )}
              {/* Admin edit price button — only for admin, click to show edit panel */}
              {isAdmin && (
                <div className="ml-auto">
                  {editingAdminPrice ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-[#06b6d4]">审核报价</span>
                        <input type="number" value={tempAdminPrice} onChange={(e) => setTempAdminPrice(e.target.value)}
                          className="w-20 bg-[#0a0a0a] border border-[#06b6d4]/20 rounded-lg px-2 py-0.5 text-[11px] text-white" />
                        <button onClick={handleAdminPriceSave} className="px-2 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] text-[9px]">确认</button>
                        <button onClick={() => setEditingAdminPrice(false)} className="px-2 py-0.5 rounded bg-white/[0.04] text-[#666] text-[9px]">取消</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {inf.coopStatus !== "not-cooperating" && (
                          <button onClick={handleNotCooperating} className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px]">标记不合作</button>
                        )}
                        {inf.coopStatus === "not-cooperating" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">不合作</span>
                        )}
                      </div>
                      {priceSaved && <span className="text-[9px] text-[#ccff00]">已保存</span>}
                    </div>
                  ) : (
                    <button onClick={() => { setEditingAdminPrice(true); setTempAdminPrice(String(inf.adminPrice || "")); }}
                      className="px-3 py-1.5 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4] text-[10px] font-medium hover:bg-[#06b6d4]/20 transition-colors flex items-center gap-1">
                      {inf.adminPrice > 0 ? `审核报价 $${inf.adminPrice.toLocaleString()}` : "审核报价"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-[#666]">{inf.handle}</p>
            <p className="text-xs text-[#666] mt-1 flex items-center gap-1">
              {displayCountry(inf.location) || inf.location}<span className="mx-1">·</span>{inf.niche}
            </p>
          </div>
        </div>

        {/* Base Stats — followers only */}
        <div className="p-4 rounded-xl bg-white/[0.02] text-center">
          <Users className="w-5 h-5 mx-auto text-[#ccff00] mb-1" />
          <p className="text-lg font-black text-white">{formatNumber(followers)}</p>
          <p className="text-[10px] text-[#555]">粉丝</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02]">
          <TabButton active={activeTab === "price"} onClick={() => setActiveTab("price")} icon={Handshake} label="谈价记录" count={negotiations.length} />
          <TabButton active={activeTab === "script"} onClick={() => setActiveTab("script")} icon={FileText} label="脚本确认" count={scripts.length} badge={lastScript?.status === "pending"} />
          <TabButton active={activeTab === "video"} onClick={() => setActiveTab("video")} icon={Video} label="视频初稿" count={videos.length} badge={lastVideo?.status === "pending"} />
        </div>

        {/* ─── Tab: Price Negotiation ─────────────────────── */}
        {activeTab === "price" && (
          <div className="space-y-3">
            {canEdit && (
              <button onClick={() => setShowNegForm(!showNegForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#ccff00]/30 text-[#ccff00] text-xs font-medium hover:bg-[#ccff00]/5 transition-all flex items-center justify-center gap-1.5">
                {showNegForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />记录新一轮谈价</>}
              </button>
            )}
            {showNegForm && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ccff00]/10 space-y-3">
                <h4 className="text-xs font-bold text-white">新增谈价记录</h4>
                <div className={`grid gap-3 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
                  <div>
                    <label className="text-[10px] text-[#666] mb-1 block">网红报价 ($)</label>
                    <input type="number" value={negUserPrice} onChange={(e) => setNegUserPrice(e.target.value)} placeholder="网红提出的价格"
                      className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-[10px] text-[#666] mb-1 block">审核报价 ($) <span className="text-[#ccff00]">· 管理员</span></label>
                      <input type="number" value={negAdminPrice} onChange={(e) => setNegAdminPrice(e.target.value)} placeholder="审核后的价格"
                        className="w-full bg-[#0a0a0a] border border-[#ccff00]/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/40" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-[#666] mb-1 block">备注</label>
                  <textarea value={negNotes} onChange={(e) => setNegNotes(e.target.value)} placeholder="谈价过程中的备注..."
                    rows={2} className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                </div>
                <button onClick={handleAddNegotiation}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2">
                  <Send className="w-3 h-3" />保存记录
                </button>
              </div>
            )}
            {negotiations.length === 0 ? (
              <div className="text-center py-8">
                <Handshake className="w-8 h-8 text-[#444] mx-auto mb-2" />
                <p className="text-xs text-[#666]">暂无谈价记录</p>
                <p className="text-[10px] text-[#555] mt-1">{canEdit ? "点击上方按钮记录第一次谈价" : "只有卡片创建者可编辑"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {negotiations.map((n: any) => (
                  <div key={n.id} className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">第 {n.round} 轮</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#666]">{n.createdAt}</span>
                        {canEdit && (
                          <button onClick={() => handleDeleteNeg(n.id)}
                            className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-[#888] mb-0.5">网红报价</p>
                        <p className="text-sm font-bold text-[#ccff00]">{n.userPrice > 0 ? `$${n.userPrice.toLocaleString()}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#888] mb-0.5">审核报价</p>
                        <p className="text-sm font-bold text-[#06b6d4]">{n.adminPrice > 0 ? `$${n.adminPrice.toLocaleString()}` : "—"}</p>
                      </div>
                    </div>
                    {n.notes && <p className="text-[10px] text-[#888] mt-2 border-t border-white/[0.04] pt-2">{n.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Script Review ─────────────────────────── */}
        {activeTab === "script" && (
          <div className="space-y-3">
            {canEdit && (
              <button onClick={() => setShowScriptForm(!showScriptForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#ccff00]/30 text-[#ccff00] text-xs font-medium hover:bg-[#ccff00]/5 transition-all flex items-center justify-center gap-1.5">
                {showScriptForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />提交脚本审核</>}
              </button>
            )}
            {showScriptForm && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ccff00]/10 space-y-3">
                <h4 className="text-xs font-bold text-white">提交脚本（第 {scripts.length + 1} 次）</h4>
                <div>
                  <label className="text-[10px] text-[#666] mb-1 block">脚本内容 *</label>
                  <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="粘贴网红提供的脚本文本..."
                    rows={5} className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                </div>
                <div>
                  <label className="text-[10px] text-[#666] mb-1 block">你的意见</label>
                  <textarea value={scriptNote} onChange={(e) => setScriptNote(e.target.value)} placeholder="你对这版脚本的初步看法..."
                    rows={2} className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                </div>
                <button onClick={handleAddScript}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2">
                  <Send className="w-3 h-3" />提交审核
                </button>
              </div>
            )}
            {scripts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-[#444] mx-auto mb-2" />
                <p className="text-xs text-[#666]">暂无脚本审核记录</p>
                <p className="text-[10px] text-[#555] mt-1">{canEdit ? "点击上方按钮提交脚本" : "只有卡片创建者可提交"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scripts.map((s: any) => (
                  <div key={s.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">第 {s.round} 次</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <span className="text-[10px] text-[#666]">{s.submittedAt}</span>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3">
                      <p className="text-[11px] text-white whitespace-pre-wrap leading-relaxed">{s.scriptText}</p>
                    </div>
                    {s.userNote && (
                      <div className="mb-3">
                        <p className="text-[9px] text-[#888] mb-0.5">用户意见</p>
                        <p className="text-[11px] text-[#aaa]">{s.userNote}</p>
                      </div>
                    )}
                    {s.status === "pending" && isAdmin && (
                      <div className="border-t border-white/[0.06] pt-3 space-y-2">
                        {reviewingScriptId === s.id ? (
                          <>
                            <textarea value={scriptAdminNote} onChange={(e) => setScriptAdminNote(e.target.value)} placeholder="管理员意见..."
                              rows={2} className="w-full bg-[#0a0a0a] border border-[#ccff00]/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleReviewScript(s.id, "approved")}
                                className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />通过
                              </button>
                              <button onClick={() => handleReviewScript(s.id, "rejected")}
                                className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />不通过
                              </button>
                            </div>
                          </>
                        ) : (
                          <button onClick={() => setReviewingScriptId(s.id)}
                            className="w-full py-2 rounded-lg bg-[#ccff00]/10 text-[#ccff00] text-xs font-medium hover:bg-[#ccff00]/20">
                            审核此脚本
                          </button>
                        )}
                      </div>
                    )}
                    {s.status !== "pending" && (
                      <div className="border-t border-white/[0.06] pt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StatusBadge status={s.status} />
                          <span className="text-[9px] text-[#666]">{s.reviewedAt}</span>
                        </div>
                        {s.adminNote && <p className="text-[11px] text-[#aaa]">{s.adminNote}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Video Review ──────────────────────────── */}
        {activeTab === "video" && (
          <div className="space-y-3">
            {canEdit && (
              <button onClick={() => setShowVideoForm(!showVideoForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#ccff00]/30 text-[#ccff00] text-xs font-medium hover:bg-[#ccff00]/5 transition-all flex items-center justify-center gap-1.5">
                {showVideoForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />提交视频初稿</>}
              </button>
            )}
            {showVideoForm && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#ccff00]/10 space-y-3">
                <h4 className="text-xs font-bold text-white">提交视频初稿（第 {videos.length + 1} 次）</h4>
                <div className="flex gap-1 p-1 rounded-lg bg-white/[0.02]">
                  <button onClick={() => setUploadMode("file")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${uploadMode === "file" ? "bg-[#ccff00]/10 text-[#ccff00]" : "text-[#666] hover:text-white"}`}>
                    <Upload className="w-3 h-3" />上传文件
                  </button>
                  <button onClick={() => setUploadMode("link")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${uploadMode === "link" ? "bg-[#ccff00]/10 text-[#ccff00]" : "text-[#666] hover:text-white"}`}>
                    <LinkIcon className="w-3 h-3" />粘贴链接
                  </button>
                </div>
                {uploadMode === "file" ? (
                  <>
                    {compressing && (
                      <div className="rounded-xl border border-[#ccff00]/20 bg-[#0a0a0a] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#ccff00] font-medium">{compressProgress.message}</span>
                          <span className="text-xs text-[#888]">{compressProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-[#ccff00] rounded-full transition-all duration-300" style={{ width: `${compressProgress.percent}%` }} />
                        </div>
                      </div>
                    )}
                    {!compressing && !videoFile ? (
                      <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-[#ccff00]/30 cursor-pointer transition-all bg-[#0a0a0a]">
                        <Upload className="w-6 h-6 text-[#555]" />
                        <p className="text-xs text-[#888]">点击或拖拽上传视频</p>
                        <p className="text-[10px] text-[#555]">自动压缩至720p · 支持 mp4 / mov / avi</p>
                        <input type="file" accept="video/*" onChange={handleVideoFileSelect} className="hidden" />
                      </label>
                    ) : !compressing && (
                      <div className="relative rounded-xl overflow-hidden bg-[#0a0a0a] border border-white/[0.06]">
                        <video src={videoFile} controls className="w-full max-h-[200px] object-contain" />
                        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
                          <span className="text-[10px] text-[#888] truncate flex-1 mr-2">{videoFileName}</span>
                          <button onClick={() => { setVideoFile(""); setVideoFileName(""); setCompressInfo(""); }}
                            className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        {compressInfo && (
                          <div className="px-3 py-1.5 border-t border-white/[0.04] bg-[#ccff00]/5">
                            <p className="text-[10px] text-[#ccff00]">{compressInfo}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="text-[10px] text-[#666] mb-1 block">视频链接 *</label>
                    <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="视频文件链接（云盘、网盘等）"
                      className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-[#666] mb-1 block">你的意见</label>
                  <textarea value={videoNote} onChange={(e) => setVideoNote(e.target.value)} placeholder="你对这版视频的初步看法..."
                    rows={2} className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                </div>
                <button onClick={handleAddVideo} disabled={uploadMode === "file" ? !videoFile : !videoUrl.trim()}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send className="w-3 h-3" />提交审核
                </button>
              </div>
            )}
            {videos.length === 0 ? (
              <div className="text-center py-8">
                <Video className="w-8 h-8 text-[#444] mx-auto mb-2" />
                <p className="text-xs text-[#666]">暂无视频初稿记录</p>
                <p className="text-[10px] text-[#555] mt-1">{canEdit ? "点击上方按钮提交视频" : "只有卡片创建者可提交"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map((v: any) => (
                  <div key={v.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">第 {v.round} 次</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <span className="text-[10px] text-[#666]">{v.submittedAt}</span>
                    </div>
                    {v.videoUrl.startsWith("data:video") ? (
                      <div className="rounded-lg overflow-hidden mb-3 bg-[#0a0a0a] border border-white/[0.04]">
                        <video src={v.videoUrl} controls className="w-full max-h-[200px] object-contain" />
                        {v.videoFileName && <p className="px-3 py-1.5 text-[10px] text-[#888] border-t border-white/[0.04]">{v.videoFileName}</p>}
                      </div>
                    ) : (
                      <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3">
                        <a href={v.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-[#06b6d4] hover:underline break-all flex items-center gap-1">
                          <Video className="w-3 h-3" />{v.videoUrl}
                        </a>
                      </div>
                    )}
                    {v.userNote && (
                      <div className="mb-3">
                        <p className="text-[9px] text-[#888] mb-0.5">用户意见</p>
                        <p className="text-[11px] text-[#aaa]">{v.userNote}</p>
                      </div>
                    )}
                    {v.status === "pending" && isAdmin && (
                      <div className="border-t border-white/[0.06] pt-3 space-y-2">
                        {reviewingVideoId === v.id ? (
                          <>
                            <textarea value={videoAdminNote} onChange={(e) => setVideoAdminNote(e.target.value)} placeholder="管理员意见..."
                              rows={2} className="w-full bg-[#0a0a0a] border border-[#ccff00]/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleReviewVideo(v.id, "approved")}
                                className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />通过
                              </button>
                              <button onClick={() => handleReviewVideo(v.id, "rejected")}
                                className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />不通过
                              </button>
                            </div>
                          </>
                        ) : (
                          <button onClick={() => setReviewingVideoId(v.id)}
                            className="w-full py-2 rounded-lg bg-[#ccff00]/10 text-[#ccff00] text-xs font-medium hover:bg-[#ccff00]/20">
                            审核此视频
                          </button>
                        )}
                      </div>
                    )}
                    {v.status !== "pending" && (
                      <div className="border-t border-white/[0.06] pt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StatusBadge status={v.status} />
                          <span className="text-[9px] text-[#666]">{v.reviewedAt}</span>
                        </div>
                        {v.adminNote && <p className="text-[11px] text-[#aaa]">{v.adminNote}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function TabButton({ active, onClick, icon: Icon, label, count, badge }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>;
  label: string; count: number; badge?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? "bg-[#ccff00]/10 text-[#ccff00]" : "text-[#666] hover:text-white"
      }`}>
      <Icon className="w-4 h-4" />{label}
      {count > 0 && <span className="text-[10px] px-1 py-0.5 rounded bg-white/[0.06] text-[#888]">{count}</span>}
      {badge && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ccff00]" />}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium flex items-center gap-0.5">
      <CheckCircle2 className="w-2.5 h-2.5" />已通过
    </span>
  );
  if (status === "rejected") return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium flex items-center gap-0.5">
      <XCircle className="w-2.5 h-2.5" />不通过
    </span>
  );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ccff00]/10 text-[#ccff00] font-medium flex items-center gap-0.5">
      <Clock className="w-2.5 h-2.5" />待审核
    </span>
  );
}
