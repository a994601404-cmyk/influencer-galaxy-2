import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { KeyRound, ShieldCheck, Eye, EyeOff, Copy, Check, RefreshCw, Lock } from "lucide-react";

// Unambiguous charset for generated passwords
function generatePassword(len = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#%";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function Message({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 ${
        type === "success"
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      {text}
    </div>
  );
}

// ─── Change my own password (all logged-in users) ─────────────
export function ChangePasswordCard() {
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const changePassword = trpc.auth.changePassword.useMutation();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!me) return null;
  const hasPassword = !!(me as any).hasPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 8) {
      setMsg({ type: "error", text: "新密码至少 8 位" });
      return;
    }
    if (newPassword !== confirm) {
      setMsg({ type: "error", text: "两次输入的新密码不一致" });
      return;
    }
    try {
      await changePassword.mutateAsync({
        oldPassword: hasPassword ? oldPassword : undefined,
        newPassword,
      });
      setMsg({ type: "success", text: hasPassword ? "密码已修改" : "密码已设置，现在可以使用邮箱 + 密码登录了" });
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "修改失败" });
    }
  };

  return (
    <div className="mb-6 rounded-xl bg-[#111] border border-white/[0.05] p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 flex items-center justify-center">
          <Lock className="w-4 h-4 text-[#ccff00]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">修改密码</h3>
          <p className="text-[10px] text-[#666]">
            {hasPassword
              ? `当前账号：${me.email || me.name || "未知"}`
              : "当前账号通过 Kimi 登录，设置密码后也可以用邮箱 + 密码登录"}
          </p>
        </div>
      </div>

      {msg && <div className="mb-3"><Message type={msg.type} text={msg.text} /></div>}

      <form onSubmit={submit} className="space-y-2">
        {hasPassword && (
          <input
            type={show ? "text" : "password"}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="当前密码"
            className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
          />
        )}
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="确认新密码"
          className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ccff00]/30 transition-colors"
        />
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="btn-lime px-4 py-2 text-xs disabled:opacity-50"
        >
          {changePassword.isPending ? "提交中..." : hasPassword ? "修改密码" : "设置密码"}
        </button>
      </form>
    </div>
  );
}

// ─── Admin: reset any user's password ─────────────────────────
export function AdminResetPasswordCard() {
  const { isAdmin } = useAuth();
  const { data: usersList, refetch } = trpc.auth.list.useQuery(undefined, { enabled: isAdmin });
  const resetMutation = trpc.auth.adminResetPassword.useMutation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isAdmin) return null;

  const startEdit = (id: number) => {
    setEditingId(id);
    setPw(generatePassword());
    setShow(true);
    setCopied(false);
    setMsg(null);
  };

  const submit = async (userId: number) => {
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ type: "error", text: "密码至少 8 位" });
      return;
    }
    try {
      await resetMutation.mutateAsync({ userId, newPassword: pw });
      setMsg({ type: "success", text: "已重置。请复制新密码并通过站外渠道告知用户。" });
      refetch();
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "重置失败" });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="mb-6 rounded-xl bg-[#111] border border-white/[0.05] p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-[#ccff00]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">用户密码重置</h3>
          <p className="text-[10px] text-[#666]">
            处理找回密码请求：为用户生成新密码并线下告知（用户会收到站内通知）
          </p>
        </div>
      </div>

      {msg && <div className="mb-3"><Message type={msg.type} text={msg.text} /></div>}

      <div className="space-y-2">
        {(usersList || []).map((u) => (
          <div
            key={u.id}
            className="rounded-xl bg-[#0a0a0a] border border-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {u.name || "未命名"}
                  {u.role === "admin" && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-[#ccff00]/10 text-[#ccff00]">管理员</span>
                  )}
                  {!(u as any).hasPassword && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-[#666]">Kimi 登录</span>
                  )}
                </p>
                <p className="text-[10px] text-[#555] truncate">{u.email || u.unionId}</p>
              </div>
              {editingId !== u.id && (
                <button
                  onClick={() => startEdit(u.id)}
                  className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-[#999] hover:text-white hover:bg-white/[0.08] flex items-center gap-1 transition-colors"
                >
                  <KeyRound className="w-3 h-3" />
                  重置密码
                </button>
              )}
            </div>

            {editingId === u.id && (
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={show ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full bg-[#111] border border-[#ccff00]/20 rounded-lg px-2.5 py-2 pr-14 text-xs text-white font-mono focus:outline-none focus:border-[#ccff00]/50"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="p-1 text-[#555] hover:text-white"
                    >
                      {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPw(generatePassword())}
                      className="p-1 text-[#555] hover:text-[#ccff00]"
                      title="重新生成"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={copy}
                      className="p-1 text-[#555] hover:text-[#ccff00]"
                      title="复制"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => submit(u.id)}
                  disabled={resetMutation.isPending}
                  className="shrink-0 btn-lime px-3 py-2 text-[11px] disabled:opacity-50"
                >
                  {resetMutation.isPending ? "..." : "确认重置"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="shrink-0 text-[11px] px-2 py-2 text-[#666] hover:text-white"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        ))}
        {usersList && usersList.length === 0 && (
          <p className="text-[11px] text-[#555] text-center py-3">暂无注册用户</p>
        )}
      </div>
    </div>
  );
}
