import { useAuth } from "@/hooks/useAuth";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes } from "@/lib/coop-types";
import { parseProfileLinks } from "@/lib/profile-links";
import { getActiveSignals, subscribeToSignals } from "@/lib/signal-light";
import { useState, useEffect } from "react";
import {
  ExternalLink, Eye, EyeOff, Trash2, MapPin, Hash, Pin, ArrowRightLeft,
  ChevronLeft, ChevronRight, Check,
} from "lucide-react";

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};

function displayCountry(code: string): string {
  const map: Record<string, string> = {
    US: "美国", CN: "中国", HK: "中国香港", TW: "中国台湾", JP: "日本",
    KR: "韩国", SG: "新加坡", MY: "马来西亚", TH: "泰国", VN: "越南",
    ID: "印尼", PH: "菲律宾", UK: "英国", FR: "法国", DE: "德国",
    IT: "意大利", ES: "西班牙", NL: "荷兰", BR: "巴西", CA: "加拿大",
    AU: "澳大利亚", IN: "印度", MX: "墨西哥", RU: "俄罗斯",
  };
  return map[code] || code;
}

interface InfluencerCardProps {
  inf: any;
  isSelected: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  isPinned: boolean;
  categories?: any[];
  currentCategoryId?: number;
  onSelect: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMoveCategory?: (targetCategoryId: number) => void;
  // Batch selection mode
  batchMode?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
  // Manual ordering within the category
  onMoveForward?: () => void;
  onMoveBackward?: () => void;
}

function SignalDot({ type }: { type: string }) {
  const labels: Record<string, string> = { price: "谈价", script: "脚本", video: "视频" };
  return (
    <span className="signal-blink w-3 h-3 rounded-full bg-[#ccff00] inline-block mx-0.5"
      title={`新${labels[type] || type}审核`} />
  );
}

export default function InfluencerCard({
  inf, isSelected, isAdmin, canEdit, isPinned,
  categories, currentCategoryId,
  onSelect, onToggleHide, onDelete, onTogglePin, onMoveCategory,
  batchMode, checked, onToggleSelect, onMoveForward, onMoveBackward,
}: InfluencerCardProps) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<string[]>([]);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const infId = inf?.id ?? 0;
  const isOwner = inf?.createdByUnionId === user?.unionId;

  useEffect(() => {
    if (!infId) return;
    setSignals(getActiveSignals(infId));
    const unsubscribe = subscribeToSignals(() => {
      setSignals(getActiveSignals(infId));
    });
    return unsubscribe;
  }, [infId]);

  if (!inf || !inf.id) return null;
  const hasAnySignal = signals.length > 0;
  const coopItems = parseCoopTypes(inf.coopTypes);
  const profileLinks = parseProfileLinks(inf.profileUrl);

  return (
    <div
      onClick={batchMode ? onToggleSelect : onSelect}
      className={`card-surface p-4 cursor-pointer transition-all relative ${
        isSelected && !batchMode ? "border-[#ccff00]/30 bg-[#ccff00]/[0.02]" : ""
      } ${isPinned ? "card-pinned" : ""} ${batchMode && checked ? "border-[#ccff00]/50 bg-[#ccff00]/[0.04]" : ""}`}
    >
      {/* Batch-mode checkbox */}
      {batchMode && (
        <div
          className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center z-20 transition-all ${
            checked ? "bg-[#ccff00] border-[#ccff00]" : "bg-black/50 border-white/[0.15]"
          }`}
        >
          {checked && <Check className="w-3.5 h-3.5 text-black" />}
        </div>
      )}

      {/* Top-right: Pin + Signal light + Move + Actions */}
      {!batchMode && (
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        {onMoveForward && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveForward(); }}
            className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.08] transition-all"
            title="前移"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
        {onMoveBackward && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveBackward(); }}
            className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.08] transition-all"
            title="后移"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
            isPinned
              ? "bg-[#ccff00]/20 text-[#ccff00]"
              : "bg-white/[0.04] text-[#666] hover:text-[#ccff00] hover:bg-[#ccff00]/10"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <Pin className={`w-3 h-3 ${isPinned ? "fill-[#ccff00]" : ""}`} />
        </button>

        <div className={`flex items-center rounded-full px-1 py-0.5 transition-all ${hasAnySignal ? "bg-black/60" : "bg-transparent"}`}>
          {signals.length > 0 ? (
            signals.map((s) => <SignalDot key={s} type={s} />)
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#333] inline-block" title="暂无新审核" />
          )}
        </div>

        {/* Move to category dropdown */}
        {categories && categories.length > 1 && onMoveCategory && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
              className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.08] transition-all"
              title="移动分类"
            >
              <ArrowRightLeft className="w-3 h-3" />
            </button>
            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} />
                <div className="absolute top-full right-0 mt-1 w-32 bg-[#1a1a1a] border border-white/[0.08] rounded-lg shadow-xl z-50 py-1">
                  {categories.filter((c: any) => c.id !== currentCategoryId).map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#888] hover:text-white hover:bg-white/[0.04] transition-colors"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleHide(); }}
            className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.08] transition-all"
            title={inf.hidden ? "显示" : "隐藏"}
          >
            {inf.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        )}
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      )}

      {/* Main content */}
      <div className="flex gap-3">
        <img
          src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`}
          alt={inf.name}
          className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/[0.06] ${batchMode ? "ml-6" : ""}`}
        />
        <div className="flex-1 min-w-0 pr-20">
          <h3 className="text-sm font-bold text-white truncate">{inf.name}</h3>
          <p className="text-[11px] text-[#666] truncate">{inf.handle}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888]">
              {platformLabels[inf.platform] || inf.platform}
            </span>
            {inf.location && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />{displayCountry(inf.location) || inf.location}
              </span>
            )}
            {inf.niche && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />{getNicheLabel(inf.niche)}
              </span>
            )}
            {isOwner && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ccff00]/10 text-[#ccff00]/80">我的</span>
            )}
          </div>
        </div>
      </div>

      {/* Prices */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <div className="flex-1">
          <p className="text-[9px] text-[#666]">网红报价</p>
          <p className="text-sm font-bold text-[#ccff00]">
            {inf.userPrice > 0 ? `$${inf.userPrice.toLocaleString()}` : "—"}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-[#666]">审核报价</p>
          <p className="text-sm font-bold text-[#06b6d4]">
            {inf.adminPrice > 0 ? `$${inf.adminPrice.toLocaleString()}` : "—"}
          </p>
        </div>
        {inf.coopStatus === "not-cooperating" && (
          <span className="text-[9px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-medium">不合作</span>
        )}
      </div>

      {/* Cooperation types */}
      {coopItems.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {coopItems.map((item) => (
            <span key={item.platform} className="text-[9px] text-[#888]">
              <span className="text-[#aaa]">{item.platform}</span>
              <span className="text-[#555] mx-0.5">·</span>
              {item.types.map((t) => (
                <span key={t} className="text-[#ccff00]/60 mr-1">{t}</span>
              ))}
            </span>
          ))}
        </div>
      )}

      {inf.bio && (
        <p className="text-[10px] text-[#666] mt-2 line-clamp-2 leading-relaxed">{inf.bio}</p>
      )}

      {profileLinks.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {profileLinks.map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] text-[#06b6d4]/60 hover:text-[#06b6d4] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />{link.platform}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
