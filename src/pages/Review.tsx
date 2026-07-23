import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useInfluencerList,
  useNegotiationListAll,
  useScriptReviewListAll,
  useVideoReviewListAll,
  usePostListAll,
  useUserList,
} from "@/lib/influencer-api";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes } from "@/lib/coop-types";
import { displayCountry } from "@/lib/countries";
import InfluencerDetail from "@/components/InfluencerDetail";
import { ShieldCheck, Handshake, FileText, Video, BarChart3 } from "lucide-react";

const platformLabels: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", xiaohongshu: "小红书", douyin: "抖音",
};
const platformAbbr: Record<string, string> = {
  instagram: "IG", tiktok: "TT", xiaohongshu: "XHS", douyin: "DY",
  Instagram: "IG", TikTok: "TT", 小红书: "XHS", 抖音: "DY",
};

// Read-only card for review mode — click opens the full detail dialog
// 方案 A 布局：与网红页卡片同一视觉体系（零徽章元信息行 + 19px 双价格锚点）
function ReviewCard({ inf, creatorName, onClick }: { inf: any; creatorName?: string; onClick: () => void }) {
  if (!inf || !inf.id) return null;
  const coopItems = parseCoopTypes(inf.coopTypes);

  return (
    <div
      onClick={onClick}
      className="card-surface p-4 relative opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
    >
      {/* 左上角：提交人 */}
      {creatorName && (
        <p className="text-[10px] text-sub mb-2">
          由 <span className="text-brand font-semibold">{creatorName}</span> 提交
        </p>
      )}
      <div className="flex items-center gap-3">
        <img
          src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`}
          alt={inf.name}
          className="w-[46px] h-[46px] rounded-xl object-cover flex-shrink-0 border border-line"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-extrabold text-content truncate leading-tight">{inf.name}</h3>
          <p className="text-[11.5px] text-faint truncate">{inf.handle}</p>
        </div>
      </div>

      {/* 元信息行：平台 · 国家 · 领域（零徽章，点分隔） */}
      <p className="text-[11.5px] text-sub mt-2.5 truncate">
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

      {/* 合作类型缩写行 */}
      {coopItems.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-3">
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
      )}

      {inf.bio && (
        <p className="text-[11px] text-faint mt-2 truncate">{inf.bio}</p>
      )}
    </div>
  );
}

export default function Review() {
  const { isAdmin } = useAuth();
  const [reviewTab, setReviewTab] = useState<"price"|"script"|"video"|"post">("price");
  const [selectedInfluencer, setSelectedInfluencer] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch ALL influencers directly (not via categories) so uncategorized ones also show
  const { data: listData } = useInfluencerList({});
  const { data: allNegotiations } = useNegotiationListAll();
  const { data: allScriptReviews = [] } = useScriptReviewListAll();
  const { data: allVideoReviews = [] } = useVideoReviewListAll();
  const { data: allPosts = [] } = usePostListAll();
  const { data: allUsers } = useUserList();

  const creatorMap = useMemo(() => {
    const map = new Map<string, string>();
    (allUsers || []).forEach((u: any) => {
      if (u?.unionId) map.set(u.unionId, u.name || u.email || `用户#${u.id}`);
    });
    return map;
  }, [allUsers]);

  const allInfluencers = useMemo(() => {
    return (listData?.items || []).filter((item: any) => item != null && item.id != null);
  }, [listData]);

  // Latest negotiation round per influencer — used for price display AND
  // for detecting a price quote that is still waiting for admin review
  const latestPriceMap = useMemo(() => {
    const map = new Map<number, { userPrice: number; adminPrice: number; round?: number; userPriceLocal: number | null; userPriceCurrency: string | null }>();
    if (!allNegotiations) return map;
    for (const n of allNegotiations) {
      if (!n || n.influencerId == null) continue;
      const existing = map.get(n.influencerId);
      if (!existing || n.round > (existing.round ?? 0)) {
        map.set(n.influencerId, {
          userPrice: n.userPrice ?? 0,
          adminPrice: n.adminPrice ?? 0,
          round: n.round,
          userPriceLocal: n.userPriceLocal ?? null,
          userPriceCurrency: n.userPriceCurrency ?? null,
        });
      }
    }
    return map;
  }, [allNegotiations]);

  const influencersWithPrices = useMemo(() => {
    return allInfluencers.map((inf: any) => {
      const prices = latestPriceMap.get(inf.id);
      return prices ? { ...inf, userPrice: prices.userPrice, adminPrice: prices.adminPrice, userPriceLocal: prices.userPriceLocal, userPriceCurrency: prices.userPriceCurrency } : inf;
    });
  }, [allInfluencers, latestPriceMap]);

  // ─── Pending-review classification ──────────────────────────
  // A card belongs to a review tab ONLY when it has a concrete pending
  // item of that type — never inferred from coopStatus.
  // 报价: latest negotiation round has a user quote but no admin price yet
  const pricePendingIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [id, p] of latestPriceMap) {
      if (p.userPrice > 0 && !(p.adminPrice > 0)) ids.add(id);
    }
    return ids;
  }, [latestPriceMap]);

  // 脚本/视频: a review record with status "pending" exists
  const scriptPendingIds = useMemo(() => {
    return new Set<number>(
      (allScriptReviews || [])
        .filter((r: any) => r && r.status === "pending" && r.influencerId != null)
        .map((r: any) => r.influencerId)
    );
  }, [allScriptReviews]);

  const videoPendingIds = useMemo(() => {
    return new Set<number>(
      (allVideoReviews || [])
        .filter((r: any) => r && r.status === "pending" && r.influencerId != null)
        .map((r: any) => r.influencerId)
    );
  }, [allVideoReviews]);

  // 发布: a post record with status "pending" exists
  const postPendingIds = useMemo(() => {
    return new Set<number>(
      (allPosts || [])
        .filter((p: any) => p && p.status === "pending" && p.influencerId != null)
        .map((p: any) => p.influencerId)
    );
  }, [allPosts]);

  const pendingMap = useMemo(() => ({
    price: pricePendingIds,
    script: scriptPendingIds,
    video: videoPendingIds,
    post: postPendingIds,
  }), [pricePendingIds, scriptPendingIds, videoPendingIds, postPendingIds]);

  const tabConfig = [
    { key: "price" as const, label: "报价审核", icon: Handshake, desc: "网红已提交报价，等待管理员审核" },
    { key: "script" as const, label: "脚本审核", icon: FileText, desc: "脚本内容待审核确认" },
    { key: "video" as const, label: "视频审核", icon: Video, desc: "视频初稿待审核确认" },
    { key: "post" as const, label: "发布审核", icon: BarChart3, desc: "发布记录待审核确认" },
  ];

  // Filter by review tab — driven purely by concrete pending items
  const filteredForReview = useMemo(() => {
    const ids = pendingMap[reviewTab];
    return influencersWithPrices.filter((inf: any) => ids.has(inf.id));
  }, [influencersWithPrices, reviewTab, pendingMap]);

  // Tab badge counts — computed over the SAME visible influencer set as the
  // cards below, so trashed/orphaned review records never inflate the count
  const visibleCounts = useMemo(() => {
    const counts: Record<"price"|"script"|"video"|"post", number> = { price: 0, script: 0, video: 0, post: 0 };
    for (const inf of influencersWithPrices) {
      if (pricePendingIds.has(inf.id)) counts.price++;
      if (scriptPendingIds.has(inf.id)) counts.script++;
      if (videoPendingIds.has(inf.id)) counts.video++;
      if (postPendingIds.has(inf.id)) counts.post++;
    }
    return counts;
  }, [influencersWithPrices, pricePendingIds, scriptPendingIds, videoPendingIds, postPendingIds]);

  return (
    <div className="space-y-6 max-w-[1680px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-content flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" />审核中心
        </h1>
        <p className="text-sm text-sub mt-1">审核网红卡片各项流程</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-3">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = reviewTab === tab.key;
          const count = visibleCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setReviewTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                  : "text-sub hover:text-content hover:bg-hover border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-purple-500/20 text-purple-400" : "bg-hover text-faint"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-faint">
        {tabConfig.find(t => t.key === reviewTab)?.desc}
      </p>

      {/* Read-only cards grid */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {filteredForReview.map((inf: any) => (
          <ReviewCard
            key={inf.id}
            inf={inf}
            creatorName={creatorMap.get(inf.createdByUnionId)}
            onClick={() => {
              setSelectedInfluencer(inf);
              setDetailOpen(true);
            }}
          />
        ))}
      </div>

      {filteredForReview.length === 0 && (
        <div className="flex items-center justify-center h-[30vh]">
          <p className="text-faint text-sm">暂无待审核项目</p>
        </div>
      )}

      {/* Card detail dialog */}
      {selectedInfluencer && (
        <InfluencerDetail
          influencer={selectedInfluencer}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onUpdate={(updated: any) => setSelectedInfluencer(updated)}
        />
      )}
    </div>
  );
}
