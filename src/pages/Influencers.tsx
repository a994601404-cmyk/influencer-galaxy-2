import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router";
import { SELECTABLE_NICHES } from "@/lib/niche-map";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import {
  useInfluencerList,
  useDeleteInfluencer,
  useHideInfluencer,
  useUnhideInfluencer,
  useTrashList,
  useRestoreInfluencer,
  useDestroyInfluencer,
  useUserList,
  useNegotiationListAll,
  useCardCategoryList,
  useCreateCardCategory,
  useUpdateCardCategory,
  useDeleteCardCategory,
  useToggleCategoryExpand,
  useMoveCardToCategory,
  useToggleCategoryPin,
  useSaveCategoryOrder,
  useSaveCardOrderInCategory,
  useAssignCardToCategory,
} from "@/lib/influencer-api";
import InfluencerDetail from "@/components/InfluencerDetail";
import InfluencerCard from "@/components/InfluencerCard";
import AddInfluencerModal from "@/components/AddInfluencerModal";
import {
  Search, Plus, Users, Settings, ChevronDown, ChevronRight, FolderPlus,
  Trash2, Pencil, Check, X, Archive, RotateCcw, ArrowUp, ArrowDown, Lock,
} from "lucide-react";

function useCreatorNameMap() {
  const { data: users } = useUserList();
  return useMemo(() => {
    const map = new Map<string, string>();
    (users || []).filter(Boolean).forEach((u: any) => {
      if (u?.unionId) map.set(u.unionId, u.name || u.email || `用户#${u.id}`);
    });
    return map;
  }, [users]);
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};

