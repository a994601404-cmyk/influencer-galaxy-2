import { Link } from "react-router";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [stats, setStats] = useState({ totalImpressions: 0, totalClicks: 0, totalConversions: 0, avgRoi: 0 });
  const [collabCount, setCollabCount] = useState(0);

  useEffect(() => {
    setInfluencers(getInfluencers());
    setCampaigns(getCampaigns());
    setTrending(getTrending());
    setStats(getDashboardStats());
    setCollabCount(getCollaborations().length);
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section - Green Gradient CTA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a2e00] via-[#0f1a00] to-[#0a0a0a] border border-[#ccff00]/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(204,255,0,0.08),transparent_60%)]" />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge-new">AI POWERED</span>
                {isAuthenticated && user?.role === "admin" && (
                  <span className="badge-new bg-[#ccff00] text-black">ADMIN</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
                {isAuthenticated ? `欢迎, ${user?.name || "用户"}` : "PULSEBOOST"}
              </h1>
              <p className="text-sm text-[#8a8a8a]">
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

      {/* KPI Cards - Dense Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: "总曝光量", value: formatNumber(stats.totalImpressions), icon: Eye },
          { title: "总点击数", value: formatNumber(stats.totalClicks), icon: MousePointer },
          { title: "总转化", value: formatNumber(stats.totalConversions), icon: ShoppingCart },
          { title: "平均 ROI", value: stats.avgRoi.toFixed(2) + "x", icon: TrendingUp },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="card-surface p-4 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-4 h-4 text-[#ccff00]" />
              </div>
              <p className="text-xl font-black text-white tracking-tight">{kpi.value}</p>
              <p className="text-[11px] text-[#666]">{kpi.title}</p>
            </div>
          );
        })}
      </div>

      {/* Middle: Trending + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trending Topics */}
        <div className="lg:col-span-2 card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#ccff00]" />
              <h2 className="section-title">实时热点</h2>
            </div>
            <Link to="/script-generator" className="text-xs text-[#ccff00] hover:underline flex items-center gap-0.5">
              立即创作 <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {trending.slice(0, 10).map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] text-[#ccc] hover:bg-[#ccff00]/10 hover:text-[#ccff00] transition-colors cursor-pointer border border-white/[0.04]"
              >
                <Zap className="w-3 h-3" />
                {topic.topic}
              </span>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.04] flex gap-4 text-[10px] text-[#555]">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ccff00]" />美妆 {trending.filter(t => t.category === "beauty").length}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" />美食 {trending.filter(t => t.category === "food").length}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />时尚 {trending.filter(t => t.category === "fashion").length}</span>
          </div>
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
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all group cursor-pointer border border-transparent hover:border-white/[0.06]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color + "15" }}>
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[10px] text-[#666]">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-white transition-colors" />
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
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    c.status === "active" ? "bg-[#ccff00]" : c.status === "completed" ? "bg-[#666]" : "bg-[#f59e0b]"
                  }`} />
                  <div>
                    <p className="text-xs font-medium text-white">{c.name}</p>
                    <p className="text-[10px] text-[#666]">预算 ${formatNumber(c.budget)} · ROI {c.roi.toFixed(2)}x</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  c.status === "active" ? "bg-[#ccff00]/15 text-[#ccff00]" :
                  c.status === "completed" ? "bg-white/[0.04] text-[#888]" :
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
            <Link to="/influencers" className="text-xs text-[#ccff00] hover:underline">查看全部</Link>
          </div>
          <div className="space-y-2">
            {[...influencers].sort((a, b) => b.followers - a.followers).slice(0, 5).map((inf) => (
              <Link key={inf.id} to="/influencers" className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                <img src={inf.avatar} alt={inf.name} className="w-9 h-9 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{inf.name}</p>
                  <p className="text-[10px] text-[#666]">{inf.handle} · {formatNumber(inf.followers)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#ccff00]">{inf.engagementRate.toFixed(2)}%</p>
                  <p className="text-[10px] text-[#666]">互动率</p>
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
              <p className="text-lg font-black text-white">{item.value}</p>
              <p className="text-[11px] text-[#666]">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
