import { Link } from "react-router";
import { useState, useEffect, useMemo } from "react";
import {
  getInfluencers,
  getCampaigns,
  getTrending,
  getDashboardStats,
  getCollaborations,
  type Influencer,
  type Campaign,
  type TrendingTopic,
} from "@/lib/data-store";
import {
  TrendingUp,
  Users,
  Eye,
  MousePointer,
  ShoppingCart,
  ArrowUpRight,
  Flame,
  Zap,
  BarChart3,
  ChevronRight,
  Settings,
  Handshake,
  Heart,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import TopicTracker from "@/components/TopicTracker";

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export default function Dashboard() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [stats, setStats] = useState({ totalImpressions: 0, totalClicks: 0, totalConversions: 0, avgRoi: 0 });
  const [collabCount, setCollabCount] = useState(0);

  // Fetch post records + visible influencers (server-isolated: 普通用户只有自己的网红)
  const { data: allPostsRaw = [] } = trpc.post.listAll.useQuery();
  const { data: listData } = trpc.influencer.list.useQuery();
  const { data: statusCounts } = trpc.cardCategory.statusCounts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 与数据页一致的隔离逻辑：只统计当前用户可见网红的发布数据
  const allPosts = useMemo(() => {
    if (!listData) return [];
    const ids = new Set<number>(
      (listData?.items ?? []).filter((i: any) => i?.id != null).map((i: any) => i.id)
    );
    return (allPostsRaw as any[]).filter((p) => p && ids.has(p.influencerId));
  }, [allPostsRaw, listData]);

  useEffect(() => {
    setInfluencers(getInfluencers());
    setCampaigns(getCampaigns());
    setTrending(getTrending());
    setStats(getDashboardStats());
    setCollabCount(getCollaborations().length);
  }, []);

  // Calculate post stats
  const postStats = useMemo(() => {
    return {
      totalPosts: allPosts.length,
      totalSevenDayExposures: allPosts.reduce((s: number, p: any) => s + (p.sevenDayExposures || 0), 0),
      totalLikes: allPosts.reduce((s: number, p: any) => s + (p.likes || 0), 0),
      totalComments: allPosts.reduce((s: number, p: any) => s + (p.comments || 0), 0),
      totalShares: allPosts.reduce((s: number, p: any) => s + (p.shares || 0), 0),
    };
  }, [allPosts]);

  return (
    <div className="space-y-8">
      {/* Hero Section - Green Gradient CTA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lime/10 via-lime/5 to-base border border-brand/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(204,255,0,0.08),transparent_60%)]" />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge-new">AI POWERED</span>
                {isAuthenticated && user?.role === "admin" && (
                  <span className="badge-new bg-lime text-black">ADMIN</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-content mb-1">
                {isAuthenticated ? `欢迎, ${user?.name || "用户"}` : "PULSEBOOST"}
              </h1>
              <p className="text-sm text-sub">
                {isAuthenticated ? "继续您的网红营销推广工作" : "AI 驱动的网红营销推广工作台"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/influencers">
                <button className="btn-lime flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />查看网红
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Category Status Counts */}
      {isAuthenticated && statusCounts && (
        <div>
          <h2 className="text-sm font-bold text-content mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />网红卡片分布
            <span className="text-[10px] text-faint font-normal">
              {isAdmin ? "全站统计" : "仅统计你创建的卡片"}
            </span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { name: "审核中", color: "#f59e0b", desc: "等待管理员审核报价" },
              { name: "对接中", color: "#06b6d4", desc: "合作对接进行中" },
              { name: "已发布", color: "#65a30d", desc: "内容已发布上线" },
              { name: "网红库", color: "#8b5cf6", desc: "备用网红资源" },
            ].map((c) => (
              <div key={c.name} className="card-surface p-4 hover-lift">
                <p className="text-xl font-black tracking-tight" style={{ color: c.color }}>
                  {statusCounts[c.name] ?? 0}
                </p>
                <p className="text-[11px] text-content font-semibold mt-0.5">{c.name}</p>
                <p className="text-[10px] text-faint">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards - Dense Grid: Post Stats */}
      <div>
        <h2 className="text-sm font-bold text-content mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand" />发布数据概览
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { title: "发布次数", value: formatNumber(postStats.totalPosts), icon: Handshake, color: "#ccff00" },
            { title: "7日总曝光", value: formatNumber(postStats.totalSevenDayExposures), icon: Eye, color: "#06b6d4" },
            { title: "总点赞", value: formatNumber(postStats.totalLikes), icon: Heart, color: "#ef4444" },
            { title: "总评论", value: formatNumber(postStats.totalComments), icon: MessageCircle, color: "#f59e0b" },
            { title: "总转发", value: formatNumber(postStats.totalShares), icon: TrendingUp, color: "#10b981" },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="card-surface p-4 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <p className="text-xl font-black text-content tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-faint">{kpi.title}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle: Trending + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Topic Tracker */}
        <div className="lg:col-span-2 card-surface p-5">
          <TopicTracker />
        </div>

        {/* Quick Actions */}
        <div className="card-surface p-5">
          <h2 className="section-title mb-4">快速操作</h2>
          <div className="space-y-2">
            {[
              { label: "添加网红", desc: "管理网红资源", icon: Users, color: "#06b6d4", to: "/influencers" },
              { label: "查看数据报告", desc: "推广效果分析", icon: BarChart3, color: "#10b981", to: "/analytics" },
              { label: "系统设置", desc: "配置 API 等", icon: Settings, color: "#ccff00", to: "/settings" },
            ].map((item) => (
              <Link key={item.label} to={item.to}>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-hover hover:bg-hover transition-all group cursor-pointer border border-transparent hover:border-line">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color + "15" }}>
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-content">{item.label}</p>
                    <p className="text-[10px] text-faint">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-faint group-hover:text-content transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Campaigns + Influencers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaigns */}
        <div className="card-surface p-5">
          <h2 className="section-title mb-4">推广计划</h2>
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-hover hover:bg-hover transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    c.status === "active" ? "bg-lime" : c.status === "completed" ? "bg-faint" : "bg-[#f59e0b]"
                  }`} />
                  <div>
                    <p className="text-xs font-medium text-content">{c.name}</p>
                    <p className="text-[10px] text-faint">预算 ${formatNumber(c.budget)} · 曝光 {formatNumber(c.impressions)}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  c.status === "active" ? "bg-lime/15 text-brand" :
                  c.status === "completed" ? "bg-hover text-sub" :
                  "bg-[#f59e0b]/15 text-[#f59e0b]"
                }`}>
                  {c.status === "active" ? "进行中" : c.status === "completed" ? "已完成" : "草稿"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Influencers */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">头部网红</h2>
            <Link to="/influencers" className="text-xs text-brand hover:underline">查看全部</Link>
          </div>
          <div className="space-y-2">
            {[...influencers].sort((a, b) => b.followers - a.followers).slice(0, 5).map((inf) => (
              <Link key={inf.id} to="/influencers" className="flex items-center gap-3 p-2.5 rounded-xl bg-hover hover:bg-hover transition-colors group">
                <img src={inf.avatar} alt={inf.name} className="w-9 h-9 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-content truncate">{inf.name}</p>
                  <p className="text-[10px] text-faint">{inf.handle} · {formatNumber(inf.followers)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-brand">{inf.engagementRate.toFixed(2)}%</p>
                  <p className="text-[10px] text-faint">互动率</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "网红资源", value: influencers.length, icon: Users, color: "#06b6d4" },
          { label: "合作记录", value: collabCount, icon: Handshake, color: "#ccff00" },
          { label: "推广计划", value: campaigns.length, icon: BarChart3, color: "#10b981" },
        ].map((item) => (
          <div key={item.label} className="card-surface p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.color + "15" }}>
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-lg font-black text-content">{item.value}</p>
              <p className="text-[11px] text-faint">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
