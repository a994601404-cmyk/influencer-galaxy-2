import { useState, useEffect } from "react";
import { registerLocal, loginLocal, seedAdminAccount } from "@/lib/local-auth";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Zap, X, Mail, Lock, User, Eye, EyeOff, Ticket } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultMode?: "login" | "register";
}

export default function AuthModal({ open, onClose, onSuccess, defaultMode = "login" }: Props) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();

  // tRPC mutations for invitation code
  const validateCode = trpc.invitation.validate.useMutation();
  const useCode = trpc.invitation.use.useMutation();

  // Reset mode when modal opens with a different defaultMode
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError("");
    }
  }, [open, defaultMode]);

  if (!open) return null;

  seedAdminAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "register") {
      if (!name || !email || !password) { setError("请填写所有字段"); setLoading(false); return; }
      if (password.length < 6) { setError("密码至少6位"); setLoading(false); return; }

      // Validate invitation code
      if (!invitationCode || invitationCode.trim().length !== 6) {
        setError("请输入6位邀请码");
        setLoading(false);
        return;
      }

      // Check invitation code via backend
      try {
        const validation = await validateCode.mutateAsync({ code: invitationCode.trim().toUpperCase() });
        if (!validation.valid) {
          setError(validation.message || "邀请码无效");
          setLoading(false);
          return;
        }
      } catch (e: any) {
        setError("邀请码验证失败，请稍后重试");
        setLoading(false);
        return;
      }

      // Proceed with registration
      const result = registerLocal({ name, email, password, invitationCode: invitationCode.trim().toUpperCase() });
      if (!result.success) { setError(result.error || "注册失败"); setLoading(false); return; }

      // Mark invitation code as used
      try {
        const unionId = `local_${email}`;
        await useCode.mutateAsync({
          code: invitationCode.trim().toUpperCase(),
          unionId,
        });
      } catch {
        // If marking as used fails, still allow login but log the error
        console.error("Failed to mark invitation code as used");
      }
    } else {
      if (!email || !password) { setError("请填写邮箱和密码"); setLoading(false); return; }
      const result = loginLocal({ email, password });
      if (!result.success) { setError(result.error || "登录失败"); setLoading(false); return; }
    }

    // Force refresh auth state BEFORE calling onSuccess
    // This ensures useAuth reads the newly written localStorage data
    refresh();
    setLoading(false);
    onSuccess();
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setInvitationCode("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[420px] mx-4 bg-[#141414] border border-white/[0.06] rounded-3xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-[#666] hover:text-white hover:bg-white/[0.1] transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#ccff00] flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-white text-center tracking-tight">
            {mode === "login" ? "登录到 InfluencerGalaxy" : "加入 InfluencerGalaxy"}
          </h2>
          <p className="text-xs text-[#666] text-center mt-1 mb-6">
            {mode === "login" ? "输入账号继续创作" : "注册并免费开始使用"}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="姓名"
                    className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
                  />
                </div>

                {/* Invitation Code */}
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ccff00]" />
                  <input
                    type="text"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    placeholder="邀请码 (6位)"
                    maxLength={6}
                    className="w-full bg-[#0a0a0a] border border-[#ccff00]/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#ccff00]/40 focus:outline-none focus:border-[#ccff00]/50 transition-colors font-mono tracking-widest"
                  />
                </div>
                <p className="text-[10px] text-[#666] px-1">
                  没有邀请码？<span className="text-[#ccff00]">请联系管理员获取邀请码</span>
                </p>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-lime flex items-center justify-center gap-2 py-3 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {mode === "login" ? "登录中..." : "注册中..."}
                </span>
              ) : (
                mode === "login" ? "登录" : "注册"
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 text-center">
            <button
              onClick={toggleMode}
              className="text-xs text-[#666] hover:text-[#ccff00] transition-colors"
            >
              {mode === "login" ? "还没有账号？注册" : "已有账号？登录"}
            </button>
          </div>

          {/* Terms */}
          <p className="text-[9px] text-[#444] text-center mt-4 leading-relaxed">
            继续使用即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
}
