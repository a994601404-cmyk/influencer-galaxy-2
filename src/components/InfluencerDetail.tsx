import { useState, useEffect } from "react";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes, COOP_TYPE_OPTIONS, coopTypesToJson } from "@/lib/coop-types";
import type { CoopTypeItem } from "@/lib/coop-types";
import { clearSignal, clearAllSignals } from "@/lib/signal-light";
import { useAuth } from "@/hooks/useAuth";

// Helper: Beijing time with seconds (YYYY-MM-DD HH:mm:ss)
function nowBeijing(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
}
import { displayCountry } from "@/lib/countries";
import { CURRENCY_OPTIONS, convertToUSD, convertToUSDSync, parseAmountInput, formatQuoteUSD, getExchangeRate, prefetchRates } from "@/lib/currency";
import { compressVideo, type CompressProgress } from "@/lib/video-compress";
import { storeVideoFile, getVideoFile, genVideoKey } from "@/lib/video-storage";
import {
  useNegotiationList,
  useCreateNegotiation,
  useUpdateNegotiation,
  useDeleteNegotiation,
  useScriptReviewList,
  useCreateScriptReview,
  useReviewScript,
  useVideoReviewList,
  useCreateVideoReview,
  useReviewVideo,
  useSetNotCooperating,
  usePostList,
  useCreatePost,
  useDeletePost,
  useReviewPost,
  useUpdateInfluencer,
} from "@/lib/influencer-api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import EditInfluencerModal from "@/components/EditInfluencerModal";
import {
  Users, Handshake, Plus, Trash2, CheckCircle2, XCircle, Clock,
  FileText, Video, Send, ChevronDown, Upload, Link as LinkIcon, X,
  ExternalLink, BarChart3, Eye, Heart, MessageCircle, TrendingUp, Pencil,
} from "lucide-react";

