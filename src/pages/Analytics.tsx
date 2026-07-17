import { useState, useMemo } from "react";
import {
  getInfluencers,
  getCollaborationsByInfluencer,
  getAllCollaborations,
  type CollaborationRecord,
} from "@/lib/data-store";
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
  Filter,
} from "lucide-react";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

interface CollabWithInf extends CollaborationRecord {
  influencerName: string;
  influencerHandle: string;
  influencerAvatar: string;
  influencerPlatform: string;
}

export default function Analytics() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "exposures" | "likes" | "engagement">("date");

  const influencers = getInfluencers();
  const infMap = useMemo(() => {
    const map = new Map<number, { name: string; handle: string; avatar: string; platform: string }>();
    influencers.forEach((inf) => {
      map.set(inf.id, { name: inf.name, handle: inf.handle, avatar: inf.avatar, platform: inf.platform });
    });
    return map;
  }, [influencers]);

  // Build collaboration list with influencer info
  const allCollabs: CollabWithInf[] = useMemo(() => {
    const raw = getAllCollaborations();
    return raw
      .map((c) => {
        const inf = infMap.get(c.influencerId);
        return {
          ...c,
          influencerName: inf?.name || "未知网红",
          influencerHandle: inf?.handle || "",
          influencerAvatar: inf?.avatar || "",
          influencerPlatform: inf?.platform || "",
        };
      })
      .filter((c) => c.influencerName !== "未知网红");
  }, [infMap]);

  // Stats
  const stats = useMemo(() => {
    return {
      totalCollabs: allCollabs.length,
      totalExposures: allCollabs.reduce((s, c) => s + c.exposures, 0),
      totalLikes: allCollabs.reduce((s, c) => s + c.likes, 0),
      totalComments: allCollabs.reduce((s, c) => s + c.comments, 0),
      totalShares: allCollabs.reduce((s, c) => s + c.shares, 0),
      avgEngagement: allCollabs.length > 0
        ? allCollabs.reduce((s, c) => s + (c.likes + c.comments + c.shares) / Math.max(c.exposures, 1), 0) / allCollabs.length * 100
        : 0,
    };
  }, [allCollabs]);

  // Per-influencer summary
  const influencerSummaries = useMemo(() => {
    const map = new Map<number, { inf: any; collabs: number; exposures: number; likes: number; comments: number; shares: number }>();
    allCollabs.forEach((c) => {
      const existing = map.get(c.influencerId);
      const inf = infMap.get(c.influencerId);
      if (!inf) return;
      if (existing) {
        existing.collabs++;
        existing.exposures += c.exposures;
        existing.likes += c.likes;
        existing.comments += c.comments;
        existing.shares += c.shares;
      } else {
        map.set(c.influencerId, { inf, collabs: 1, exposures: c.exposures, likes: c.likes, comments: c.comments, shares: c.shares });
      }
    });
    return [...map.values()].sort((a, b) => b.exposures - a.exposures);
  }, [allCollabs, infMap]);

  // Filter & sort
  const filteredCollabs = useMemo(() => {
    let result = [...allCollabs];
    if (platformFilter !== "all") {
      result = result.filter((c) => c.influencerPlatform === platformFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((c) =>
        c.influencerName.toLowerCase().includes(s) ||
        c.influencerHandle.toLowerCase().includes(s) ||
        c.notes.toLowerCase().includes(s)
      );
    }
    switch (sortBy) {
      case "date": result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case "exposures": result.sort((a, b) => b.exposures - a.exposures); break;
      case "likes": result.sort((a, b) => b.likes - a.likes); break;
      case "engagement": result.sort((a, b) => ((b.likes + b.comments + b.shares) / Math.max(b.exposures, 1)) - ((a.likes + a.comments + a.shares) / Math.max(a.exposures, 1))); break;
    }
    return result;
  }, [allCollabs, platformFilter, search, sortBy]);

  const platformOptions = useMemo(() => [...new Set(influencers.map((i) => i.platform))], [influencers]);

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
          { label: "合作次数", value: stats.totalCollabs, icon: Handshake, color: "#ccff00" },
          { label: "总曝光", value: formatNumber(stats.totalExposures), icon: Eye, color: "#06b6d4" },
          { label: "总点赞", value: formatNumber(stats.totalLikes), icon: Heart, color: "#ef4444" },
          { label: "总评论", value: formatNumber(stats.totalComments), icon: MessageCircle, color: "#f59e0b" },
          { label: "总转发", value: formatNumber(stats.totalShares), icon: TrendingUp, color: "#10b981" },
          { label: "平均互动率", value: stats.avgEngagement.toFixed(2) + "%", icon: BarChart3, color: "#8b5cf6" },
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
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#ccff00]" />网红合作汇总</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {influencerSummaries.map((s) => (
              <div key={s.inf.id} className="p-3 rounded-xl bg-white/[0.02] flex items-center gap-3">
                <img src={s.inf.avatar} alt={s.inf.name} className="w-10 h-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{s.inf.name}</p>
                  <p className="text-[10px] text-[#666]">{s.collabs} 次合作 · {formatNumber(s.exposures)} 曝光</p>
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
            {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
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

      {/* Collab List */}
      <div className="space-y-2">
        {filteredCollabs.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <Handshake className="w-10 h-10 text-[#444] mx-auto mb-3" />
            <p className="text-sm text-[#666]">暂无合作数据</p>
            <p className="text-[10px] text-[#555] mt-1">在网红页面点击卡片，记录合作数据</p>
          </div>
        ) : (
          filteredCollabs.map((c) => (
            <div key={c.id} className="card-surface p-4 flex items-start gap-4">
              <img src={c.influencerAvatar} alt={c.influencerName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{c.influencerName}</span>
                    <span className="text-[10px] text-[#666]">{c.influencerHandle}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888]">{c.influencerPlatform}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">{c.date}</span>
                  </div>
                  {c.videoUrl && (
                    <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-[#06b6d4] hover:underline flex items-center gap-0.5 flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />视频
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 mt-2">
                  <div>
                    <p className="text-[10px] text-[#666]">曝光</p>
                    <p className="text-sm font-bold text-white">{formatNumber(c.exposures)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#666]">点赞</p>
                    <p className="text-sm font-bold text-white">{formatNumber(c.likes)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#666]">评论</p>
                    <p className="text-sm font-bold text-white">{formatNumber(c.comments)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#666]">转发</p>
                    <p className="text-sm font-bold text-white">{formatNumber(c.shares)}</p>
                  </div>
                </div>
                {c.notes && <p className="text-[10px] text-[#888] mt-2 border-t border-white/[0.04] pt-2">{c.notes}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
