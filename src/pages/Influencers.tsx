import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router";
import {
  useInfluencerList,
  useDeleteInfluencer,
  useHideInfluencer,
  useUnhideInfluencer,
  useUserList,
  useNegotiationListAll,
} from "@/lib/influencer-api";
import { displayCountry } from "@/lib/countries";
import InfluencerDetail from "@/components/InfluencerDetail";
import AddInfluencerModal from "@/components/AddInfluencerModal";
import {
  Search,
  Plus,
  Users,
  Shield,
  UserCircle,
  Trash2,
  EyeOff,
  Eye,
  Settings,
  Handshake,
  ExternalLink,
  Crown,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setUserRole, getCurrentUser } from "@/lib/local-auth";

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

// Resolve display name from unionId
function useCreatorNameMap() {
  const { data: users } = useUserList();
  return useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((u) => {
      map.set(u.unionId, u.name || u.email || `用户#${u.id}`);
    });
    return map;
  }, [users]);
}

function getOwnerLabel(
  createdByUnionId: string | null,
  currentUserUnionId: string | undefined,
  creatorNameMap: Map<string, string>
): string | null {
  if (!createdByUnionId) return null;
  if (createdByUnionId === currentUserUnionId) return "我添加的";
  return creatorNameMap.get(createdByUnionId) || createdByUnionId;
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

  // Clear URL param when detail closes
  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedInfluencer(null);
    if (searchParams.has("influencerId")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("influencerId");
      setSearchParams(newParams, { replace: true });
    }
  };

  const creatorNameMap = useCreatorNameMap();
  const currentUnionId = user
    ? user.email
      ? `local_${user.email}`
      : `oauth_${user.id}`
    : undefined;

  // Build creator filter value
  const creatorFilter = useMemo(() => {
    if (creator === "all") return undefined;
    if (creator === "me" && currentUnionId) return currentUnionId;
    return creator;
  }, [creator, currentUnionId]);

  // Fetch from backend
  const { data: listData, isLoading } = useInfluencerList({
    platform: platform === "all" ? undefined : platform,
    niche: niche === "all" ? undefined : niche,
    search: search || undefined,
    creator: creatorFilter,
  });

  const allInfluencers = listData?.items || [];

  // Auto-open detail from URL ?influencerId=xxx
  useEffect(() => {
    const influencerIdParam = searchParams.get("influencerId");
    if (influencerIdParam) {
      const id = Number(influencerIdParam);
      const found = allInfluencers.find((i: any) => i.id === id);
      if (found) {
        setSelectedInfluencer(found);
        setDetailOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allInfluencers.length]);

  const deleteMutation = useDeleteInfluencer();
  const hideMutation = useHideInfluencer();
  const unhideMutation = useUnhideInfluencer();

  // Fetch latest negotiation prices for all visible influencers
  const influencerIds = allInfluencers.map(i => i.id);
  const { data: allNegotiations } = useNegotiationListAll(influencerIds);

  // Compute latest non-zero prices per influencer
  const latestPriceMap = useMemo(() => {
    const map = new Map<number, { userPrice: number; adminPrice: number }>();
    if (!allNegotiations) return map;
    for (const n of allNegotiations) {
      const id = n.influencerId;
      const existing = map.get(id) || { userPrice: 0, adminPrice: 0 };
      if (n.userPrice > 0) existing.userPrice = n.userPrice;
      if (n.adminPrice > 0) existing.adminPrice = n.adminPrice;
      map.set(id, existing);
    }
    return map;
  }, [allNegotiations]);

  // Merge latest prices into influencer data
  const influencersWithPrices = useMemo(() => {
    return allInfluencers.map(inf => {
      const lp = latestPriceMap.get(inf.id);
      if (!lp) return inf;
      return {
        ...inf,
        userPrice: lp.userPrice || inf.userPrice || 0,
        adminPrice: lp.adminPrice || inf.adminPrice || 0,
      };
    });
  }, [allInfluencers, latestPriceMap]);

  // Client-side creator filter for non-admin "me" option
  const influencers = useMemo(() => {
    let result = [...influencersWithPrices];
    // For normal users filtering by "me", we need client-side filter
    // because the unionId format may differ
    if (!isAdmin && creator === "me" && currentUnionId) {
      result = result.filter(
        (i) => i.createdByUnionId === currentUnionId
      );
    }
    return result;
  }, [influencersWithPrices, creator, isAdmin, currentUnionId]);

  // Get unique creators from loaded data
  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    allInfluencers.forEach((inf) => {
      if (inf.createdByUnionId && !map.has(inf.createdByUnionId)) {
        const name = creatorNameMap.get(inf.createdByUnionId);
        map.set(inf.createdByUnionId, name || inf.createdByUnionId);
      }
    });
    return Array.from(map.entries()).map(([unionId, name]) => ({
      unionId,
      name,
    }));
  }, [allInfluencers, creatorNameMap]);

  const niches = useMemo(
    () => [...new Set(allInfluencers.map((i) => i.niche))].filter(Boolean),
    [allInfluencers]
  );

  const myCount = allInfluencers.filter(
    (i) => i.createdByUnionId === currentUnionId
  ).length;
  const hiddenCount = allInfluencers.filter((i) => i.hidden).length;

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除此网红？此操作不可撤销。")) return;
    deleteMutation.mutate({ id });
  };
  const handleHide = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    hideMutation.mutate({ id });
  };
  const handleUnhide = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    unhideMutation.mutate({ id });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#ccff00]" />
          <h1 className="section-title">网红管理</h1>
          <span className="text-xs text-[#666]">{influencers.length} 位</span>
          {isAuthenticated && myCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ccff00]/10 text-[#ccff00] font-medium">
              我添加了 {myCount} 位
            </span>
          )}
          {isAdmin && hiddenCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
              <EyeOff className="w-2.5 h-2.5 inline mr-0.5" />
              {hiddenCount} 位已隐藏
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#ccff00]/20 text-[#ccff00] text-xs hover:bg-[#ccff00]/5 transition-all"
              onClick={() => setAdminOpen(true)}
            >
              <Settings className="w-3.5 h-3.5" />
              权限管理
            </button>
          )}
          <button
            className="btn-lime flex items-center gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            添加网红
          </button>
        </div>
      </div>

      {/* Admin summary bar */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-[#666] flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#ccff00]" />
            管理员视图：
          </span>
          {hiddenCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/5 text-red-400">
              已隐藏 {hiddenCount}
            </span>
          )}
          {creatorOptions.map((o) => (
            <span
              key={o.unionId}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[#888]"
            >
              {o.name}{" "}
              {
                allInfluencers.filter(
                  (i) => i.createdByUnionId === o.unionId
                ).length
              }
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
          <input
            type="text"
            placeholder="搜索网红..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#141414] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/30"
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
          className="bg-[#141414] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/30"
        >
          <option value="all">全部领域</option>
          {niches.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {isAdmin && creatorOptions.length > 0 && (
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="bg-[#141414] border border-[#ccff00]/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/50"
          >
            <option value="all">全部添加者</option>
            {creatorOptions.map((o) => (
              <option key={o.unionId} value={o.unionId}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        {isAuthenticated && !isAdmin && (
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="bg-[#141414] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/30"
          >
            <option value="all">全部</option>
            <option value="me">我添加的</option>
          </select>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#ccff00] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && influencers.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-[#333] mx-auto mb-3" />
          <p className="text-sm text-[#666] mb-1">暂无网红数据</p>
          <p className="text-xs text-[#555]">点击右上角按钮添加第一位网红</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {influencers.map((inf) => {
          const ownerLabel = getOwnerLabel(
            inf.createdByUnionId,
            currentUnionId,
            creatorNameMap
          );
          return (
            <div
              key={inf.id}
              className={`card-surface p-4 hover-lift cursor-pointer group relative ${
                inf.hidden ? "opacity-60 border-red-500/20" : ""
              }`}
              onClick={() => {
                setSelectedInfluencer(inf);
                setDetailOpen(true);
              }}
            >
              {/* Admin action buttons */}
              {isAdmin ? (
                <div className="absolute top-2 right-2 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {inf.hidden ? (
                    <>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold mr-1">
                        已隐藏
                      </span>
                      <button
                        onClick={(e) => handleUnhide(inf.id, e)}
                        className="w-7 h-7 rounded-lg bg-[#ccff00]/10 flex items-center justify-center text-[#ccff00] hover:bg-[#ccff00]/20 transition-colors"
                        title="取消隐藏"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => handleHide(inf.id, e)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                      title="隐藏"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(inf.id, e)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : user && inf.createdByUnionId === currentUnionId ? (
                <div className="absolute top-2 right-2 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(inf.id, e)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}

              {/* Owner label + Country */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {ownerLabel && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                      inf.createdByUnionId === currentUnionId
                        ? "bg-[#ccff00]/10 text-[#ccff00]"
                        : "bg-white/[0.04] text-[#888]"
                    }`}
                  >
                    {inf.createdByUnionId === currentUnionId ? (
                      <UserCircle className="w-2.5 h-2.5 inline mr-0.5" />
                    ) : null}
                    {ownerLabel}
                  </span>
                )}
                {inf.location && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[#aaa] font-medium">
                    {displayCountry(inf.location)}
                  </span>
                )}
              </div>

              {/* Name row */}
              <div className="flex items-start gap-3 mb-2">
                <img
                  src={inf.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + inf.handle}
                  alt={inf.name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {inf.name}
                  </h3>
                  <p className="text-[11px] text-[#666]">{inf.handle}</p>
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[#888] font-medium">
                    {platformLabels[inf.platform]}
                  </span>
                </div>
              </div>

              {/* Dual price display */}
              <div className="mb-2 space-y-1">
                {inf.coopStatus === "not-cooperating" && (
                  <div className="flex items-center justify-end mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 font-bold">
                      不合作
                    </span>
                  </div>
                )}
                {inf.userPrice > 0 && inf.coopStatus !== "not-cooperating" && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#888]">网红报价</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#ccff00]">
                        ${inf.userPrice.toLocaleString()}
                      </span>
                      {inf.userPriceUpdatedAt && (
                        <span className="text-[9px] text-[#555] ml-1">
                          {inf.userPriceUpdatedAt}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {inf.adminPrice > 0 && inf.coopStatus !== "not-cooperating" && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#888]">审核报价</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#06b6d4]">
                        ${inf.adminPrice.toLocaleString()}
                      </span>
                      {inf.adminPriceUpdatedAt && (
                        <span className="text-[9px] text-[#555] ml-1">
                          {inf.adminPriceUpdatedAt}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {inf.userPrice === 0 &&
                  inf.adminPrice === 0 &&
                  inf.coopStatus !== "not-cooperating" && (
                    <div className="text-[10px] text-[#555] text-right">
                      暂无报价
                    </div>
                  )}
              </div>

              <p className="text-[11px] text-[#666] line-clamp-2 mb-3">
                {inf.bio}
              </p>

              <div className="p-3 rounded-xl bg-white/[0.02] text-center mb-3">
                <p className="text-xs font-bold text-white">
                  {formatNumber(inf.followers || 0)}
                </p>
                <p className="text-[9px] text-[#555]">粉丝</p>
              </div>

              {/* Profile link + Owner */}
              <div className="flex items-center justify-between mt-2">
                {inf.profileUrl ? (
                  <a
                    href={inf.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] text-[#06b6d4] hover:text-[#33c4e8] transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    网红主页
                  </a>
                ) : (
                  <span />
                )}
                {ownerLabel && (
                  <span className="text-[9px] text-[#666]">
                    由 <span className="text-[#888]">{ownerLabel}</span> 添加
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <InfluencerDetail
        influencer={selectedInfluencer}
        open={detailOpen}
        onClose={handleDetailClose}
      />

      <AddInfluencerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(newInf) => {
          setAddOpen(false);
          setSelectedInfluencer(newInf);
          setDetailOpen(true);
        }}
      />

      <RoleManagementModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
      />
    </div>
  );
}

/* ─── Role Management Modal ─────────────────────────────────── */
function RoleManagementModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: users, isLoading } = useUserList();
  const [message, setMessage] = useState<string | null>(null);
  const currentUser = getCurrentUser();

  const handleToggleRole = (
    userId: number,
    currentRole: string,
    email: string
  ) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    // Block self-modification and built-in admin
    if (email === "admin@pulseboost.ai") {
      setMessage("不能修改内置管理员账号");
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    if (setUserRole(userId, newRole)) {
      setMessage(newRole === "admin" ? "已设为管理员" : "已设为普通用户");
      setTimeout(() => {
        setMessage(null);
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#141414] border border-white/[0.06] text-white rounded-2xl max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2 text-base">
            <Settings className="w-5 h-5 text-[#ccff00]" />
            权限管理
          </DialogTitle>
        </DialogHeader>

        {message && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#ccff00]/10 text-[#ccff00] text-xs font-medium text-center">
            {message}
          </div>
        )}

        <p className="text-xs text-[#666] mb-3">
          {isLoading
            ? "加载中..."
            : `共 ${users?.length || 0} 位注册用户`}
        </p>

        <div className="space-y-2">
          {users?.map((u) => {
            const isAdminRole = u.role === "admin";
            const isCurrentUser = currentUser?.id === u.id;
            const isBuiltInAdmin = u.email === "admin@pulseboost.ai";
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]"
              >
                <img
                  src={
                    u.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email || u.id}`
                  }
                  alt={u.name || ""}
                  className="w-9 h-9 rounded-full object-cover border border-white/[0.06]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white truncate">
                      {u.name || u.email?.split("@")[0] || `用户#${u.id}`}
                    </p>
                    {isAdminRole && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ccff00]/10 text-[#ccff00] font-medium flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        管理员
                      </span>
                    )}
                    {!isAdminRole && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#666] font-medium flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />
                        普通用户
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#666] truncate">
                    {u.email || u.unionId}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleToggleRole(u.id, u.role, u.email || "")
                  }
                  disabled={isCurrentUser || isBuiltInAdmin}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${
                    isCurrentUser || isBuiltInAdmin
                      ? "bg-white/[0.02] text-[#444] cursor-not-allowed"
                      : isAdminRole
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20"
                  }`}
                >
                  {isAdminRole ? "取消管理" : "设为管理"}
                </button>
              </div>
            );
          })}
        </div>

        {users?.length === 0 && (
          <div className="text-center py-8">
            <UserCircle className="w-8 h-8 text-[#444] mx-auto mb-2" />
            <p className="text-xs text-[#666]">暂无注册用户</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
