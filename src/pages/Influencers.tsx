import { useState, useMemo, useEffect, useCallback } from "react";
import { getNicheLabel } from "@/lib/niche-map";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router";
import {
  useInfluencerList,
  useDeleteInfluencer,
  useHideInfluencer,
  useUnhideInfluencer,
  useUserList,
  useNegotiationListAll,
  useCardCategoryList,
  useCreateCardCategory,
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
  Search, Plus, Users, Shield, UserCircle, EyeOff, Settings,
  Crown, User, ChevronDown, ChevronRight, FolderPlus, Trash2,
  Pin, Pencil, Check, X,
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
  const [adminOpen, setAdminOpen] = useState(false);

  // Card categories
  const { data: categoryData } = useCardCategoryList();
  const createCategoryMut = useCreateCardCategory();
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

  // Move card state
  const [moveMenuOpen, setMoveMenuOpen] = useState<number|null>(null);

  // Initialize default categories (create if "网红库" doesn't exist)
  useEffect(() => {
    if (!user?.unionId) return;
    if (!categoryData) return;
    const cats = categoryData.categories || [];
    const hasDefault = cats.some((c: any) => c.name === "网红库");
    if (!hasDefault) {
      // Create default categories
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
  } = useInfluencerList({ platform: platform !== "all" ? platform : undefined, creator: isAdmin && creator !== "all" ? creator : undefined });

  const { data: allNegotiations } = useNegotiationListAll();
  const { mutate: deleteInf } = useDeleteInfluencer();
  const { mutate: hideInf } = useHideInfluencer();
  const { mutate: unhideInf } = useUnhideInfluencer();

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
    return items;
  }, [listData, isAdmin, currentUnionId]);

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

  // Debug: expose data to window for inspection
  useEffect(() => {
    if (categoryData) {
      const items = categoryData.items || [];
      const firstItem = items[0];
      (window as any).__debug = {
        categoryCount: (categoryData.categories || []).length,
        itemCount: items.length,
        firstItemInfluencer: firstItem?.influencer,
        firstItemCategoryId: firstItem?.categoryId,
        influencerMapSize: influencerMap.size,
        user: (user as any)?.unionId || user?.email,
      };
      console.log("[DEBUG] categories:", (categoryData.categories || []).length, "items:", items.length);
      if (firstItem) console.log("[DEBUG] first item influencer:", firstItem.influencer);
    }
  }, [categoryData, influencerMap, user]);

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

  // Count visible items
  const visibleCount = useMemo(() => {
    return filteredCategories.reduce((sum: number, cat: any) => sum + (cat.items || []).length, 0);
  }, [filteredCategories]);

  const handleDelete = (id: number) => { if (confirm("确认删除此网红?")) deleteInf(id); };
  const handleHide = (id: number) => hideInf(id);
  const handleUnhide = (id: number) => unhideInf(id);

  // Move card handler
  const handleMoveCard = useCallback((influencerId: number, fromCategoryId: number, toCategoryId: number) => {
    if (fromCategoryId === toCategoryId) return;
    moveCardMut.mutate({ influencerId, fromCategoryId, toCategoryId });
  }, [moveCardMut]);

  // Creator map for admin filter
  const creatorMap = useCreatorNameMap();
  const creators = useMemo(() => {
    const map = new Map<string, string>();
    allInfluencers.forEach((inf: any) => {
      if (inf.createdByUnionId) {
        map.set(inf.createdByUnionId, creatorMap.get(inf.createdByUnionId) || inf.createdByUnionId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allInfluencers, creatorMap]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Users className="w-12 h-12 text-[#333] mx-auto mb-4" />
          <p className="text-[#888]">请登录查看网红管理</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">网红管理</h1>
          <p className="text-sm text-[#888] mt-1">
            {isAdmin ? `共 ${visibleCount} 个网红 · 管理员模式` : `共 ${visibleCount} 个网红`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ccff00] text-black font-semibold hover:bg-[#b8e600] transition-all"
          >
            <Plus className="w-4 h-4" />添加网红
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索网红..."
            className="pl-9 pr-4 py-2 rounded-lg bg-[#111] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#ccff00]/30 w-48"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#111] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#ccff00]/30"
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
          className="px-3 py-2 rounded-lg bg-[#111] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#ccff00]/30"
        >
          <option value="all">全部领域</option>
          <option value="lifestyle">Lifestyle</option>
          <option value="fashion">Fashion</option>
          <option value="beauty">Beauty</option>
          <option value="tech">Tech</option>
          <option value="food">Food</option>
          <option value="fitness">Fitness</option>
          <option value="parenting">Parenting</option>
          <option value="pet">Pet</option>
          <option value="gaming">Gaming</option>
          <option value="travel">Travel</option>
        </select>
        {isAdmin && (
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#111] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#ccff00]/30"
          >
            <option value="all">全部用户</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setAdminOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111] border border-white/[0.06] text-[#888] hover:text-white transition-all text-sm"
        >
          <Settings className="w-4 h-4" />批量管理
        </button>
      </div>

      {/* Debug info */}
      {categoryData && (
        <div className="text-xs text-[#666] bg-[#111] p-2 rounded">
          DEBUG: categories={(categoryData.categories || []).length}, items={(categoryData.items || []).length}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {filteredCategories.map((cat: any) => (
          <div
            key={cat.id}
            className="rounded-xl border border-white/[0.06] bg-[#0a0a0a]"
          >
            {/* Category header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleExpandMut.mutate({ id: cat.id })}
                  className="text-[#888] hover:text-white transition-colors"
                >
                  {cat.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {editingCatId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="px-2 py-1 rounded bg-[#111] border border-white/[0.1] text-white text-sm w-32 focus:outline-none focus:border-[#ccff00]/30"
                      autoFocus
                    />
                    <button onClick={() => {
                      if (editCatName.trim()) {
                        // Need update mutation - use create as placeholder then delete old
                      }
                      setEditingCatId(null);
                    }} className="text-[#ccff00]"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingCatId(null)} className="text-[#666]"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <h3 className="text-sm font-bold text-white">{cat.name}</h3>
                )}
                <span className="text-xs text-[#666]">({(cat.items || []).length})</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-[#ccff00] transition-colors"
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
                  className="w-6 h-6 rounded flex items-center justify-center text-[#555] hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Cards grid */}
            {cat.isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.items.map((item: any) => (
                  <InfluencerCard
                    key={item.id}
                    inf={item.influencer}
                    isSelected={selectedInfluencer?.id === item.influencerId}
                    isAdmin={isAdmin}
                    canEdit={canEditCard(item.influencer)}
                    isPinned={item.isPinned === 1}
                    categories={filteredCategories}
                    currentCategoryId={cat.id}
                    onSelect={() => {
                      setSelectedInfluencer(item.influencer);
                      setDetailOpen(true);
                    }}
                    onToggleHide={() => item.influencer.hidden ? handleUnhide(item.influencerId) : handleHide(item.influencerId)}
                    onDelete={() => handleDelete(item.influencerId)}
                    onTogglePin={() => togglePinMut.mutate({ itemId: item.id, categoryId: cat.id })}
                    onMoveCategory={(targetId: number) => handleMoveCard(item.influencerId, cat.id, targetId)}
                  />
                ))}
                {(cat.items || []).length === 0 && (
                  <div className="col-span-full text-center py-8 text-[#444] text-sm">
                    拖拽卡片到此处
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new category */}
        <div className="flex items-center gap-2">
          {showNewCatInput ? (
            <div className="flex items-center gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="分类名称"
                className="px-3 py-2 rounded-lg bg-[#111] border border-white/[0.1] text-white text-sm w-40 focus:outline-none focus:border-[#ccff00]/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatName.trim()) {
                    createCategoryMut.mutate({ name: newCatName.trim() });
                    setNewCatName("");
                    setShowNewCatInput(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newCatName.trim()) {
                    createCategoryMut.mutate({ name: newCatName.trim() });
                    setNewCatName("");
                  }
                  setShowNewCatInput(false);
                }}
                className="px-3 py-2 rounded-lg bg-[#ccff00] text-black text-sm font-medium hover:bg-[#b8e600]"
              >
                创建
              </button>
              <button
                onClick={() => { setShowNewCatInput(false); setNewCatName(""); }}
                className="px-3 py-2 rounded-lg bg-[#111] text-[#888] text-sm hover:text-white"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCatInput(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-white/[0.1] text-[#666] hover:text-[#ccff00] hover:border-[#ccff00]/30 transition-all text-sm"
            >
              <FolderPlus className="w-4 h-4" />新建分类
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {visibleCount === 0 && !isLoading && (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <Users className="w-12 h-12 text-[#333] mx-auto mb-4" />
            <p className="text-[#888]">暂无网红数据</p>
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
          // Auto-assign new influencer to "网红库" (or first available category)
          if (inf?.id && categoryData?.categories && (categoryData.categories || []).length > 0) {
            let targetCat = categoryData.categories.find((c: any) => c.name === "网红库");
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
