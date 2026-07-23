import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/theme";
import { trpc } from "@/providers/trpc";
import { ErrorBoundary } from "./ErrorBoundary";
import AuthModal from "./AuthModal";
import NotificationBell from "./NotificationBell";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  LogOut,
  Zap,
  Menu,
  X,
  Shield,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";

const navItems = [
  { path: "/", label: "工作台", icon: LayoutDashboard },
  { path: "/influencers", label: "网红", icon: Users },
  { path: "/analytics", label: "数据", icon: BarChart3 },
];

const reviewNavItem = { path: "/review", label: "审核", icon: ShieldCheck };

const adminNavItem = { path: "/settings", label: "设置", icon: SettingsIcon };

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/landing", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // 登录后后台预取各页面核心数据，配合 staleTime 60s，
  // 切换页面时直接使用缓存，避免每次都等 serverless 冷启动
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!isAuthenticated) return;
    utils.influencer.list.prefetch();
    utils.cardCategory.list.prefetch();
    utils.cardCategory.statusCounts.prefetch();
    utils.negotiation.listAll.prefetch();
    utils.scriptReview.listAll.prefetch();
    utils.videoReview.listAll.prefetch();
    utils.post.listAll.prefetch();
  }, [isAuthenticated, utils]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthMode("register"); setAuthOpen(true); };

  // Show loading while checking auth status (prevents flash of content)
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-content">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-base/80 backdrop-blur-xl border-b border-line">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo-galaxy.png" alt="InfluencerGalaxy" className="w-7 h-7 object-contain" />
                <span className="text-content font-bold text-sm tracking-tight">InfluencerGalaxy</span>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-0.5">
                <Link to="/" className={`nav-item ${location.pathname === "/" ? "active" : ""}`}>
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">工作台</span>
                </Link>
                {isAdmin && (
                  <Link to="/review" className={`nav-item ${location.pathname === "/review" ? "active" : ""}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">审核</span>
                  </Link>
                )}
                <Link to="/influencers" className={`nav-item ${location.pathname === "/influencers" ? "active" : ""}`}>
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">网红</span>
                </Link>
                <Link to="/analytics" className={`nav-item ${location.pathname === "/analytics" ? "active" : ""}`}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">数据</span>
                </Link>
                <Link
                  to="/settings"
                  className={`nav-item ${location.pathname === "/settings" ? "active" : ""}`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">设置</span>
                </Link>
              </nav>
            </div>

            {/* Right: Auth */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sub hover:text-content hover:bg-hover transition-all"
                title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-lime/10 text-brand font-bold">
                      <Shield className="w-3 h-3" />管理员
                    </span>
                  )}
                  <NotificationBell />
                  <div className="flex items-center gap-2 mr-1">
                    <img src={user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=user"} alt="" className="w-7 h-7 rounded-full object-cover border border-line" />
                    <span className="hidden sm:block text-xs text-sub">{user.name || "User"}</span>
                  </div>
                  <button onClick={logout} className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-faint hover:text-red-400 hover:bg-hover transition-all">
                    <LogOut className="w-3.5 h-3.5" />退出
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={openLogin} className="hidden md:block text-xs text-sub hover:text-content transition-colors px-3 py-1.5">登录</button>
                  <button onClick={openRegister} className="btn-lime text-xs flex items-center gap-1">注册</button>
                </div>
              )}

              {/* Mobile toggle */}
              <button className="md:hidden p-2 text-faint hover:text-content" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-line bg-base/95 backdrop-blur-xl">
            <nav className="px-4 py-2 space-y-0.5">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/" ? "text-brand bg-lime/10 font-medium" : "text-faint hover:text-content hover:bg-hover"}`}>
                <LayoutDashboard className="w-4 h-4" />工作台
              </Link>
              {isAdmin && (
                <Link to="/review" onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/review" ? "text-brand bg-lime/10 font-medium" : "text-faint hover:text-content hover:bg-hover"}`}>
                  <ShieldCheck className="w-4 h-4" />审核
                </Link>
              )}
              <Link to="/influencers" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/influencers" ? "text-brand bg-lime/10 font-medium" : "text-faint hover:text-content hover:bg-hover"}`}>
                <Users className="w-4 h-4" />网红
              </Link>
              <Link to="/analytics" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/analytics" ? "text-brand bg-lime/10 font-medium" : "text-faint hover:text-content hover:bg-hover"}`}>
                <BarChart3 className="w-4 h-4" />数据
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  location.pathname === "/settings"
                    ? "text-brand bg-lime/10 font-medium"
                    : "text-faint hover:text-content hover:bg-hover"
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                设置
              </Link>
              {isAuthenticated ? (
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-faint hover:text-red-400 w-full">
                  <LogOut className="w-4 h-4" />退出
                </button>
              ) : (
                <>
                  <button onClick={() => { openLogin(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-brand w-full">
                    登录
                  </button>
                  <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-brand w-full">
                    注册
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <ErrorBoundary name="Outlet">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); window.location.reload(); }} defaultMode={authMode} />
    </div>
  );
}
