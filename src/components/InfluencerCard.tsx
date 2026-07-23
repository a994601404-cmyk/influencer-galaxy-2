import { useAuth } from "@/hooks/useAuth";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes } from "@/lib/coop-types";
import { parseProfileLinks } from "@/lib/profile-links";
import { getActiveSignals, subscribeToSignals } from "@/lib/signal-light";
import { displayCountry } from "@/lib/countries";
import { useState, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ExternalLink, Eye, EyeOff, Trash2, Pin, ArrowRightLeft,
  ChevronLeft, ChevronRight, Check, GripVertical, MoreHorizontal,
} from "lucide-react";

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};
// 合作类型行的平台缩写（降噪：整行压缩为一行文本）
const platformAbbr: Record<string, string> = {
  instagram: "IG", tiktok: "TT", xiaohongshu: "XHS", douyin: "DY",
  Instagram: "IG", TikTok: "TT", 小红书: "XHS", 抖音: "DY",
};

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

// 主页链接平台图标：按链接备注的平台显示对应品牌 logo，未识别的平台回退到通用链接图标
function LinkPlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p.includes("instagram") || p === "ig") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-label="Instagram">
        <defs>
          <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#FEDA75" />
            <stop offset=".45" stopColor="#D62976" />
            <stop offset="1" stopColor="#962FBF" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="21" height="21" rx="5.5" fill="url(#ig-grad)" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.9" />
        <circle cx="17.4" cy="6.6" r="1.3" fill="#fff" />
      </svg>
    );
  }
  if (p.includes("tiktok") || p === "tt") {
    const note = "M16.6 3c.4 2.1 1.9 3.7 4.1 3.9v3c-1.6 0-3-.5-4.1-1.3v6.2A5.9 5.9 0 1 1 10.6 9v3.1a2.8 2.8 0 1 0 2.9 2.8V3h3.1Z";
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-label="TikTok">
        <path fill="#25F4EE" transform="translate(-0.6,0.35)" d={note} />
        <path fill="#FE2C55" transform="translate(0.6,-0.35)" d={note} />
        <path fill="#111" d={note} />
      </svg>
    );
  }
  if (p.includes("youtube") || p === "yt") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-label="YouTube">
        <path fill="#FF0000" d="M23 12s0-3.85-.46-5.58a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2C1 8.15 1 12 1 12s0 3.85.46 5.58a2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2C23 15.85 23 12 23 12Z" />
        <path fill="#fff" d="m9.75 15.5 6-3.5-6-3.5v7Z" />
      </svg>
    );
  }
  if (p === "x" || p.includes("twitter")) {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-label="X">
        <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#111" />
        <path fill="#fff" d="M17.2 5.5h2.6l-5.7 6.5 6.7 8.9h-5.2l-4.1-5.4-4.7 5.4H4.2l6.1-7L3.9 5.5h5.4l3.7 4.9 4.2-4.9Zm-.9 11.8h1.4L8.2 6.9H6.7l9.6 10.4Z" transform="scale(0.92) translate(1,0.6)" />
      </svg>
    );
  }
  return <ExternalLink className="w-3 h-3" />;
}