interface Props {
  influencer: any | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: (updated: any) => void;
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default function InfluencerDetail({ influencer, open, onClose, onUpdate }: Props) {
  const { user, isAdmin } = useAuth();
  const inf = influencer;
  const infId = inf?.id ?? null;

  // Permission: admin can edit ALL; normal users can only edit their own cards
  const currentUnionId = user?.email ? `local_${user.email}` : user ? `oauth_${user.id}` : "";
  const canEdit = isAdmin || (!!user && inf?.createdByUnionId === currentUnionId);

  const [activeTab, setActiveTab] = useState<"price" | "script" | "video" | "post">("price");

  // Auto-clear ALL signals when opening a card (user has seen the card)
  useEffect(() => {
    if (open && inf?.id) {
      clearAllSignals(inf.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clear signal light when viewing corresponding tab
  const handleTabChange = (tab: "price" | "script" | "video" | "post") => {
    setActiveTab(tab);
    if (!inf?.id) return;
    const signalMap: Record<string, "price" | "script" | "video"> = {
      price: "price",
      script: "script",
      video: "video",
    };
    if (signalMap[tab]) {
      clearSignal(inf.id, signalMap[tab]);
    }
  };

  // ─── Data: Negotiations ─────────────────────────────────────
  const { data: negotiations = [] } = useNegotiationList(infId);
  const createNeg = useCreateNegotiation();
  const updateNeg = useUpdateNegotiation();
  const deleteNeg = useDeleteNegotiation();
  const [showNegForm, setShowNegForm] = useState(false);
  const [negUserPrice, setNegUserPrice] = useState("");
  const [negAdminPrice, setNegAdminPrice] = useState("");
  const [negNotes, setNegNotes] = useState("");
  const [negCurrency, setNegCurrency] = useState("USD");

  // 谈价表单打开时预取汇率
  useEffect(() => {
    if (showNegForm) prefetchRates();
  }, [showNegForm]);

  // 非美元时显示 USD 折算预览
  const negAmount = parseAmountInput(negUserPrice);
  const negUsdPreview = negAmount > 0 && negCurrency !== "USD" ? convertToUSDSync(negAmount, negCurrency) : null;

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
  const [editingAdminPriceId, setEditingAdminPriceId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [tempAdminPrice, setTempAdminPrice] = useState("");
  const [tempNote, setTempNote] = useState("");
  const [priceSaved, setPriceSaved] = useState(false);

  // ─── Cooperation Types Edit ────────────────────────────────
  const [editingCoopTypes, setEditingCoopTypes] = useState(false);
  const [tempCoopTypes, setTempCoopTypes] = useState<CoopTypeItem[]>([]);

  // ─── Basic Info Edit (编辑资料) ────────────────────────────
  const [editInfoOpen, setEditInfoOpen] = useState(false);

  // ─── Data: Post Records ────────────────────────────────────
  const { data: posts = [] } = usePostList(infId);
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const reviewPostMut = useReviewPost();
  const [reviewingPostId, setReviewingPostId] = useState<number | null>(null);
  const [postAdminNote, setPostAdminNote] = useState("");

  // ─── Cooperation Types helpers ────────────────────────────
  const toggleDetailCoopType = (platform: string, type: string) => {
    setTempCoopTypes((prev) => {
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

  const isDetailCoopSelected = (platform: string, type: string) => {
    return tempCoopTypes.some((i) => i.platform === platform && i.types.includes(type));
  };

  const handleSaveCoopTypes = () => {
    if (!inf?.id) return;
    const jsonStr = tempCoopTypes.length > 0 ? coopTypesToJson(tempCoopTypes) : null;
    updateInfluencer.mutate(
      { id: inf.id, coopTypes: jsonStr },
      {
        onSuccess: () => {
          setEditingCoopTypes(false);
          if (onUpdate) onUpdate({ ...inf, coopTypes: jsonStr });
        },
      }
    );
  };

  // ─── Avatar Edit ───────────────────────────────────────────
  const updateInfluencer = useUpdateInfluencer();
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image to 256x256 before uploading
    const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          // Cover crop: center the image
          const ratio = Math.max(size / img.width, size / img.height);
          const sx = (img.width - size / ratio) / 2;
          const sy = (img.height - size / ratio) / 2;
          const sw = size / ratio;
          const sh = size / ratio;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片加载失败")); };
        img.src = url;
      });
    };

    try {
      if (!inf?.id) return;
      const compressed = await compressImage(file);
      updateInfluencer.mutate(
        { id: inf.id, avatar: compressed },
        {
          onSuccess: () => {
            if (onUpdate) onUpdate({ ...inf, avatar: compressed });
          },
          onError: (err) => {
            alert("头像上传失败: " + err.message);
          },
        }
      );
    } catch (err: any) {
      alert("图片处理失败: " + err.message);
    }
  };
  const [showPostForm, setShowPostForm] = useState(false);
  const [postVideoUrl, setPostVideoUrl] = useState("");
  const [postNextDayExp, setPostNextDayExp] = useState("");
  const [postSevenDayExp, setPostSevenDayExp] = useState("");
  const [postLikes, setPostLikes] = useState("");
  const [postComments, setPostComments] = useState("");
  const [postShares, setPostShares] = useState("");
  const [postNotes, setPostNotes] = useState("");

  // Reset forms when influencer changes
  useEffect(() => {
    setShowNegForm(false); setNegUserPrice(""); setNegAdminPrice(""); setNegNotes("");
    setShowScriptForm(false); setScriptText(""); setScriptNote("");
    setShowVideoForm(false); setVideoUrl(""); setVideoFile(""); setVideoFileName(""); setVideoNote(""); setCompressInfo("");
    setEditingAdminPriceId(null); setEditingNoteId(null);
    setEditingCoopTypes(false); setTempCoopTypes([]);
    setReviewingScriptId(null); setReviewingVideoId(null);
    setReviewingPostId(null); setPostAdminNote("");
    setShowPostForm(false); setPostVideoUrl(""); setPostNextDayExp(""); setPostSevenDayExp("");
    setPostLikes(""); setPostComments(""); setPostShares(""); setPostNotes("");
    handleTabChange("price");
  }, [infId]);

  if (!inf) return null;

  const lastScript = scripts[scripts.length - 1];
  const lastVideo = videos[videos.length - 1];

  // ─── Handlers ───────────────────────────────────────────────

  // Admin reviews price: update the existing negotiation record's adminPrice
  const handleAdminPriceSave = (recordId: number) => {
    if (!isAdmin) return;
    const p = parseInt(tempAdminPrice) || 0;
    updateNeg.mutate({
      id: recordId,
      adminPrice: p,
      // 仅用于前端乐观更新定位缓存，zod 会在服务端剥离该字段
      influencerId: inf.id,
    } as any, {
      onSuccess: () => { setEditingAdminPriceId(null); setPriceSaved(true); setTimeout(() => setPriceSaved(false), 2000); }
    });
  };

  // Admin edits note for a negotiation record
  const handleNoteSave = (recordId: number) => {
    updateNeg.mutate({
      id: recordId,
      notes: tempNote,
      influencerId: inf.id,
    } as any, {
      onSuccess: () => { setEditingNoteId(null); setTempNote(""); }
    });
  };

  const handleAddPost = () => {
    if (!postVideoUrl.trim()) return;
    createPost.mutate({
      influencerId: inf.id,
      videoUrl: postVideoUrl.trim(),
      nextDayExposures: parseInt(postNextDayExp) || 0,
      sevenDayExposures: parseInt(postSevenDayExp) || 0,
      likes: parseInt(postLikes) || 0,
      comments: parseInt(postComments) || 0,
      shares: parseInt(postShares) || 0,
      notes: postNotes.trim(),
      createdAt: nowBeijing(),
    }, {
      onSuccess: () => {
        setPostVideoUrl(""); setPostNextDayExp(""); setPostSevenDayExp("");
        setPostLikes(""); setPostComments(""); setPostShares(""); setPostNotes("");
        setShowPostForm(false);
      }
    });
  };

  const handleDeletePostRecord = (id: number) => {
    if (!confirm("确定删除这条发布记录？")) return;
    deletePost.mutate({ id });
  };

  const handleNotCooperating = () => {
    if (!isAdmin || !inf?.id) return;
    setNotCoopMut.mutate({ id: inf.id }, {
      onSuccess: () => { setEditingAdminPriceId(null); setPriceSaved(true); setTimeout(() => setPriceSaved(false), 2000); }
    });
  };

  const handleAddNegotiation = async () => {
    if (!negUserPrice && !negAdminPrice) return;
    const rawUserPrice = parseAmountInput(negUserPrice);
    // 与添加网红一致：按所选货币折算为 USD 存储
    const userPriceUsd = rawUserPrice > 0 ? await convertToUSD(rawUserPrice, negCurrency).catch(() => convertToUSDSync(rawUserPrice, negCurrency)) : 0;
    const isForeign = negCurrency !== "USD" && rawUserPrice > 0;
    const rateVal = isForeign ? await getExchangeRate(negCurrency).catch(() => null) : null;
    const rateSnapshot = rateVal != null ? String(rateVal) : null;
    createNeg.mutate({
      influencerId: inf.id,
      userPrice: userPriceUsd,
      adminPrice: parseAmountInput(negAdminPrice),
      userPriceLocal: isForeign ? rawUserPrice : null,
      userPriceCurrency: isForeign ? negCurrency : null,
      exchangeRate: rateSnapshot,
      notes: negNotes,
      createdAt: nowBeijing(),
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
      submittedAt: nowBeijing(),
    }, {
      onSuccess: () => { setScriptText(""); setScriptNote(""); setShowScriptForm(false); }
    });
  };

  const handleReviewScript = (id: number, status: "approved" | "rejected") => {
    reviewScriptMut.mutate({ id, status, adminNote: scriptAdminNote }, {
      onSuccess: () => { setScriptAdminNote(""); setReviewingScriptId(null); }
    });
  };

  const handleReviewPost = (id: number, status: "approved" | "rejected") => {
    reviewPostMut.mutate({ id, status, adminNote: postAdminNote }, {
      onSuccess: () => { setPostAdminNote(""); setReviewingPostId(null); }
    });
  };

  const handleAddVideo = async () => {
    const finalUrl = uploadMode === "file" ? videoFile : videoUrl.trim();
    if (!finalUrl) return;

    // For file uploads: store the base64 video in IndexedDB, pass only the key to backend
    let videoUrlToSend = finalUrl;
    let videoFileNameToSend = uploadMode === "file" ? videoFileName : undefined;

    if (uploadMode === "file" && videoFile && inf?.id) {
      // Determine the round number for key generation
      const nextRound = videos.length + 1;
      const storageKey = genVideoKey(inf.id, nextRound);
      try {
        await storeVideoFile(storageKey, videoFile, videoFileName);
        // Send only the storage key as the videoUrl
        videoUrlToSend = `indexeddb://${storageKey}`;
      } catch (e) {
        console.error("Failed to store video in IndexedDB:", e);
        // Fallback: try sending directly (may fail for large files)
      }
    }

    createVideo.mutate({
      influencerId: inf.id,
      videoUrl: videoUrlToSend,
      videoFileName: videoFileNameToSend,
      userNote: videoNote.trim(),
      submittedAt: nowBeijing(),
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
      <DialogContent className="max-w-3xl bg-surface border border-line text-content max-h-[85vh] overflow-y-auto scrollbar-thin rounded-2xl">
        <DialogHeader><DialogTitle className="sr-only">{inf.name}</DialogTitle></DialogHeader>

        {/* Header */}
        <div className="flex items-start gap-4 -mt-2">
          <div className="relative group/avatar flex-shrink-0">
            <img src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`} alt={inf.name}
              className="w-16 h-16 rounded-2xl object-cover border border-line" />
            {canEdit && (
              <>
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity"
                  title="更换头像"
                >
                  <Pencil className="w-4 h-4 text-content" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-content tracking-tight">{inf.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-hover text-sub font-medium">{platformLabels[inf.platform]}</span>
              {inf.coopStatus === "not-cooperating" && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold">不合作</span>
              )}
            </div>
            <p className="text-sm text-faint">{inf.handle}</p>
            <p className="text-xs text-faint mt-1 flex items-center gap-1">
              {displayCountry(inf.location) || inf.location}<span className="mx-1">·</span>{getNicheLabel(inf.niche)}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditInfoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hover border border-line text-sub hover:text-brand hover:border-brand/30 text-xs transition-all flex-shrink-0"
            >
              <Pencil className="w-3 h-3" />编辑资料
            </button>
          )}
        </div>

        {/* Cooperation Types */}
        <div className="p-4 rounded-xl bg-hover">
          {!editingCoopTypes ? (
            <div className="relative">
              {inf.coopTypes ? (
                <div className="space-y-1.5">
                  {parseCoopTypes(inf.coopTypes).map((item) => (
                    <div key={item.platform} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-content w-16">{item.platform}</span>
                      <div className="flex flex-wrap gap-1">
                        {item.types.map((t) => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-lime/10 text-brand">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-faint text-center">未设置合作方式</p>
              )}
              {canEdit && (
                <button
                  onClick={() => { setTempCoopTypes(parseCoopTypes(inf.coopTypes)); setEditingCoopTypes(true); }}
                  className="absolute top-0 right-0 text-[9px] text-brand/60 hover:text-brand px-1.5 py-0.5 rounded hover:bg-lime/10 transition-all"
                >
                  {inf.coopTypes ? "编辑" : "添加"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-content">编辑合作方式</span>
              </div>
              {Object.entries(COOP_TYPE_OPTIONS).map(([platform, types]) => (
                <div key={platform} className="p-2 rounded-lg bg-hover">
                  <p className="text-[10px] font-medium text-sub mb-1.5">{platform}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((type) => {
                      const selected = isDetailCoopSelected(platform, type);
                      return (
                        <button key={type} onClick={() => toggleDetailCoopType(platform, type)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
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
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSaveCoopTypes} disabled={updateInfluencer.isPending}
                  className="px-3 py-1.5 rounded-lg bg-lime text-black text-[10px] font-bold disabled:opacity-50">
                  {updateInfluencer.isPending ? "保存中..." : "保存"}
                </button>
                <button onClick={() => { setEditingCoopTypes(false); setTempCoopTypes([]); }}
                  className="px-3 py-1.5 rounded-lg bg-hover text-faint text-[10px]">取消</button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-hover">
          <TabButton active={activeTab === "price"} onClick={() => handleTabChange("price")} icon={Handshake} label="谈价记录" count={negotiations.length} />
          <TabButton active={activeTab === "script"} onClick={() => handleTabChange("script")} icon={FileText} label="脚本确认" count={scripts.length} badge={lastScript?.status === "pending"} />
          <TabButton active={activeTab === "video"} onClick={() => handleTabChange("video")} icon={Video} label="视频初稿" count={videos.length} badge={lastVideo?.status === "pending"} />
          <TabButton active={activeTab === "post"} onClick={() => handleTabChange("post")} icon={BarChart3} label="发布记录" count={posts.length} />
        </div>

        {/* ─── Tab: Price Negotiation ─────────────────────── */}
        {activeTab === "price" && (
          <div className="space-y-3">
            {canEdit && (
              <button onClick={() => setShowNegForm(!showNegForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-brand/30 text-brand text-xs font-medium hover:bg-lime/5 transition-all flex items-center justify-center gap-1.5">
                {showNegForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />记录新一轮谈价</>}
              </button>
            )}
            {showNegForm && (
              <div className="p-4 rounded-xl bg-hover border border-brand/10 space-y-3">
                <h4 className="text-xs font-bold text-content">新增谈价记录</h4>
                <div className={`grid gap-3 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">网红报价</label>
                    <div className="flex items-center gap-1.5">
                      <select value={negCurrency} onChange={(e) => setNegCurrency(e.target.value)}
                        className="w-24 flex-shrink-0 bg-base border border-line rounded-lg px-1.5 py-2 text-xs text-content focus:outline-none focus:border-brand/30">
                        {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <input type="number" value={negUserPrice} onChange={(e) => setNegUserPrice(e.target.value)} placeholder={`输入${negCurrency}金额`}
                        className="flex-1 min-w-0 bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                    </div>
                    {negUsdPreview !== null && negUsdPreview > 0 && (
                      <p className="text-[10px] text-brand mt-1">≈ ${negUsdPreview.toLocaleString()} USD</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-[10px] text-faint mb-1 block">审核报价 ($) <span className="text-brand">· 管理员</span></label>
                      <input type="number" value={negAdminPrice} onChange={(e) => setNegAdminPrice(e.target.value)} placeholder="审核后的价格"
                        className="w-full bg-base border border-brand/20 rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/40" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-faint mb-1 block">备注</label>
                  <textarea value={negNotes} onChange={(e) => setNegNotes(e.target.value)} placeholder="谈价过程中的备注..."
                    rows={2} className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                </div>
                <button onClick={handleAddNegotiation}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2">
                  <Send className="w-3 h-3" />保存记录
                </button>
              </div>
            )}
            {negotiations.length === 0 ? (
              <div className="text-center py-8">
                <Handshake className="w-8 h-8 text-faint mx-auto mb-2" />
                <p className="text-xs text-faint">暂无谈价记录</p>
                <p className="text-[10px] text-faint mt-1">{canEdit ? "点击上方按钮记录第一次谈价" : "只有卡片创建者可编辑"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {negotiations.map((n: any) => (
                  <div key={n.id} className="p-4 rounded-xl bg-hover hover:bg-hover transition-colors group relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">第 {n.round} 轮</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-faint">{n.createdAt}</span>
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
                        <p className="text-[10px] text-sub mb-0.5">网红报价 {n.createdAt && <span className="text-[9px] text-faint">· {n.createdAt}</span>}</p>
                        <p className="text-sm font-bold text-brand">{n.userPrice > 0 ? formatQuoteUSD(n.userPrice, n.userPriceLocal, n.userPriceCurrency) : "—"}</p>
                        {n.exchangeRate && n.userPriceCurrency && (
                          <p className="text-[9px] text-faint mt-0.5">
                            汇率快照 {Number(n.exchangeRate) < 0.01
                              ? `1 USD ≈ ${Math.round(1 / Number(n.exchangeRate)).toLocaleString()} ${n.userPriceCurrency}`
                              : `1 ${n.userPriceCurrency} ≈ ${Number(n.exchangeRate)} USD`}
                          </p>
                        )}
                      </div>
                      <div>
                        {editingAdminPriceId === n.id && isAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={tempAdminPrice}
                              onChange={(e) => setTempAdminPrice(e.target.value)}
                              placeholder="审核报价"
                              autoFocus
                              className="w-20 bg-base border border-cy/20 rounded-lg px-2 py-0.5 text-[11px] text-content"
                            />
                            <button onClick={() => handleAdminPriceSave(n.id)} className="px-1.5 py-0.5 rounded bg-cy/10 text-cy text-[9px]">确认</button>
                            <button onClick={() => setEditingAdminPriceId(null)} className="px-1.5 py-0.5 rounded bg-hover text-faint text-[9px]">取消</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-[10px] text-sub mb-0.5">审核报价 {n.adminPrice > 0 && n.createdAt && <span className="text-[9px] text-faint">· {n.createdAt}</span>}</p>
                              <p className="text-sm font-bold text-cy">{n.adminPrice > 0 ? `$${n.adminPrice.toLocaleString()}` : "—"}</p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => { setEditingAdminPriceId(n.id); setTempAdminPrice(String(n.adminPrice || "")); }}
                                className="text-[9px] text-cy/60 hover:text-cy px-1.5 py-0.5 rounded hover:bg-cy/10 transition-all"
                              >
                                编辑
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Notes - editable by admin */}
                    {editingNoteId === n.id && isAdmin ? (
                      <div className="mt-2 border-t border-line pt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="输入备注..."
                          autoFocus
                          className="flex-1 bg-base border border-brand/20 rounded-lg px-2 py-1 text-[11px] text-content placeholder:text-faint focus:outline-none"
                        />
                        <button onClick={() => handleNoteSave(n.id)} className="px-1.5 py-1 rounded bg-lime/10 text-brand text-[9px]">保存</button>
                        <button onClick={() => { setEditingNoteId(null); setTempNote(""); }} className="px-1.5 py-1 rounded bg-hover text-faint text-[9px]">取消</button>
                      </div>
                    ) : (
                      <div className="mt-2 border-t border-line pt-2 flex items-center justify-between">
                        {n.notes ? (
                          <p className="text-[10px] text-sub flex-1">{n.notes}</p>
                        ) : (
                          <p className="text-[10px] text-faint flex-1 italic">暂无备注</p>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => { setEditingNoteId(n.id); setTempNote(n.notes || ""); }}
                            className="text-[9px] text-brand/60 hover:text-brand px-1.5 py-0.5 rounded hover:bg-lime/10 transition-all ml-2"
                          >
                            {n.notes ? "编辑备注" : "添加备注"}
                          </button>
                        )}
                      </div>
                    )}
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
                className="w-full py-2.5 rounded-xl border border-dashed border-brand/30 text-brand text-xs font-medium hover:bg-lime/5 transition-all flex items-center justify-center gap-1.5">
                {showScriptForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />提交脚本审核</>}
              </button>
            )}
            {showScriptForm && (
              <div className="p-4 rounded-xl bg-hover border border-brand/10 space-y-3">
                <h4 className="text-xs font-bold text-content">提交脚本（第 {scripts.length + 1} 次）</h4>
                <div>
                  <label className="text-[10px] text-faint mb-1 block">脚本内容 *</label>
                  <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="粘贴网红提供的脚本文本..."
                    rows={5} className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                </div>
                <div>
                  <label className="text-[10px] text-faint mb-1 block">你的意见</label>
                  <textarea value={scriptNote} onChange={(e) => setScriptNote(e.target.value)} placeholder="你对这版脚本的初步看法..."
                    rows={2} className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                </div>
                <button onClick={handleAddScript}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2">
                  <Send className="w-3 h-3" />提交审核
                </button>
              </div>
            )}
            {scripts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-faint mx-auto mb-2" />
                <p className="text-xs text-faint">暂无脚本审核记录</p>
                <p className="text-[10px] text-faint mt-1">{canEdit ? "点击上方按钮提交脚本" : "只有卡片创建者可提交"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scripts.map((s: any) => (
                  <div key={s.id} className="p-4 rounded-xl bg-hover border border-line">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">第 {s.round} 次</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <span className="text-[10px] text-faint">{s.submittedAt}</span>
                    </div>
                    <div className="bg-base rounded-lg p-3 mb-3">
                      <p className="text-[11px] text-content whitespace-pre-wrap leading-relaxed">{s.scriptText}</p>
                    </div>
                    {s.userNote && (
                      <div className="mb-3">
                        <p className="text-[9px] text-sub mb-0.5">用户意见</p>
                        <p className="text-[11px] text-sub">{s.userNote}</p>
                      </div>
                    )}
                    {s.status === "pending" && isAdmin && (
                      <div className="border-t border-line pt-3 space-y-2">
                        {reviewingScriptId === s.id ? (
                          <>
                            <textarea value={scriptAdminNote} onChange={(e) => setScriptAdminNote(e.target.value)} placeholder="管理员意见..."
                              rows={2} className="w-full bg-base border border-brand/15 rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
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
                            className="w-full py-2 rounded-lg bg-lime/10 text-brand text-xs font-medium hover:bg-lime/20">
                            审核此脚本
                          </button>
                        )}
                      </div>
                    )}
                    {s.status !== "pending" && (
                      <div className="border-t border-line pt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StatusBadge status={s.status} />
                          <span className="text-[9px] text-faint">{s.reviewedAt}</span>
                        </div>
                        {s.adminNote && <p className="text-[11px] text-sub">{s.adminNote}</p>}
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
                className="w-full py-2.5 rounded-xl border border-dashed border-brand/30 text-brand text-xs font-medium hover:bg-lime/5 transition-all flex items-center justify-center gap-1.5">
                {showVideoForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />提交视频初稿</>}
              </button>
            )}
            {showVideoForm && (
              <div className="p-4 rounded-xl bg-hover border border-brand/10 space-y-3">
                <h4 className="text-xs font-bold text-content">提交视频初稿（第 {videos.length + 1} 次）</h4>
                <div className="flex gap-1 p-1 rounded-lg bg-hover">
                  <button onClick={() => setUploadMode("file")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${uploadMode === "file" ? "bg-lime/10 text-brand" : "text-faint hover:text-content"}`}>
                    <Upload className="w-3 h-3" />上传文件
                  </button>
                  <button onClick={() => setUploadMode("link")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${uploadMode === "link" ? "bg-lime/10 text-brand" : "text-faint hover:text-content"}`}>
                    <LinkIcon className="w-3 h-3" />粘贴链接
                  </button>
                </div>
                {uploadMode === "file" ? (
                  <>
                    {compressing && (
                      <div className="rounded-xl border border-brand/20 bg-base p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-brand font-medium">{compressProgress.message}</span>
                          <span className="text-xs text-sub">{compressProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-hover rounded-full overflow-hidden">
                          <div className="h-full bg-lime rounded-full transition-all duration-300" style={{ width: `${compressProgress.percent}%` }} />
                        </div>
                      </div>
                    )}
                    {!compressing && !videoFile ? (
                      <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-line hover:border-brand/30 cursor-pointer transition-all bg-base">
                        <Upload className="w-6 h-6 text-faint" />
                        <p className="text-xs text-sub">点击或拖拽上传视频</p>
                        <p className="text-[10px] text-faint">自动压缩至720p · 支持 mp4 / mov / avi</p>
                        <input type="file" accept="video/*" onChange={handleVideoFileSelect} className="hidden" />
                      </label>
                    ) : !compressing && (
                      <div className="relative rounded-xl overflow-hidden bg-base border border-line">
                        <video src={videoFile} controls className="w-full max-h-[200px] object-contain" />
                        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
                          <span className="text-[10px] text-sub truncate flex-1 mr-2">{videoFileName}</span>
                          <button onClick={() => { setVideoFile(""); setVideoFileName(""); setCompressInfo(""); }}
                            className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        {compressInfo && (
                          <div className="px-3 py-1.5 border-t border-line bg-lime/5">
                            <p className="text-[10px] text-brand">{compressInfo}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">视频链接 *</label>
                    <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="视频文件链接（云盘、网盘等）"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-faint mb-1 block">你的意见</label>
                  <textarea value={videoNote} onChange={(e) => setVideoNote(e.target.value)} placeholder="你对这版视频的初步看法..."
                    rows={2} className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                </div>
                <button onClick={handleAddVideo} disabled={uploadMode === "file" ? !videoFile : !videoUrl.trim()}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send className="w-3 h-3" />提交审核
                </button>
              </div>
            )}
            {videos.length === 0 ? (
              <div className="text-center py-8">
                <Video className="w-8 h-8 text-faint mx-auto mb-2" />
                <p className="text-xs text-faint">暂无视频初稿记录</p>
                <p className="text-[10px] text-faint mt-1">{canEdit ? "点击上方按钮提交视频" : "只有卡片创建者可提交"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map((v: any) => (
                  <div key={v.id} className="p-4 rounded-xl bg-hover border border-line">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">第 {v.round} 次</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <span className="text-[10px] text-faint">{v.submittedAt}</span>
                    </div>
                    <VideoPlayer videoUrl={v.videoUrl} videoFileName={v.videoFileName} />
                    {v.userNote && (
                      <div className="mb-3">
                        <p className="text-[9px] text-sub mb-0.5">用户意见</p>
                        <p className="text-[11px] text-sub">{v.userNote}</p>
                      </div>
                    )}
                    {v.status === "pending" && isAdmin && (
                      <div className="border-t border-line pt-3 space-y-2">
                        {reviewingVideoId === v.id ? (
                          <>
                            <textarea value={videoAdminNote} onChange={(e) => setVideoAdminNote(e.target.value)} placeholder="管理员意见..."
                              rows={2} className="w-full bg-base border border-brand/15 rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
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
                            className="w-full py-2 rounded-lg bg-lime/10 text-brand text-xs font-medium hover:bg-lime/20">
                            审核此视频
                          </button>
                        )}
                      </div>
                    )}
                    {v.status !== "pending" && (
                      <div className="border-t border-line pt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StatusBadge status={v.status} />
                          <span className="text-[9px] text-faint">{v.reviewedAt}</span>
                        </div>
                        {v.adminNote && <p className="text-[11px] text-sub">{v.adminNote}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Post Records ──────────────────────────── */}
        {activeTab === "post" && (
          <div className="space-y-3">
            {canEdit && (
              <button onClick={() => setShowPostForm(!showPostForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-brand/30 text-brand text-xs font-medium hover:bg-lime/5 transition-all flex items-center justify-center gap-1.5">
                {showPostForm ? <><ChevronDown className="w-3.5 h-3.5" />取消</> : <><Plus className="w-3.5 h-3.5" />记录新发布</>}
              </button>
            )}
            {showPostForm && (
              <div className="p-4 rounded-xl bg-hover border border-brand/10 space-y-3">
                <h4 className="text-xs font-bold text-content">新增发布记录</h4>
                <div>
                  <label className="text-[10px] text-faint mb-1 block">发布视频链接 *</label>
                  <input type="url" value={postVideoUrl} onChange={(e) => setPostVideoUrl(e.target.value)} placeholder="发布后的视频链接（TikTok、Instagram等）"
                    className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">次日曝光</label>
                    <input type="number" value={postNextDayExp} onChange={(e) => setPostNextDayExp(e.target.value)} placeholder="0"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">7日曝光</label>
                    <input type="number" value={postSevenDayExp} onChange={(e) => setPostSevenDayExp(e.target.value)} placeholder="0"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">点赞</label>
                    <input type="number" value={postLikes} onChange={(e) => setPostLikes(e.target.value)} placeholder="0"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">评论</label>
                    <input type="number" value={postComments} onChange={(e) => setPostComments(e.target.value)} placeholder="0"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                  <div>
                    <label className="text-[10px] text-faint mb-1 block">转发</label>
                    <input type="number" value={postShares} onChange={(e) => setPostShares(e.target.value)} placeholder="0"
                      className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-faint mb-1 block">备注</label>
                  <textarea value={postNotes} onChange={(e) => setPostNotes(e.target.value)} placeholder="发布备注..."
                    rows={2} className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                </div>
                <button onClick={handleAddPost} disabled={!postVideoUrl.trim()}
                  className="w-full btn-lime text-xs flex items-center justify-center gap-1.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send className="w-3 h-3" />保存记录
                </button>
              </div>
            )}
            {posts.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-8 h-8 text-faint mx-auto mb-2" />
                <p className="text-xs text-faint">暂无发布记录</p>
                <p className="text-[10px] text-faint mt-1">{canEdit ? "点击上方按钮记录发布数据" : "只有卡片创建者可编辑"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p: any) => {
                  // Calculate CPM based on last approved adminPrice
                  const lastAdminPrice = inf.adminPrice || 0;
                  const cpm7d = lastAdminPrice > 0 && p.sevenDayExposures > 0
                    ? ((lastAdminPrice / p.sevenDayExposures) * 1000).toFixed(2)
                    : null;
                  return (
                    <div key={p.id} className="p-4 rounded-xl bg-hover hover:bg-hover transition-colors group relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">{p.createdAt}</span>
                          <StatusBadge status={p.status || "pending"} />
                          {cpm7d && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-cy/10 text-cy font-medium">CPM ${cpm7d}</span>
                          )}
                        </div>
                        {canEdit && (
                          <button onClick={() => handleDeletePostRecord(p.id)}
                            className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="bg-base rounded-lg p-3 mb-3">
                        <a href={p.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-cy hover:underline break-all flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />{p.videoUrl}
                        </a>
                      </div>
                      <div className="grid grid-cols-5 gap-3 mb-2">
                        <div>
                          <p className="text-[9px] text-faint">次日曝光</p>
                          <p className="text-xs font-bold text-content">{p.nextDayExposures > 0 ? formatNumber(p.nextDayExposures) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-faint">7日曝光</p>
                          <p className="text-xs font-bold text-content">{p.sevenDayExposures > 0 ? formatNumber(p.sevenDayExposures) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-faint">点赞</p>
                          <p className="text-xs font-bold text-content">{p.likes > 0 ? formatNumber(p.likes) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-faint">评论</p>
                          <p className="text-xs font-bold text-content">{p.comments > 0 ? formatNumber(p.comments) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-faint">转发</p>
                          <p className="text-xs font-bold text-content">{p.shares > 0 ? formatNumber(p.shares) : "—"}</p>
                        </div>
                      </div>
                      {p.notes && <p className="text-[10px] text-sub border-t border-line pt-2">{p.notes}</p>}
                      {(p.status ?? "pending") === "pending" && isAdmin && (
                        <div className="border-t border-line mt-2 pt-3 space-y-2">
                          {reviewingPostId === p.id ? (
                            <>
                              <textarea value={postAdminNote} onChange={(e) => setPostAdminNote(e.target.value)} placeholder="管理员意见..."
                                rows={2} className="w-full bg-base border border-brand/15 rounded-lg px-3 py-2 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" />
                              <div className="flex gap-2">
                                <button onClick={() => handleReviewPost(p.id, "approved")}
                                  className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />通过
                                </button>
                                <button onClick={() => handleReviewPost(p.id, "rejected")}
                                  className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" />不通过
                                </button>
                              </div>
                            </>
                          ) : (
                            <button onClick={() => setReviewingPostId(p.id)}
                              className="w-full py-2 rounded-lg bg-lime/10 text-brand text-xs font-medium hover:bg-lime/20">
                              审核此发布
                            </button>
                          )}
                        </div>
                      )}
                      {(p.status ?? "pending") !== "pending" && (
                        <div className="border-t border-line mt-2 pt-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <StatusBadge status={p.status} />
                            <span className="text-[9px] text-faint">{p.reviewedAt}</span>
                          </div>
                          {p.adminNote && <p className="text-[11px] text-sub">{p.adminNote}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
      {/* 编辑资料弹窗（名称/平台/领域/性别/国家/链接/备注） */}
      <EditInfluencerModal
        influencer={inf}
        open={editInfoOpen}
        onClose={() => setEditInfoOpen(false)}
        onSaved={(updated) => { if (onUpdate) onUpdate(updated); }}
      />
    </Dialog>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

// Video player that supports IndexedDB-stored videos
function VideoPlayer({ videoUrl, videoFileName }: { videoUrl: string; videoFileName?: string }) {
  const [src, setSrc] = useState(videoUrl);
  const [loading, setLoading] = useState(videoUrl.startsWith("indexeddb://"));

  useEffect(() => {
    if (videoUrl.startsWith("indexeddb://")) {
      const key = videoUrl.replace("indexeddb://", "");
      setLoading(true);
      getVideoFile(key).then((file) => {
        if (file) {
          setSrc(file.dataUrl);
        } else {
          setSrc(""); // File not found in IndexedDB
        }
        setLoading(false);
      }).catch(() => {
        setSrc("");
        setLoading(false);
      });
    } else {
      setSrc(videoUrl);
      setLoading(false);
    }
  }, [videoUrl]);

  if (loading) {
    return (
      <div className="rounded-lg overflow-hidden mb-3 bg-base border border-line flex items-center justify-center py-8">
        <span className="text-xs text-faint">正在加载视频...</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="rounded-lg overflow-hidden mb-3 bg-base border border-line flex items-center justify-center py-8">
        <span className="text-xs text-faint">视频文件未找到</span>
      </div>
    );
  }

  if (src.startsWith("data:video")) {
    return (
      <div className="rounded-lg overflow-hidden mb-3 bg-base border border-line">
        <video src={src} controls className="w-full max-h-[200px] object-contain" />
        {videoFileName && <p className="px-3 py-1.5 text-[10px] text-sub border-t border-line">{videoFileName}</p>}
      </div>
    );
  }

  // External link
  return (
    <div className="bg-base rounded-lg p-3 mb-3">
      <a href={src} target="_blank" rel="noopener noreferrer"
        className="text-[11px] text-cy hover:underline break-all flex items-center gap-1">
        <Video className="w-3 h-3" />{src}
      </a>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count, badge }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>;
  label: string; count: number; badge?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? "bg-lime/10 text-brand" : "text-faint hover:text-content"
      }`}>
      <Icon className="w-4 h-4" />{label}
      {count > 0 && <span className="text-[10px] px-1 py-0.5 rounded bg-hover text-sub">{count}</span>}
      {badge && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-lime" />}
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
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-lime/10 text-brand font-medium flex items-center gap-0.5">
      <Clock className="w-2.5 h-2.5" />待审核
    </span>
  );
}