// Drop target for a category's card grid (accepts cards from other categories)
function CategoryDropZone({ categoryId, className, children }: {
  categoryId: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cat-${categoryId}`,
    data: { type: "cat", categoryId },
  });
  return (
    <div ref={setNodeRef} className={`${className ?? ""} rounded-lg transition-shadow ${isOver ? "ring-2 ring-lime/40" : ""}`}>
      {children}
    </div>
  );
}

export default function Influencers() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [platform, setPlatform] = useState("all");
  const [niche, setNiche] = useState("all");
  const [creator, setCreator] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedInfluencer, setSelectedInfluencer] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Batch selection mode: influencerId → categoryId it was picked from
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [batchTargetCat, setBatchTargetCat] = useState("");

  // Recycle bin
  const [trashOpen, setTrashOpen] = useState(false);

  // Card categories
  const { data: categoryData } = useCardCategoryList();
  const createCategoryMut = useCreateCardCategory();
  const updateCategoryMut = useUpdateCardCategory();
  const deleteCategoryMut = useDeleteCardCategory();
  const toggleExpandMut = useToggleCategoryExpand();
  const moveCardMut = useMoveCardToCategory();
  const togglePinMut = useToggleCategoryPin();
  const saveCatOrderMut = useSaveCategoryOrder();
  const saveCardOrderMut = useSaveCardOrderInCategory();
  const assignCardMut = useAssignCardToCategory();

  const [newCatName, setNewCatName] = useState("");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number|null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Initialize default categories (frontend fallback; the backend also
  // creates them server-side on first list)
  useEffect(() => {
    if (!user?.unionId) return;
    if (!categoryData) return;
    const cats = categoryData.categories || [];
    const hasDefault = cats.some((c: any) => c.name === "网红库");
    if (!hasDefault) {
      const defaults = ["对接中", "已发布", "网红库"];
      defaults.forEach((name) => {
        const exists = cats.some((c: any) => c.name === name);
        if (!exists) createCategoryMut.mutate({ name });
      });
    }
  }, [categoryData?.categories, user?.unionId]);

  const {
    data: listData,
    isLoading,
  } = useInfluencerList({ platform: platform !== "all" ? platform : undefined });

  const { data: allNegotiations } = useNegotiationListAll();
  const { mutate: deleteInf } = useDeleteInfluencer();
  const { mutate: hideInf } = useHideInfluencer();
  const { mutate: unhideInf } = useUnhideInfluencer();
  const { data: trashData } = useTrashList();
  const { mutate: restoreInf } = useRestoreInfluencer();
  const { mutate: destroyInf } = useDestroyInfluencer();

  const currentUnionId = user?.unionId ?? "";

  const canEditCard = useCallback((inf: any) => {
    if (!inf) return false;
    if (isAdmin) return true;
    return inf.createdByUnionId === currentUnionId;
  }, [isAdmin, currentUnionId]);

  // Merge price data
  const latestPriceMap = useMemo(() => {
    const map = new Map<number, { userPrice: number; adminPrice: number }>();
    if (!allNegotiations) return map;
    for (const n of allNegotiations) {
      if (!n || n.influencerId == null) continue;
      const id = n.influencerId;
      const existing = map.get(id) || { userPrice: 0, adminPrice: 0 };
      if (n.userPrice > 0) existing.userPrice = n.userPrice;
      if (n.adminPrice > 0) existing.adminPrice = n.adminPrice;
      map.set(id, existing);
    }
    return map;
  }, [allNegotiations]);

  // Filter influencers based on role
  const allInfluencers = useMemo(() => {
    const items = (listData?.items || []).filter((item: any) => item != null && item.id != null);
    // Non-admin users can ONLY see their own cards
    if (!isAdmin) {
      return items.filter((i: any) => i.createdByUnionId === currentUnionId);
    }
    // 管理员按创建者筛选：前端过滤，立即生效且省一次请求
    if (creator !== "all") {
      return items.filter((i: any) => i.createdByUnionId === creator);
    }
    return items;
  }, [listData, isAdmin, currentUnionId, creator]);

  // Merge price into influencers
  const influencersWithPrices = useMemo(() => {
    return allInfluencers.map((inf: any) => {
      const prices = latestPriceMap.get(inf.id);
      return prices ? { ...inf, ...prices } : inf;
    });
  }, [allInfluencers, latestPriceMap]);

  // Build influencer lookup map
  const influencerMap = useMemo(() => {
    const map = new Map<number, any>();
    influencersWithPrices.forEach((inf: any) => map.set(inf.id, inf));
    return map;
  }, [influencersWithPrices]);

  // Group items by category
  // Also auto-assign uncategorized influencers to "网红库" (frontend fallback)
  const groupedCategories = useMemo(() => {
    if (!categoryData?.categories) return [];

    // Build set of all influencerIds that are already in a category
    const categorizedIds = new Set<number>();
    (categoryData.items || []).forEach((item: any) => {
      if (item?.influencerId) categorizedIds.add(item.influencerId);
    });

    // Find uncategorized influencers
    const uncategorizedInfs = influencersWithPrices
      .filter((inf: any) => inf?.id != null && !categorizedIds.has(inf.id));

    // Find default category: "网红库" or first available
    let defaultCat = categoryData.categories.find((c: any) => c.name === "网红库");
    if (!defaultCat) defaultCat = categoryData.categories[0];

    return categoryData.categories.map((cat: any) => {
      const catItems = (categoryData.items || [])
        .filter((item: any) => item.categoryId === cat.id)
        .map((item: any) => ({
          ...item,
          influencer: influencerMap.get(item.influencerId) || item.influencer,
        }))
        .filter((item: any) => item.influencer && item.influencer.id != null);

      // Append uncategorized influencers to default category
      if (defaultCat && cat.id === defaultCat.id) {
        const existingIds = new Set(catItems.map((i: any) => i.influencerId));
        for (const inf of uncategorizedInfs) {
          if (!existingIds.has(inf.id)) {
            catItems.push({
              id: `uncategorized-${inf.id}`,
              categoryId: cat.id,
              influencerId: inf.id,
              sortOrder: 999,
              isPinned: 0,
              influencer: inf,
            });
          }
        }
      }

      return { ...cat, items: catItems };
    });
  }, [categoryData, influencerMap, influencersWithPrices]);

  // Apply search/platform/niche filters
  const filteredCategories = useMemo(() => {
    const term = search.toLowerCase().trim();
    return groupedCategories.map((cat: any) => {
      const filtered = cat.items.filter((item: any) => {
        const inf = item.influencer;
        if (!inf) return false;
        if (platform !== "all" && inf.platform !== platform) return false;
        if (niche !== "all" && inf.niche !== niche) return false;
        if (term) {
          const searchable = `${inf.name} ${inf.handle} ${inf.bio || ""}`.toLowerCase();
          if (!searchable.includes(term)) return false;
        }
        return true;
      });
      return { ...cat, items: filtered };
    });
  }, [groupedCategories, search, platform, niche]);

  // Sort buttons only make sense when no filter is hiding neighbors
  const filtersActive = search.trim() !== "" || platform !== "all" || niche !== "all";

  // Count visible items
  const visibleCount = useMemo(() => {
    return filteredCategories.reduce((sum: number, cat: any) => sum + (cat.items || []).length, 0);
  }, [filteredCategories]);

  const handleDelete = (id: number) => {
    if (confirm("确认删除此网红? 卡片会进入垃圾箱,可恢复。")) deleteInf({ id });
  };
  const handleHide = (id: number) => hideInf({ id });
  const handleUnhide = (id: number) => unhideInf({ id });

  // Move card handler
  const handleMoveCard = useCallback((influencerId: number, fromCategoryId: number, toCategoryId: number) => {
    if (fromCategoryId === toCategoryId) return;
    moveCardMut.mutate({ influencerId, fromCategoryId, toCategoryId });
  }, [moveCardMut]);

  // Manual card ordering within a category (swap with neighbor, persist all)
  const handleCardReorder = useCallback((cat: any, index: number, dir: -1 | 1) => {
    const items = [...(cat.items || [])];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    saveCardOrderMut.mutate({
      categoryId: cat.id,
      orders: items.map((item: any, i: number) => ({ influencerId: item.influencerId, sortOrder: i })),
    });
  }, [saveCardOrderMut]);

  // Manual category ordering
  const handleCategoryReorder = useCallback((catId: number, dir: -1 | 1) => {
    const cats = [...groupedCategories];
    const index = cats.findIndex((c: any) => c.id === catId);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= cats.length) return;
    [cats[index], cats[target]] = [cats[target], cats[index]];
    saveCatOrderMut.mutate({
      orders: cats.map((c: any, i: number) => ({ id: c.id, sortOrder: i })),
    });
  }, [groupedCategories, saveCatOrderMut]);

  // ── Batch mode helpers ──
  const toggleSelect = useCallback((influencerId: number, categoryId: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(influencerId)) next.delete(influencerId);
      else next.set(influencerId, categoryId);
      return next;
    });
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelected(new Map());
    setBatchTargetCat("");
  }, []);

  const batchDelete = useCallback(() => {
    if (selected.size === 0) return;
    if (!confirm(`确认删除选中的 ${selected.size} 个网红? 卡片会进入垃圾箱,可恢复。`)) return;
    selected.forEach((_, infId) => deleteInf({ id: infId }));
    exitBatchMode();
  }, [selected, deleteInf, exitBatchMode]);

  const batchHide = useCallback(() => {
    if (selected.size === 0) return;
    selected.forEach((_, infId) => hideInf({ id: infId }));
    exitBatchMode();
  }, [selected, hideInf, exitBatchMode]);

  const batchMove = useCallback(() => {
    const targetId = Number(batchTargetCat);
    if (!targetId || selected.size === 0) return;
    selected.forEach((fromCatId, infId) => {
      if (fromCatId !== targetId) {
        moveCardMut.mutate({ influencerId: infId, fromCategoryId: fromCatId, toCategoryId: targetId });
      }
    });
    exitBatchMode();
  }, [selected, batchTargetCat, moveCardMut, exitBatchMode]);

  // ── Drag & drop (handle on each card) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [activeDragName, setActiveDragName] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as any;
    const inf = data?.influencerId ? influencerMap.get(data.influencerId) : null;
    setActiveDragName(inf?.name || "卡片");
  }, [influencerMap]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragName(null);
    const { active, over } = event;
    if (!over) return;
    const src = active.data.current as any;
    const dst = over.data.current as any;
    if (!src?.influencerId || !dst?.categoryId) return;

    if (dst.type === "card" && dst.categoryId === src.categoryId) {
      // Reorder within the same category
      if (dst.influencerId === src.influencerId) return;
      const cat = groupedCategories.find((c: any) => c.id === src.categoryId);
      if (!cat) return;
      const items = [...(cat.items || [])];
      const fromIdx = items.findIndex((i: any) => i.influencerId === src.influencerId);
      const toIdx = items.findIndex((i: any) => i.influencerId === dst.influencerId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      saveCardOrderMut.mutate({
        categoryId: cat.id,
        orders: items.map((item: any, i: number) => ({ influencerId: item.influencerId, sortOrder: i })),
      });
    } else if (dst.categoryId !== src.categoryId) {
      // 「审核中」分类锁定：任何卡片不可移入
      const targetCat = groupedCategories.find((c: any) => c.id === dst.categoryId);
      if (targetCat?.name === "审核中") return;
      // Drop on another category (card or empty area) → move to the end
      moveCardMut.mutate({
        influencerId: src.influencerId,
        fromCategoryId: src.categoryId,
        toCategoryId: dst.categoryId,
      });
    }
  }, [groupedCategories, saveCardOrderMut, moveCardMut]);

  // Creator map for admin filter
  const creatorMap = useCreatorNameMap();
  const creators = useMemo(() => {
    const map = new Map<string, string>();
    // 基于未筛选的完整列表构建，避免选中某个创建者后下拉选项消失
    (listData?.items || []).forEach((inf: any) => {
      if (inf?.createdByUnionId) {
        map.set(inf.createdByUnionId, creatorMap.get(inf.createdByUnionId) || inf.createdByUnionId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [listData, creatorMap]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Users className="w-12 h-12 text-faint mx-auto mb-4" />
          <p className="text-sub">请登录查看网红管理</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content">网红管理</h1>
          <p className="text-sm text-sub mt-1">
            {isAdmin ? `共 ${visibleCount} 个网红 · 管理员模式` : `共 ${visibleCount} 个网红`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrashOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-line text-sub hover:text-content transition-all text-sm"
          >
            <Archive className="w-4 h-4" />垃圾箱
            {(trashData || []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                {(trashData || []).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lime text-black font-semibold hover:bg-lime transition-all"
          >
            <Plus className="w-4 h-4" />添加网红
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索网红..."
            className="pl-9 pr-4 py-2 rounded-lg bg-elevated border border-line text-content text-sm focus:outline-none focus:border-brand/30 w-48"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg bg-elevated border border-line text-content text-sm focus:outline-none focus:border-brand/30"
        >
          <option value="all">全部平台</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="xiaohongshu">小红书</option>
          <option value="douyin">抖音</option>
        </select>
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="px-3 py-2 rounded-lg bg-elevated border border-line text-content text-sm focus:outline-none focus:border-brand/30"
        >
          <option value="all">全部领域</option>
          {Object.entries(SELECTABLE_NICHES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="px-3 py-2 rounded-lg bg-elevated border border-line text-content text-sm focus:outline-none focus:border-brand/30"
          >
            <option value="all">全部用户</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm ${
            batchMode
              ? "bg-lime/15 border-brand/30 text-brand"
              : "bg-elevated border-line text-sub hover:text-content"
          }`}
        >
          <Settings className="w-4 h-4" />{batchMode ? "退出批量" : "批量管理"}
        </button>
        {showNewCatInput ? (
          <div className="flex items-center gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分类名称"
              className="px-3 py-2 rounded-lg bg-elevated border border-brand/30 text-content text-sm w-32 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim()) {
                  createCategoryMut.mutate({ name: newCatName.trim() });
                  setNewCatName("");
                  setShowNewCatInput(false);
                }
                if (e.key === "Escape") { setShowNewCatInput(false); setNewCatName(""); }
              }}
            />
            <button
              onClick={() => {
                if (newCatName.trim()) createCategoryMut.mutate({ name: newCatName.trim() });
                setNewCatName("");
                setShowNewCatInput(false);
              }}
              className="px-3 py-2 rounded-lg bg-lime text-black text-sm font-medium hover:bg-lime"
            >
              创建
            </button>
            <button
              onClick={() => { setShowNewCatInput(false); setNewCatName(""); }}
              className="px-2 py-2 rounded-lg text-faint text-sm hover:text-content"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewCatInput(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-elevated border border-dashed border-line text-faint hover:text-brand hover:border-brand/30 transition-all text-sm"
          >
            <FolderPlus className="w-4 h-4" />新建分类
          </button>
        )}
      </div>

      {/* Categories */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {filteredCategories.map((cat: any, catIndex: number) => {
          const isReviewCat = cat.name === "审核中";
          return (
          <div
            key={cat.id}
            className={`rounded-xl border ${isReviewCat ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-line bg-base"}`}
          >
            {/* Category header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleExpandMut.mutate({ id: cat.id })}
                  className="text-sub hover:text-content transition-colors"
                >
                  {cat.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {editingCatId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="px-2 py-1 rounded bg-elevated border border-line text-content text-sm w-32 focus:outline-none focus:border-brand/30"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editCatName.trim()) {
                          updateCategoryMut.mutate({ id: cat.id, name: editCatName.trim() });
                          setEditingCatId(null);
                        }
                        if (e.key === "Escape") setEditingCatId(null);
                      }}
                    />
                    <button onClick={() => {
                      if (editCatName.trim()) {
                        updateCategoryMut.mutate({ id: cat.id, name: editCatName.trim() });
                      }
                      setEditingCatId(null);
                    }} className="text-brand"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingCatId(null)} className="text-faint"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <h3 className="text-sm font-bold text-content flex items-center gap-1.5">
                    {cat.name}
                    {isReviewCat && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                  </h3>
                )}
                <span className="text-xs text-faint">({(cat.items || []).length})</span>
                {isReviewCat && (
                  <span className="text-[10px] text-amber-500/80">管理员填写审核报价后自动移出</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCategoryReorder(cat.id, -1)}
                  disabled={catIndex === 0}
                  className="w-6 h-6 rounded flex items-center justify-center text-faint hover:text-content transition-colors disabled:opacity-20 disabled:hover:text-faint"
                  title="上移分类"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleCategoryReorder(cat.id, 1)}
                  disabled={catIndex === filteredCategories.length - 1}
                  className="w-6 h-6 rounded flex items-center justify-center text-faint hover:text-content transition-colors disabled:opacity-20 disabled:hover:text-faint"
                  title="下移分类"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                {!isReviewCat && (
                <>
                <button
                  onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                  className="w-6 h-6 rounded flex items-center justify-center text-faint hover:text-brand transition-colors"
                  title="重命名"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`删除分类"${cat.name}"? 卡片将移至"网红库"。`)) {
                      deleteCategoryMut.mutate({ id: cat.id });
                    }
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-faint hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                </>
                )}
              </div>
            </div>

            {/* Cards grid */}
            {cat.isExpanded && (
              <CategoryDropZone categoryId={cat.id} className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.items.map((item: any, itemIndex: number) => (
                  <InfluencerCard
                    key={item.id}
                    inf={item.influencer}
                    isSelected={selectedInfluencer?.id === item.influencerId}
                    isAdmin={isAdmin}
                    canEdit={canEditCard(item.influencer)}
                    isPinned={item.isPinned === 1}
                    categories={isReviewCat ? undefined : filteredCategories.filter((c: any) => c.name !== "审核中")}
                    currentCategoryId={cat.id}
                    batchMode={batchMode}
                    checked={selected.has(item.influencerId)}
                    onToggleSelect={() => toggleSelect(item.influencerId, cat.id)}
                    dragData={!batchMode && !filtersActive && !isReviewCat ? { categoryId: cat.id, index: itemIndex } : undefined}
                    creatorName={isAdmin ? creatorMap.get(item.influencer.createdByUnionId) || item.influencer.createdByUnionId : undefined}
                    onSelect={() => {
                      setSelectedInfluencer(item.influencer);
                      setDetailOpen(true);
                    }}
                    onToggleHide={() => item.influencer.hidden ? handleUnhide(item.influencerId) : handleHide(item.influencerId)}
                    onDelete={() => handleDelete(item.influencerId)}
                    onTogglePin={() => togglePinMut.mutate({ influencerId: item.influencerId, categoryId: cat.id })}
                    onMoveCategory={isReviewCat ? undefined : (targetId: number) => handleMoveCard(item.influencerId, cat.id, targetId)}
                    onMoveForward={!batchMode && !filtersActive && itemIndex > 0 ? () => handleCardReorder(cat, itemIndex, -1) : undefined}
                    onMoveBackward={!batchMode && !filtersActive && itemIndex < cat.items.length - 1 ? () => handleCardReorder(cat, itemIndex, 1) : undefined}
                  />
                ))}
                {(cat.items || []).length === 0 && (
                  <div className="col-span-full text-center py-8 text-faint text-sm">
                    拖拽卡片到此处
                  </div>
                )}
              </CategoryDropZone>
            )}
          </div>
          );
        })}

      </div>
      <DragOverlay>
        {activeDragName ? (
          <div className="px-4 py-2 rounded-xl bg-elevated border border-brand/40 text-content text-sm font-bold shadow-2xl">
            {activeDragName}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {visibleCount === 0 && !isLoading && (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <Users className="w-12 h-12 text-faint mx-auto mb-4" />
            <p className="text-sub">暂无网红数据</p>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {batchMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 bg-surface border border-line rounded-xl shadow-2xl px-4 py-2.5">
          <span className="text-xs text-sub">已选 <span className="text-brand font-bold">{selected.size}</span> 项</span>
          <select
            value={batchTargetCat}
            onChange={(e) => setBatchTargetCat(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-base border border-line text-content text-xs focus:outline-none focus:border-brand/30"
          >
            <option value="">移动到分类…</option>
            {groupedCategories.filter((c: any) => c.name !== "审核中").map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={batchMove}
            disabled={!batchTargetCat || selected.size === 0}
            className="px-3 py-1.5 rounded-lg bg-cy/15 text-cy text-xs font-medium hover:bg-cy/25 transition-all disabled:opacity-30"
          >
            移动
          </button>
          {isAdmin && (
            <button
              onClick={batchHide}
              disabled={selected.size === 0}
              className="px-3 py-1.5 rounded-lg bg-hover text-sub text-xs font-medium hover:bg-hover transition-all disabled:opacity-30"
            >
              隐藏
            </button>
          )}
          <button
            onClick={batchDelete}
            disabled={selected.size === 0}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-all disabled:opacity-30"
          >
            删除
          </button>
          <button
            onClick={exitBatchMode}
            className="px-3 py-1.5 rounded-lg text-faint text-xs hover:text-content transition-all"
          >
            取消
          </button>
        </div>
      )}

      {/* Recycle bin modal */}
      {trashOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTrashOpen(false)} />
          <div className="relative w-full max-w-[520px] mx-4 max-h-[80vh] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-content flex items-center gap-2">
                <Archive className="w-5 h-5 text-brand" />垃圾箱
              </h2>
              <button onClick={() => setTrashOpen(false)} className="w-8 h-8 rounded-full bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-faint mb-4">
              {isAdmin ? "被删除的网红按删除时间排列,可恢复或彻底删除。" : "你删除的网红按删除时间排列,可恢复或彻底删除。"}
            </p>
            {(trashData || []).length === 0 ? (
              <div className="text-center py-10 text-faint text-sm">垃圾箱为空</div>
            ) : (
              <div className="space-y-2">
                {(trashData || []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-base border border-line">
                    <img
                      src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.handle}`}
                      alt={item.name}
                      className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-line"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-content truncate">{item.name}</p>
                      <p className="text-[10px] text-faint">
                        {platformLabels[item.platform] || item.platform} · 删除于 {item.deletedAt || "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => restoreInf({ id: item.id })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lime/10 text-brand text-[11px] font-medium hover:bg-lime/20 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />恢复
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`彻底删除「${item.name}」? 此操作不可撤销。`)) {
                          destroyInf({ id: item.id });
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />彻底删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail */}
      {selectedInfluencer && (
        <InfluencerDetail
          influencer={selectedInfluencer}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onUpdate={(updated: any) => {
            setSelectedInfluencer(updated);
          }}
        />
      )}

      {/* Add modal */}
      <AddInfluencerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(inf: any) => {
          setAddOpen(false);
          // 新网红自动进入「审核中」分类，等待管理员填写审核报价后自动移出
          if (inf?.id && categoryData?.categories && (categoryData.categories || []).length > 0) {
            let targetCat = categoryData.categories.find((c: any) => c.name === "审核中");
            if (!targetCat) targetCat = categoryData.categories.find((c: any) => c.name === "网红库");
            if (!targetCat) targetCat = categoryData.categories[0];
            if (targetCat) {
              assignCardMut.mutate({ influencerId: inf.id, categoryId: targetCat.id });
            }
          }
        }}
      />
    </div>
  );
}
