import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Zap, X, Mail, Lock, User, Eye, EyeOff, Ticket, KeyRound, ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultMode?: "login" | "register";
}

type Mode = "login" | "register" | "forgot";

export default function AuthModal({ open, onClose, onSuccess, defaultMode = "login" }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  // Forgot-password: master-key self reset
  const [useMasterKey, setUseMasterKey] = useState(false);
  const [masterKey, setMasterKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { refresh } = useAuth();

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const forgotMutation = trpc.auth.forgotPassword.useMutation();
  const resetMutation = trpc.auth.resetWithMasterKey.useMutation();

  // Reset mode when modal opens with a different defaultMode
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError("");
      setNotice("");
    }
  }, [open, defaultMode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (!name || !email || !password) { setError("请填写所有字段"); setLoading(false); return; }
        if (password.length < 8) { setError("密码至少 8 位"); setLoading(false); return; }
        if (!invitationCode || invitationCode.trim().length !== 6) {
          setError("请输入 6 位邀请码");
          setLoading(false);
          return;
        }
        await registerMutation.mutateAsync({
          name: name.trim(),
          email: email.trim(),
          password,
          invitationCode: invitationCode.trim().toUpperCase(),
        });
      } else if (mode === "login") {
        if (!email || !password) { setError("请填写邮箱和密码"); setLoading(false); return; }
        await loginMutation.mutateAsync({ email: email.trim(), password });
      } else {
        // forgot
        if (!email) { setError("请填写邮箱"); setLoading(false); return; }
        if (useMasterKey) {
          if (!masterKey || !newPassword) { setError("请输入恢复密钥和新密码"); setLoading(false); return; }
          if (newPassword.length < 8) { setError("新密码至少 8 位"); setLoading(false); return; }
          await resetMutation.mutateAsync({
            email: email.trim(),
            masterKey: masterKey.trim(),
            newPassword,
          });
          setNotice("密码已重置，请使用新密码登录");
          setMode("login");
          setPassword("");
          setMasterKey("");
          setNewPassword("");
          setLoading(false);
          return;
        } else {
          const res = await forgotMutation.mutateAsync({ email: email.trim() });
          setNotice(res.message || "如果该邮箱已注册，管理员会收到重置请求。");
          setLoading(false);
          return;
        }
      }

      // login / register succeeded — refresh server session state
      refresh();
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "操作失败，请稍后重试");
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
    setInvitationCode("");
  };

  const titles: Record<Mode, string> = {
    login: "登录到 InfluencerGalaxy",
    register: "加入 InfluencerGalaxy",
    forgot: "找回密码",
  };
  const subtitles: Record<Mode, string> = {
    login: "输入账号继续创作",
    register: "注册并免费开始使用",
    forgot: "通过管理员或恢复密钥重置密码",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[420px] mx-4 bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-hover flex items-center justify-center text-faint hover:text-content hover:bg-hover transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-lime flex items-center justify-center">
              <Zap className="w-6 h-6 text-black" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-content text-center tracking-tight">
            {titles[mode]}
          </h2>
          <p className="text-xs text-faint text-center mt-1 mb-6">
            {subtitles[mode]}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* Notice */}
          {notice && (
            <div className="mb-4 p-3 rounded-xl bg-lime/10 border border-brand/20 text-brand text-xs text-center">
              {notice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="姓名"
                    className="w-full bg-base border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
                  />
                </div>

                {/* Invitation Code */}
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand" />
                  <input
                    type="text"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    placeholder="邀请码 (6位)"
                    maxLength={6}
                    className="w-full bg-base border border-brand/20 rounded-xl pl-10 pr-4 py-3 text-sm text-content placeholder:text-brand/40 focus:outline-none focus:border-brand/50 transition-colors font-mono tracking-widest"
                  />
                </div>
                <p className="text-[10px] text-faint px-1">
                  没有邀请码？<span className="text-brand">请联系管理员获取邀请码</span>
                </p>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                className="w-full bg-base border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
              />
            </div>

            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "密码（至少 8 位）" : "密码"}
                  className="w-full bg-base border border-line rounded-xl pl-10 pr-10 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-content"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {mode === "forgot" && (
              <>
                {/* Master-key self reset toggle */}
                <button
                  type="button"
                  onClick={() => setUseMasterKey(!useMasterKey)}
                  className="flex items-center gap-2 text-[11px] text-faint hover:text-brand transition-colors px-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {useMasterKey ? "使用管理员协助重置" : "我有恢复密钥（管理员）"}
                </button>

                {useMasterKey && (
                  <>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand" />
                      <input
                        type="text"
                        value={masterKey}
                        onChange={(e) => setMasterKey(e.target.value)}
                        placeholder="恢复密钥（由站点所有者保管）"
                        className="w-full bg-base border border-brand/20 rounded-xl pl-10 pr-4 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/50 transition-colors font-mono"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="新密码（至少 8 位）"
                        className="w-full bg-base border border-line rounded-xl pl-10 pr-10 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-content"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-lime flex items-center justify-center gap-2 py-3 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  处理中...
                </span>
              ) : mode === "login" ? (
                "登录"
              ) : mode === "register" ? (
                "注册"
              ) : useMasterKey ? (
                "重置密码"
              ) : (
                "提交重置请求"
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs">
            {mode === "login" && (
              <>
                <button
                  onClick={() => switchMode("forgot")}
                  className="text-faint hover:text-brand transition-colors"
                >
                  忘记密码？
                </button>
                <span className="text-faint">·</span>
                <button
                  onClick={() => switchMode("register")}
                  className="text-faint hover:text-brand transition-colors"
                >
                  还没有账号？注册
                </button>
              </>
            )}
            {mode === "register" && (
              <button
                onClick={() => switchMode("login")}
                className="text-faint hover:text-brand transition-colors"
              >
                已有账号？登录
              </button>
            )}
            {mode === "forgot" && (
              <button
                onClick={() => switchMode("login")}
                className="flex items-center gap-1 text-faint hover:text-brand transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回登录
              </button>
            )}
          </div>

          {/* Terms */}
          <p className="text-[9px] text-faint text-center mt-4 leading-relaxed">
            继续使用即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
}
