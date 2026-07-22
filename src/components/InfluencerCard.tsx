import { useAuth } from "@/hooks/useAuth";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes } from "@/lib/coop-types";
import { parseProfileLinks } from "@/lib/profile-links";
import { getActiveSignals, subscribeToSignals } from "@/lib/signal-light";
import { useState, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ExternalLink, Eye, EyeOff, Trash2, MapPin, Hash, Pin, ArrowRightLeft,
  ChevronLeft, ChevronRight, Check, GripVertical,
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
  // Drag & drop (handle shown on the left edge when provided)
  dragData?: { categoryId: number; index: number };
  // 创建者用户名（管理员视角右下角高亮展示）
  creatorName?: string;
}

function SignalDot({ type }: { type: string }) {
  const labels: Record<string, string> = { price: "谈价", script: "脚本", video: "视频" };
  return (
    <span className="signal-blink w-3 h-3 rounded-full bg-lime inline-block mx-0.5"
      title={`新${labels[type] || type}审核`} />
  );
}

export default function InfluencerCard({
  inf, isSelected, isAdmin, canEdit, isPinned,
  categories, currentCategoryId,
  onSelect, onToggleHide, onDelete, onTogglePin, onMoveCategory,
  batchMode, checked, onToggleSelect, onMoveForward, onMoveBackward,
  dragData, creatorName,
}: InfluencerCardProps) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<string[]>([]);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const infId = inf?.id ?? 0;
  const isOwner = inf?.createdByUnionId === user?.unionId;

  const dragEnabled = !!dragData && !batchMode && !!infId;
  const {
    attributes, listeners, setNodeRef: setDragRef, isDragging,
  } = useDraggable({
    id: `inf-${infId}`,
    data: { influencerId: infId, categoryId: dragData?.categoryId, index: dragData?.index },
    disabled: !dragEnabled,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card-${infId}`,
    data: { type: "card", influencerId: infId, categoryId: dragData?.categoryId, index: dragData?.index },
    disabled: !dragEnabled,
  });

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
      ref={setDropRef}
      onClick={batchMode ? onToggleSelect : onSelect}
      className={`card-surface p-4 cursor-pointer transition-all relative ${
        isSelected && !batchMode ? "border-brand/30 bg-lime/[0.02]" : ""
      } ${isPinned ? "card-pinned" : ""} ${batchMode && checked ? "border-brand/50 bg-lime/[0.04]" : ""} ${
        isDragging ? "opacity-30" : ""
      } ${isOver && !isDragging ? "ring-2 ring-lime/50" : ""}`}
    >
      {/* Drag handle (left edge) */}
      {dragEnabled && (
        <button
          ref={setDragRef}
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-5 h-10 rounded-md flex items-center justify-center text-faint hover:text-brand hover:bg-hover cursor-grab active:cursor-grabbing transition-colors touch-none"
          title="拖动调整位置/分类"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Batch-mode checkbox */}
      {batchMode && (
        <div
          className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center z-20 transition-all ${
            checked ? "bg-lime border-brand" : "bg-black/50 border-line"
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
            className="w-6 h-6 rounded-md bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all"
            title="前移"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
        {onMoveBackward && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveBackward(); }}
            className="w-6 h-6 rounded-md bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all"
            title="后移"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
            isPinned
              ? "bg-lime/20 text-brand"
              : "bg-hover text-faint hover:text-brand hover:bg-lime/10"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <Pin className={`w-3 h-3 ${isPinned ? "fill-lime" : ""}`} />
        </button>

        <div className={`flex items-center rounded-full px-1 py-0.5 transition-all ${hasAnySignal ? "bg-black/60" : "bg-transparent"}`}>
          {signals.length > 0 ? (
            signals.map((s) => <SignalDot key={s} type={s} />)
          ) : (
            <span className="w-2 h-2 rounded-full bg-faint inline-block" title="暂无新审核" />
          )}
        </div>

        {/* Move to category dropdown */}
        {categories && categories.length > 1 && onMoveCategory && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
              className="w-6 h-6 rounded-md bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all"
              title="移动分类"
            >
              <ArrowRightLeft className="w-3 h-3" />
            </button>
            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} />
                <div className="absolute top-full right-0 mt-1 w-32 bg-elevated border border-line rounded-lg shadow-xl z-50 py-1">
                  {categories.filter((c: any) => c.id !== currentCategoryId).map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-sub hover:text-content hover:bg-hover transition-colors"
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
            className="w-6 h-6 rounded-md bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all"
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
      <div className={`flex gap-3 ${dragEnabled ? "pl-4" : ""}`}>
        <img
          src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`}
          alt={inf.name}
          className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-line ${batchMode ? "ml-6" : ""}`}
        />
        <div className="flex-1 min-w-0 pr-20">
          <h3 className="text-sm font-bold text-content truncate">{inf.name}</h3>
          <p className="text-[11px] text-faint truncate">{inf.handle}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-hover text-sub">
              {platformLabels[inf.platform] || inf.platform}
            </span>
            {inf.location && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-hover text-sub flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />{displayCountry(inf.location) || inf.location}
              </span>
            )}
            {inf.niche && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-hover text-sub flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />{getNicheLabel(inf.niche)}
              </span>
            )}
            {isOwner && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime/10 text-brand/80">我的</span>
            )}
          </div>
        </div>
      </div>

      {/* Prices */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex-1">
          <p className="text-[9px] text-faint">网红报价</p>
          <p className="text-sm font-bold text-brand">
            {inf.userPrice > 0 ? `$${inf.userPrice.toLocaleString()}` : "—"}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-faint">审核报价</p>
          <p className="text-sm font-bold text-cy">
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
            <span key={item.platform} className="text-[9px] text-sub">
              <span className="text-sub">{item.platform}</span>
              <span className="text-faint mx-0.5">·</span>
              {item.types.map((t) => (
                <span key={t} className="text-brand/60 mr-1">{t}</span>
              ))}
            </span>
          ))}
        </div>
      )}

      {inf.bio && (
        <p className="text-[10px] text-faint mt-2 line-clamp-2 leading-relaxed">{inf.bio}</p>
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
              className="inline-flex items-center gap-1 text-[10px] text-cy/60 hover:text-cy transition-colors"
            >
              <ExternalLink className="w-3 h-3" />{link.platform}
            </a>
          ))}
        </div>
      )}

      {/* 创建者（右下角高亮） */}
      {creatorName && (
        <div className="flex justify-end mt-2">
          <span className="text-[9px] font-semibold text-brand/90 bg-lime/10 px-1.5 py-0.5 rounded">
            by {creatorName}
          </span>
        </div>
      )}
    </div>
  );
}
