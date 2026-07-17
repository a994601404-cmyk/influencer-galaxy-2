import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/landing", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthMode("register"); setAuthOpen(true); };

  // Show loading while checking auth status (prevents flash of content)
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#ccff00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo-galaxy.png" alt="InfluencerGalaxy" className="w-7 h-7 object-contain" />
                <span className="text-white font-bold text-sm tracking-tight">InfluencerGalaxy</span>
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
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#ccff00]/10 text-[#ccff00] font-bold">
                      <Shield className="w-3 h-3" />管理员
                    </span>
                  )}
                  <NotificationBell />
                  <div className="flex items-center gap-2 mr-1">
                    <img src={user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=user"} alt="" className="w-7 h-7 rounded-full object-cover border border-white/[0.08]" />
                    <span className="hidden sm:block text-xs text-[#888]">{user.name || "User"}</span>
                  </div>
                  <button onClick={logout} className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[#666] hover:text-red-400 hover:bg-white/[0.03] transition-all">
                    <LogOut className="w-3.5 h-3.5" />退出
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={openLogin} className="hidden md:block text-xs text-[#888] hover:text-white transition-colors px-3 py-1.5">登录</button>
                  <button onClick={openRegister} className="btn-lime text-xs flex items-center gap-1">注册</button>
                </div>
              )}

              {/* Mobile toggle */}
              <button className="md:hidden p-2 text-[#666] hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.05] bg-[#0a0a0a]/95 backdrop-blur-xl">
            <nav className="px-4 py-2 space-y-0.5">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/" ? "text-[#ccff00] bg-[#ccff00]/10 font-medium" : "text-[#666] hover:text-white hover:bg-white/[0.03]"}`}>
                <LayoutDashboard className="w-4 h-4" />工作台
              </Link>
              {isAdmin && (
                <Link to="/review" onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/review" ? "text-[#ccff00] bg-[#ccff00]/10 font-medium" : "text-[#666] hover:text-white hover:bg-white/[0.03]"}`}>
                  <ShieldCheck className="w-4 h-4" />审核
                </Link>
              )}
              <Link to="/influencers" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/influencers" ? "text-[#ccff00] bg-[#ccff00]/10 font-medium" : "text-[#666] hover:text-white hover:bg-white/[0.03]"}`}>
                <Users className="w-4 h-4" />网红
              </Link>
              <Link to="/analytics" onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/analytics" ? "text-[#ccff00] bg-[#ccff00]/10 font-medium" : "text-[#666] hover:text-white hover:bg-white/[0.03]"}`}>
                <BarChart3 className="w-4 h-4" />数据
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  location.pathname === "/settings"
                    ? "text-[#ccff00] bg-[#ccff00]/10 font-medium"
                    : "text-[#666] hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                设置
              </Link>
              {isAuthenticated ? (
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#666] hover:text-red-400 w-full">
                  <LogOut className="w-4 h-4" />退出
                </button>
              ) : (
                <>
                  <button onClick={() => { openLogin(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#ccff00] w-full">
                    登录
                  </button>
                  <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#ccff00] w-full">
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
