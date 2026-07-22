import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useUserList } from "@/lib/influencer-api";
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
  Download,
} from "lucide-react";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default function Analytics() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "exposures" | "likes" | "engagement">("date");

  // Fetch data from backend
  const { data: allPosts = [] } = trpc.post.listAll.useQuery();
  const { data: listData } = trpc.influencer.list.useQuery();
  const { data: allUsers } = useUserList();
  const influencers = (listData?.items ?? []).filter(
    (item: any) => item != null && item.id != null
  );

  // unionId → 用户名
  const creatorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (allUsers || []).forEach((u: any) => {
      if (u?.unionId) map.set(u.unionId, u.name || u.email || `用户#${u.id}`);
    });
    return map;
  }, [allUsers]);
  const utils = trpc.useUtils();
  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => {
      utils.post.listAll.invalidate();
      utils.post.list.invalidate();
    },
  });

  // Build influencer map
  const infMap = useMemo(() => {
    const map = new Map<number, { name: string; handle: string; avatar: string; platform: string; adminPrice: number; createdByUnionId: string }>();
    influencers.forEach((inf: any) => {
      map.set(inf.id, { name: inf.name, handle: inf.handle, avatar: inf.avatar || "", platform: inf.platform, adminPrice: inf.adminPrice || 0, createdByUnionId: inf.createdByUnionId || "" });
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
          createdByUnionId: inf?.createdByUnionId || "",
          creatorName: inf?.createdByUnionId ? (creatorNameMap.get(inf.createdByUnionId) || inf.createdByUnionId) : "",
        };
      })
      .filter((c: any) => c.influencerName !== "未知网红");
  }, [allPosts, infMap, creatorNameMap]);

  // 管理员按创建者筛选的选项
  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    allCollabs.forEach((c: any) => {
      if (c.createdByUnionId) map.set(c.createdByUnionId, c.creatorName || c.createdByUnionId);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allCollabs]);

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
    if (isAdmin && creatorFilter !== "all") {
      result = result.filter((c: any) => c.createdByUnionId === creatorFilter);
    }
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
  }, [allCollabs, platformFilter, search, sortBy, creatorFilter, isAdmin]);

  // 导出当前筛选结果为 Excel（SpreadsheetML .xls，Excel/WPS 直接打开）
  const exportExcel = () => {
    const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const headers = ["网红名称", "账号", "平台", "创建者", "合作价格($)", "次日曝光", "7日曝光", "点赞", "评论", "转发", "CPM($)", "备注", "发布日期"];
    const rows = filteredCollabs.map((c: any) => {
      const cpm = c.adminPrice > 0 && (c.sevenDayExposures || 0) > 0 ? ((c.adminPrice / c.sevenDayExposures) * 1000).toFixed(2) : "";
      return [c.influencerName, c.influencerHandle, c.influencerPlatform, c.creatorName, c.adminPrice > 0 ? c.adminPrice : "", c.nextDayExposures || 0, c.sevenDayExposures || 0, c.likes || 0, c.comments || 0, c.shares || 0, cpm, c.notes || "", c.createdAt || ""];
    });
    const cell = (v: any) => {
      const isNum = typeof v === "number";
      return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${esc(v)}</Data></Cell>`;
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="发布数据"><Table>
<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("")}</Row>
${rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("\n")}
</Table></Worksheet></Workbook>`;
    const blob = new Blob(["﻿" + xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `发布数据_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const platformOptions = useMemo(() => [...new Set(influencers.map((i: any) => i.platform))], [influencers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-brand" />
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
              <p className="text-lg font-black text-content">{s.value}</p>
              <p className="text-[10px] text-faint">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Influencer Summaries */}
      {influencerSummaries.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="text-sm font-bold text-content mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-brand" />网红发布汇总</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {influencerSummaries.map((s: any) => (
              <div key={s.inf.id} className="p-3 rounded-xl bg-hover flex items-center gap-3">
                <img src={s.inf.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.inf.handle}`} alt={s.inf.name} className="w-10 h-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-content truncate">{s.inf.name}</p>
                  <p className="text-[10px] text-faint">{s.posts} 次发布 · {formatNumber(s.sevenDayExp)} 7日曝光</p>
                  <div className="flex gap-2 mt-1 text-[9px] text-sub">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input type="text" placeholder="搜索网红或备注..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-base border border-line rounded-xl pl-10 pr-4 py-2.5 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30" />
          </div>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-base border border-line rounded-xl px-3 py-2.5 text-sm text-content focus:outline-none focus:border-brand/30">
            <option value="all">全部平台</option>
            {platformOptions.map((p: string) => <option key={p} value={p}>{p}</option>)}
          </select>
          {isAdmin && (
            <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)}
              className="bg-base border border-line rounded-xl px-3 py-2.5 text-sm text-content focus:outline-none focus:border-brand/30">
              <option value="all">全部用户</option>
              {creatorOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-base border border-line rounded-xl px-3 py-2.5 text-sm text-content focus:outline-none focus:border-brand/30">
            <option value="date">按日期</option>
            <option value="exposures">按曝光</option>
            <option value="likes">按点赞</option>
            <option value="engagement">按互动率</option>
          </select>
          <button
            onClick={exportExcel}
            disabled={filteredCollabs.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-lime text-black text-sm font-semibold hover:bg-lime transition-all disabled:opacity-40"
            title="导出当前筛选结果为 Excel"
          >
            <Download className="w-4 h-4" />导出 Excel
          </button>
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-2">
        {filteredCollabs.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <Handshake className="w-10 h-10 text-faint mx-auto mb-3" />
            <p className="text-sm text-faint">暂无发布数据</p>
            <p className="text-[10px] text-faint mt-1">在网红页面点击卡片，记录发布数据</p>
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
                      <span className="text-sm font-bold text-content">{c.influencerName}</span>
                      <span className="text-[10px] text-faint">{c.influencerHandle}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-hover text-sub">{c.influencerPlatform}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">{c.createdAt}</span>
                      {cpm7d && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-cy/10 text-cy font-medium flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />CPM {cpm7d}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.videoUrl && (
                        <a href={c.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-cy hover:underline flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3" />视频
                        </a>
                      )}
                      <button onClick={() => deletePost.mutate({ id: c.id })}
                        className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mt-2">
                    <div>
                      <p className="text-[10px] text-faint">合作价格</p>
                      <p className="text-sm font-bold text-cy">{c.adminPrice > 0 ? `$${c.adminPrice.toLocaleString()}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint">次日曝光</p>
                      <p className="text-sm font-bold text-content">{formatNumber(c.nextDayExposures || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint">7日曝光</p>
                      <p className="text-sm font-bold text-content">{formatNumber(c.sevenDayExposures || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint">点赞</p>
                      <p className="text-sm font-bold text-content">{formatNumber(c.likes || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint">评论</p>
                      <p className="text-sm font-bold text-content">{formatNumber(c.comments || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint">转发</p>
                      <p className="text-sm font-bold text-content">{formatNumber(c.shares || 0)}</p>
                    </div>
                  </div>
                  {c.notes && <p className="text-[10px] text-sub mt-2 border-t border-line pt-2">{c.notes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
