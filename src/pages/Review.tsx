import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInfluencerList, useNegotiationListAll } from "@/lib/influencer-api";
import { getNicheLabel } from "@/lib/niche-map";
import { parseCoopTypes } from "@/lib/coop-types";
import { ShieldCheck, Handshake, FileText, Video, BarChart3, MapPin, Hash } from "lucide-react";

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

// Read-only card for review mode
function ReviewCard({ inf }: { inf: any }) {
  if (!inf || !inf.id) return null;
  const coopItems = parseCoopTypes(inf.coopTypes);

  return (
    <div className="card-surface p-4 relative opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex gap-3">
        <img
          src={inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inf.handle}`}
          alt={inf.name}
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/[0.06]"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{inf.name}</h3>
          <p className="text-[11px] text-[#666] truncate">{inf.handle}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888]">
              {platformLabels[inf.platform] || inf.platform}
            </span>
            {inf.location && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />{displayCountry(inf.location)}
              </span>
            )}
            {inf.niche && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />{getNicheLabel(inf.niche)}
              </span>
            )}
          </div>
        </div>
      </div>

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
      </div>

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
    </div>
  );
}

export default function Review() {
  const { isAdmin } = useAuth();
  const [reviewTab, setReviewTab] = useState<"price"|"script"|"video"|"post">("price");

  // Fetch ALL influencers directly (not via categories) so uncategorized ones also show
  const { data: listData } = useInfluencerList({});
  const { data: allNegotiations } = useNegotiationListAll();

  const allInfluencers = useMemo(() => {
    return (listData?.items || []).filter((item: any) => item != null && item.id != null);
  }, [listData]);

  // Merge price data from negotiations
  const latestPriceMap = useMemo(() => {
    const map = new Map<number, { userPrice: number; adminPrice: number }>();
    if (!allNegotiations) return map;
    for (const n of allNegotiations) {
      if (!n || n.influencerId == null) continue;
      const existing = map.get(n.influencerId) || { userPrice: 0, adminPrice: 0 };
      if (n.userPrice > 0) existing.userPrice = n.userPrice;
      if (n.adminPrice > 0) existing.adminPrice = n.adminPrice;
      map.set(n.influencerId, existing);
    }
    return map;
  }, [allNegotiations]);

  const influencersWithPrices = useMemo(() => {
    return allInfluencers.map((inf: any) => {
      const prices = latestPriceMap.get(inf.id);
      return prices ? { ...inf, ...prices } : inf;
    });
  }, [allInfluencers, latestPriceMap]);

  const tabConfig = [
    { key: "price" as const, label: "报价审核", icon: Handshake, desc: "网红已提交报价，等待管理员审核" },
    { key: "script" as const, label: "脚本审核", icon: FileText, desc: "脚本内容待审核确认" },
    { key: "video" as const, label: "视频审核", icon: Video, desc: "视频初稿待审核确认" },
    { key: "post" as const, label: "发布审核", icon: BarChart3, desc: "发布记录待审核确认" },
  ];

  // Filter by review tab
  const filteredForReview = useMemo(() => {
    return influencersWithPrices.filter((inf: any) => {
      if (reviewTab === "price") return inf.userPrice > 0;
      if (reviewTab === "script") return inf.coopStatus !== "not-cooperating";
      if (reviewTab === "video") return inf.coopStatus !== "not-cooperating";
      if (reviewTab === "post") return inf.adminPrice > 0;
      return true;
    });
  }, [influencersWithPrices, reviewTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" />审核中心
        </h1>
        <p className="text-sm text-[#888] mt-1">审核网红卡片各项流程</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-3">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = reviewTab === tab.key;
          const count = influencersWithPrices.filter((inf: any) => {
            if (tab.key === "price") return inf.userPrice > 0;
            if (tab.key === "script") return inf.coopStatus !== "not-cooperating";
            if (tab.key === "video") return inf.coopStatus !== "not-cooperating";
            if (tab.key === "post") return inf.adminPrice > 0;
            return false;
          }).length;
          return (
            <button
              key={tab.key}
              onClick={() => setReviewTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                  : "text-[#888] hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.04] text-[#666]"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[#666]">
        {tabConfig.find(t => t.key === reviewTab)?.desc}
      </p>

      {/* Read-only cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredForReview.map((inf: any) => (
          <ReviewCard key={inf.id} inf={inf} />
        ))}
      </div>

      {filteredForReview.length === 0 && (
        <div className="flex items-center justify-center h-[30vh]">
          <p className="text-[#666] text-sm">暂无待审核项目</p>
        </div>
      )}
    </div>
  );
}