function SignalDot({ type }: { type: string }) {
  const labels: Record<string, string> = { price: "谈价", script: "脚本", video: "视频" };
  return (
    <span className="signal-blink w-2.5 h-2.5 rounded-full bg-lime inline-block mx-0.5"
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
  const [showMenu, setShowMenu] = useState(false);
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
  const coopItems = parseCoopTypes(inf.coopTypes);
  const profileLinks = parseProfileLinks(inf.profileUrl);
  const hasMenu = !batchMode && ((categories && categories.length > 1 && onMoveCategory) || isAdmin || canEdit);

  // 状态徽章：不合作 > 审核中（所在分类名判断）；常规状态不显示徽章（降噪）
  const currentCat = categories?.find((c: any) => c.id === currentCategoryId);
  const inReview = currentCat?.name === "审核中";
  const notCoop = inf.coopStatus === "not-cooperating";

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

      {/* Top-right: 状态徽章 + 信号灯 + 操作 */}
      {!batchMode && (
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        {notCoop ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 mr-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />不合作
          </span>
        ) : inReview ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 mr-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />审核中
          </span>
        ) : null}
        {onMoveForward && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveForward(); }}
            className="w-[22px] h-[22px] rounded-md bg-hover flex items-center justify-center text-faint hover:text-content transition-all"
            title="前移"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
        {onMoveBackward && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveBackward(); }}
            className="w-[22px] h-[22px] rounded-md bg-hover flex items-center justify-center text-faint hover:text-content transition-all"
            title="后移"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`w-[22px] h-[22px] rounded-md flex items-center justify-center transition-all ${
            isPinned
              ? "bg-lime/20 text-brand"
              : "bg-hover text-faint hover:text-brand hover:bg-lime/10"
          }`}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <Pin className={`w-3 h-3 ${isPinned ? "fill-lime" : ""}`} />
        </button>

        {/* 信号灯：仅在有新审核信号时显示（无信号不再展示灰点） */}
        {signals.length > 0 && (
          <div className="flex items-center rounded-full px-1 py-0.5 bg-black/60">
            {signals.map((s) => <SignalDot key={s} type={s} />)}
          </div>
        )}

        {/* 低频操作合并进 ⋯ 菜单：移动分类 / 隐藏 / 删除 */}
        {hasMenu && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="w-[22px] h-[22px] rounded-md bg-hover flex items-center justify-center text-faint hover:text-content transition-all"
              title="更多操作"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute top-full right-0 mt-1 w-36 bg-elevated border border-line rounded-lg shadow-xl z-50 py-1">
                  {categories && categories.length > 1 && onMoveCategory && (
                    <>
                      <p className="px-3 pt-1 pb-0.5 text-[10px] text-faint flex items-center gap-1"><ArrowRightLeft className="w-2.5 h-2.5" />移动到分类</p>
                      {categories.filter((c: any) => c.id !== currentCategoryId).map((cat: any) => (
                        <button
                          key={cat.id}
                          onClick={(e) => { e.stopPropagation(); onMoveCategory(cat.id); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-sub hover:text-content hover:bg-hover transition-colors"
                        >
                          {cat.name}
                        </button>
                      ))}
                      <div className="h-px bg-line my-1" />
                    </>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleHide(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-sub hover:text-content hover:bg-hover transition-colors flex items-center gap-1.5"
                    >
                      {inf.hidden ? <><EyeOff className="w-3 h-3" />显示卡片</> : <><Eye className="w-3 h-3" />隐藏卡片</>}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />删除卡片
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* 头部：头像 + 名字/handle */}
      <div className={`flex items-center gap-3 ${dragEnabled ? "pl-4" : ""}`}>
        <img
          src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`}
          alt={inf.name}
          className={`w-[46px] h-[46px] rounded-xl object-cover flex-shrink-0 border border-line ${batchMode ? "ml-6" : ""}`}
        />
        <div className="flex-1 min-w-0 pr-[104px]">
          <h3 className="text-[15px] font-extrabold text-content truncate leading-tight">
            {inf.name}
            {isOwner && (
              <span className="ml-1.5 text-[9px] font-semibold px-1 py-0.5 rounded bg-lime/10 text-brand/80 align-middle">我的</span>
            )}
          </h3>
          <p className="text-[11.5px] text-faint truncate">{inf.handle}</p>
        </div>
      </div>

      {/* 元信息行：平台 · 国家 · 领域（零徽章，点分隔） */}
      <p className={`text-[11.5px] text-sub mt-2.5 truncate ${dragEnabled ? "pl-4" : ""}`}>
        {platformLabels[inf.platform] || inf.platform}
        {inf.location && <><span className="text-faint mx-1.5">·</span>{displayCountry(inf.location)}</>}
        {inf.niche && <><span className="text-faint mx-1.5">·</span>#{getNicheLabel(inf.niche)}</>}
      </p>

      {/* 价格区：双指标锚点 */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-faint font-medium">网红报价</p>
          <p className="text-[19px] font-black text-brand leading-tight mt-0.5 truncate">
            {inf.userPrice > 0 ? `$${inf.userPrice.toLocaleString()}` : <span className="text-[13px] font-semibold text-faint">—</span>}
          </p>
          {inf.userPrice > 0 && inf.userPriceLocal && inf.userPriceCurrency && (
            <p className="text-[10px] text-faint mt-0.5 truncate">{inf.userPriceLocal.toLocaleString()} {inf.userPriceCurrency}</p>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-faint font-medium">审核报价</p>
          <p className="text-[19px] font-black text-cy leading-tight mt-0.5 truncate">
            {inf.adminPrice > 0 ? `$${inf.adminPrice.toLocaleString()}` : <span className="text-[13px] font-semibold text-faint">待审核</span>}
          </p>
        </div>
      </div>

      {/* 备注（一行截断） */}
      {inf.bio && (
        <p className="text-[11px] text-faint mt-2.5 truncate">{inf.bio}</p>
      )}

      {/* 底行：合作类型缩写 + 主页链接图标 + 创建者 */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 min-w-0">
          {coopItems.map((item) => (
            <span key={item.platform} className="text-[10.5px] text-sub whitespace-nowrap">
              <b className="font-semibold text-content">{platformAbbr[item.platform] || item.platform}</b>
              <span className="text-faint mx-0.5">·</span>
              {item.types.map((t) => (
                <span key={t} className="text-brand/70 mr-1">{t}</span>
              ))}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {profileLinks.map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={link.platform}
              className="w-5 h-5 rounded-md bg-hover flex items-center justify-center text-cy/70 hover:text-cy transition-colors"
            >
              <LinkPlatformIcon platform={link.platform} />
            </a>
          ))}
          {creatorName && (
            <span className="text-[10px] font-bold text-brand bg-lime/10 px-1.5 py-0.5 rounded whitespace-nowrap">
              by {creatorName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
