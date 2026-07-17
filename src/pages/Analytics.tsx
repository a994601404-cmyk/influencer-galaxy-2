import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import {
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  BarChart3,
  Users,
  Handshake,
  ExternalLink,
  Trash2,
  Search,
  DollarSign,
} from "lucide-react";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default function Analytics() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "exposures" | "likes" | "engagement">("date");

  // Fetch data from backend
  const { data: allPosts = [] } = trpc.post.listAll.useQuery();
  const { data: listData } = trpc.influencer.list.useQuery();
  const influencers = (listData?.items ?? []).filter(
    (item: any) => item != null && item.id != null
  );
  const utils = trpc.useUtils();
  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => {
      utils.post.listAll.invalidate();
      utils.post.list.invalidate();
    },
  });

  // Build influencer map
  const infMap = useMemo(() => {
    const map = new Map<number, { name: string; handle: string; avatar: string; platform: string; adminPrice: number }>();
    influencers.forEach((inf: any) => {
      map.set(inf.id, { name: inf.name, handle: inf.handle, avatar: inf.avatar || "", platform: inf.platform, adminPrice: inf.adminPrice || 0 });
    });
    return map;
  }, [influencers]);

  // Build post list with influencer info
  const allCollabs = useMemo(() => {
    return allPosts
      .map((p: any) => {
        const inf = infMap.get(p.influencerId);
        return {
          ...p,
          influencerName: inf?.name || "未知网红",
          influencerHandle: inf?.handle || "",
          influencerAvatar: inf?.avatar || "",
          influencerPlatform: inf?.platform || "",
          adminPrice: inf?.adminPrice || 0,
        };
      })
      .filter((c: any) => c.influencerName !== "未知网红");
  }, [allPosts, infMap]);

  // Stats
  const stats = useMemo(() => {
    return {
      totalPosts: allCollabs.length,
      totalNextDayExposures: allCollabs.reduce((s: number, c: any) => s + (c.nextDayExposures || 0), 0),
      totalSevenDayExposures: allCollabs.reduce((s: number, c: any) => s + (c.sevenDayExposures || 0), 0),
      totalLikes: allCollabs.reduce((s: number, c: any) => s + (c.likes || 0), 0),
      totalComments: allCollabs.reduce((s: number, c: any) => s + (c.comments || 0), 0),
      totalShares: allCollabs.reduce((s: number, c: any) => s + (c.shares || 0), 0),
      avgEngagement: allCollabs.length > 0
        ? allCollabs.reduce((s: number, c: any) => s + ((c.likes || 0) + (c.comments || 0) + (c.shares || 0)) / Math.max(c.sevenDayExposures || c.nextDayExposures || 1, 1), 0) / allCollabs.length * 100
        : 0,
    };
  }, [allCollabs]);

  // Per-influencer summary
  const influencerSummaries = useMemo(() => {
    const map = new Map<number, { inf: any; posts: number; nextDayExp: number; sevenDayExp: number; likes: number; comments: number; shares: number }>();
    allCollabs.forEach((c: any) => {
      const existing = map.get(c.influencerId);
      const inf = infMap.get(c.influencerId);
      if (!inf) return;
      if (existing) {
        existing.posts++;
        existing.nextDayExp += c.nextDayExposures || 0;
        existing.sevenDayExp += c.sevenDayExposures || 0;
        existing.likes += c.likes || 0;
        existing.comments += c.comments || 0;
        existing.shares += c.shares || 0;
      } else {
        map.set(c.influencerId, { inf, posts: 1, nextDayExp: c.nextDayExposures || 0, sevenDayExp: c.sevenDayExposures || 0, likes: c.likes || 0, comments: c.comments || 0, shares: c.shares || 0 });
      }
    });
    return [...map.values()].sort((a, b) => b.sevenDayExp - a.sevenDayExp);
  }, [allCollabs, infMap]);

  // Filter & sort
  const filteredCollabs = useMemo(() => {
    let result = [...allCollabs];
    if (platformFilter !== "all") {
      result = result.filter((c: any) => c.influencerPlatform === platformFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((c: any) =>
        c.influencerName.toLowerCase().includes(s) ||
        c.influencerHandle.toLowerCase().includes(s) ||
        (c.notes || "").toLowerCase().includes(s)
      );
    }
    switch (sortBy) {
      case "date": result.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case "exposures": result.sort((a: any, b: any) => (b.sevenDayExposures || b.nextDayExposures || 0) - (a.sevenDayExposures || a.nextDayExposures || 0)); break;
      case "likes": result.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0)); break;
      case "engagement": result.sort((a: any, b: any) => (((b.likes || 0) + (b.comments || 0) + (b.shares || 0)) / Math.max(b.sevenDayExposures || b.nextDayExposures || 1, 1)) - (((a.likes || 0) + (a.comments || 0) + (a.shares || 0)) / Math.max(a.sevenDayExposures || a.nextDayExposures || 1, 1))); break;
    }
    return result;
  }, [allCollabs, platformFilter, search, sortBy]);

  const platformOptions = useMemo(() => [...new Set(influencers.map((i: any) => i.platform))], [influencers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-[#ccff00]" />
        <h1 className="section-title">合作数据分析</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "发布次数", value: stats.totalPosts, icon: Handshake, color: "#ccff00" },
          { label: "次日总曝光", value: formatNumber(stats.totalNextDayExposures), icon: Eye, color: "#06b6d4" },
          { label: "7日总曝光", value: formatNumber(stats.totalSevenDayExposures), icon: Eye, color: "#06b6d4" },
          { label: "总点赞", value: formatNumber(stats.totalLikes), icon: Heart, color: "#ef4444" },
          { label: "总评论", value: formatNumber(stats.totalComments), icon: MessageCircle, color: "#f59e0b" },
          { label: "总转发", value: formatNumber(stats.totalShares), icon: TrendingUp, color: "#10b981" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card-surface p-4 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
              <p className="text-lg font-black text-white">{s.value}</p>
              <p className="text-[10px] text-[#555]">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Influencer Summaries */}
      {influencerSummaries.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#ccff00]" />网红发布汇总</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {influencerSummaries.map((s: any) => (
              <div key={s.inf.id} className="p-3 rounded-xl bg-white/[0.02] flex items-center gap-3">
                <img src={s.inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.inf.handle}`} alt={s.inf.name} className="w-10 h-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{s.inf.name}</p>
                  <p className="text-[10px] text-[#666]">{s.posts} 次发布 · {formatNumber(s.sevenDayExp)} 7日曝光</p>
                  <div className="flex gap-2 mt-1 text-[9px] text-[#888]">
                    <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-red-400" />{formatNumber(s.likes)}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5 text-[#f59e0b]" />{formatNumber(s.comments)}</span>
                    <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5 text-[#10b981]" />{formatNumber(s.shares)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card-surface p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input type="text" placeholder="搜索网红或备注..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#ccff00]/30" />
          </div>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
            <option value="all">全部平台</option>
            {platformOptions.map((p: string) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/30">
            <option value="date">按日期</option>
            <option value="exposures">按曝光</option>
            <option value="likes">按点赞</option>
            <option value="engagement">按互动率</option>
          </select>
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-2">
        {filteredCollabs.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <Handshake className="w-10 h-10 text-[#444] mx-auto mb-3" />
            <p className="text-sm text-[#666]">暂无发布数据</p>
            <p className="text-[10px] text-[#555] mt-1">在网红页面点击卡片，记录发布数据</p>
          </div>
        ) : (
          filteredCollabs.map((c: any) => {
            const cpm7d = c.adminPrice > 0 && c.sevenDayExposures > 0
              ? ((c.adminPrice / c.sevenDayExposures) * 1000).toFixed(2)
              : null;
            return (
              <div key={c.id} className="card-surface p-4 flex items-start gap-4">
                <img src={c.influencerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.influencerHandle}`} alt={c.influencerName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{c.influencerName}</span>
                      <span className="text-[10px] text-[#666]">{c.influencerHandle}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888]">{c.influencerPlatform}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">{c.createdAt}</span>
                      {cpm7d && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#06b6d4]/10 text-[#06b6d4] font-medium flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />CPM {cpm7d}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.videoUrl && (
                        <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#06b6d4] hover:underline flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3" />视频
                        </a>
                      )}
                      <button onClick={() => deletePost.mutate({ id: c.id })}
                        className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-4 mt-2">
                    <div>
                      <p className="text-[10px] text-[#666]">次日曝光</p>
                      <p className="text-sm font-bold text-white">{formatNumber(c.nextDayExposures || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#666]">7日曝光</p>
                      <p className="text-sm font-bold text-white">{formatNumber(c.sevenDayExposures || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#666]">点赞</p>
                      <p className="text-sm font-bold text-white">{formatNumber(c.likes || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#666]">评论</p>
                      <p className="text-sm font-bold text-white">{formatNumber(c.comments || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#666]">转发</p>
                      <p className="text-sm font-bold text-white">{formatNumber(c.shares || 0)}</p>
                    </div>
                  </div>
                  {c.notes && <p className="text-[10px] text-[#888] mt-2 border-t border-white/[0.04] pt-2">{c.notes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
