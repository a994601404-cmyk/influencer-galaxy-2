import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isTestMode, setTestMode } from "@/lib/test-mode";
import {
  useApiConfigList,
  useUpsertApiConfig,
  useToggleApiConfig,
  useDeleteApiConfig,
  PLATFORM_META,
  type PlatformMeta,
} from "@/lib/config-service";
import { useApiConfigStatus } from "@/lib/config-service";
import { useCleanupTestData } from "@/lib/influencer-api";
import { ChangePasswordCard, AdminResetPasswordCard } from "@/components/SecuritySettings";
import { trpc } from "@/providers/trpc";
import {
  Settings as SettingsIcon,
  Key,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Trash,
  RotateCcw,
  Ticket,
  Plus,
  Copy,
  Check,
  UserCheck,
} from "lucide-react";

interface EditForm {
  platform: string;
  apiKey: string;
  apiHost: string;
  isActive: boolean;
}

export default function Settings() {
  const { isAdmin } = useAuth();
  const { data: configs, isLoading } = useApiConfigList();
  const { data: status } = useApiConfigStatus();
  const upsert = useUpsertApiConfig();
  const toggle = useToggleApiConfig();
  const deleteConfig = useDeleteApiConfig();
  const cleanupTest = useCleanupTestData();

  const [testModeEnabled, setTestModeEnabled] = useState(() => isTestMode());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState<EditForm>({
    platform: "",
    apiKey: "",
    apiHost: "",
    isActive: true,
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Invitation code state
  const [generateCount, setGenerateCount] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Invitation code tRPC hooks
  const { data: invitationList, refetch: refetchInvitations } = trpc.invitation.list.useQuery(undefined, {
    enabled: isAdmin,
  });
  const generateCodes = trpc.invitation.generate.useMutation({
    onSuccess: () => refetchInvitations(),
  });
  const deleteCode = trpc.invitation.delete.useMutation({
    onSuccess: () => refetchInvitations(),
  });

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleGenerateCodes = async () => {
    try {
      const result = await generateCodes.mutateAsync({ count: generateCount });
      showMessage("success", `成功生成 ${result.codes.length} 个邀请码: ${result.codes.join(", ")}`);
    } catch (e: any) {
      showMessage("error", e.message || "生成失败");
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleEdit = (platform: string) => {
    const cfg = configs?.find((c) => c.platform === platform);
    setEditForm({
      platform,
      apiKey: cfg?.apiKey || "",
      apiHost: cfg?.apiHost || "",
      isActive: cfg?.isActive !== 0,
    });
    setExpanded(expanded === platform ? null : platform);
  };

  const handleSave = async () => {
    if (!editForm.apiKey.trim() || !editForm.apiHost.trim()) {
      showMessage("error", "API Key 和 API Host 不能为空");
      return;
    }
    try {
      await upsert.mutateAsync({
        platform: editForm.platform as "instagram" | "tiktok" | "youtube",
        apiKey: editForm.apiKey.trim(),
        apiHost: editForm.apiHost.trim(),
        isActive: editForm.isActive,
      });
      showMessage("success", `${PLATFORM_META[editForm.platform]?.label || editForm.platform} API 配置已保存`);
      setExpanded(null);
    } catch (e: any) {
      showMessage("error", e.message || "保存失败");
    }
  };

  const handleToggle = async (platform: string) => {
    try {
      await toggle.mutateAsync({ platform });
      showMessage("success", "状态已切换");
    } catch (e: any) {
      showMessage("error", e.message || "操作失败");
    }
  };

  const handleDelete = async (platform: string) => {
    if (!confirm("确定要删除此配置吗？")) return;
    try {
      await deleteConfig.mutateAsync({ platform });
      showMessage("success", "配置已删除");
      if (expanded === platform) setExpanded(null);
    } catch (e: any) {
      showMessage("error", e.message || "删除失败");
    }
  };

  const platformList: PlatformMeta[] = Object.values(PLATFORM_META);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">系统设置</h1>
            <p className="text-xs text-faint">API 配置与系统状态</p>
          </div>
        </div>

        <div className="rounded-2xl bg-elevated border border-line p-8 text-center">
          <Shield className="w-10 h-10 text-brand/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-content mb-1">需要管理员权限</h3>
          <p className="text-xs text-faint">只有管理员可以配置 API Key</p>
        </div>

        {/* Change own password — available to all logged-in users */}
        <div className="mt-6">
          <ChangePasswordCard />
        </div>

        {/* Status overview for non-admin */}
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-bold text-content">API 状态</h2>
          {platformList.map((p) => (
            <div
              key={p.key}
              className="flex items-center justify-between rounded-xl bg-elevated border border-line p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: p.color + "15" }}
                >
                  <span className="text-sm font-bold" style={{ color: p.color }}>
                    {p.label[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-content">{p.label}</p>
                  <p className="text-[10px] text-faint">{p.description}</p>
                </div>
              </div>
              <StatusBadge active={!!status?.[p.key]} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content">系统设置</h1>
          <p className="text-xs text-faint">配置 RapidAPI Key 以启用自动数据获取</p>
        </div>
      </div>

      {/* Test Mode Toggle — visible to all authenticated users */}
      <div className="mb-6 rounded-xl bg-hover border border-line p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className={`w-5 h-5 ${testModeEnabled ? "text-brand" : "text-faint"}`} />
            <div>
              <h3 className="text-sm font-bold text-content">开发测试模式</h3>
              <p className="text-[11px] text-faint">
                {testModeEnabled
                  ? "测试模式已开启 — 创建的数据不会出现在正常列表中"
                  : "开启后创建的数据将标记为测试数据，仅测试模式下可见"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !testModeEnabled;
              setTestMode(next);
              setTestModeEnabled(next);
              window.location.reload();
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              testModeEnabled ? "bg-lime" : "bg-hover"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                testModeEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
        {testModeEnabled && (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-lime/10 text-brand font-medium">测试模式运行中</span>
            {isAdmin && (
              <button
                onClick={() => {
                  if (confirm("确定清理所有测试数据吗？此操作不可撤销。")) {
                    cleanupTest.mutate(undefined, {
                      onSuccess: (data) => {
                        const d = data.deleted;
                        const total = Object.values(d).reduce((a, b) => a + b, 0);
                        alert(`已清理 ${total} 条测试数据`);
                      },
                    });
                  }
                }}
                className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1 transition-colors"
              >
                <Trash className="w-3 h-3" />
                一键清理测试数据
              </button>
            )}
          </div>
        )}
      </div>

      {/* Security: change my password + admin reset of user passwords */}
      <ChangePasswordCard />
      <AdminResetPasswordCard />

      {/* Alert message */}
      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Info banner */}
      <div className="mb-6 rounded-xl bg-blue-500/5 border border-blue-500/10 p-4 flex items-start gap-3">
        <Key className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-sub leading-relaxed">
            在此配置 RapidAPI 的 API Key 后，添加网红时系统将自动从对应平台获取真实数据。
            每个平台需要独立的 API Key 和 Host，请从{" "}
            <a
              href="https://rapidapi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline inline-flex items-center gap-0.5"
            >
              RapidAPI <ExternalLink className="w-3 h-3" />
            </a>{" "}
            订阅对应 API。
          </p>
        </div>
      </div>

      {/* Invitation Code Management */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">邀请码管理</h1>
            <p className="text-xs text-faint">生成和管理注册邀请码</p>
          </div>
        </div>

        {/* Generate codes section */}
        <div className="rounded-xl bg-elevated border border-line p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-sub">生成数量:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={generateCount}
                onChange={(e) => setGenerateCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-16 bg-base border border-line rounded-lg px-2 py-1.5 text-xs text-content text-center focus:outline-none focus:border-brand/30"
              />
            </div>
            <button
              onClick={handleGenerateCodes}
              disabled={generateCodes.isPending}
              className="btn-lime text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {generateCodes.isPending ? "生成中..." : "生成邀请码"}
            </button>
            {generateCodes.isSuccess && generateCodes.data && (
              <div className="flex items-center gap-2 flex-wrap">
                {generateCodes.data.codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-lime/10 text-brand font-mono font-bold"
                  >
                    {code}
                    <button
                      onClick={() => handleCopyCode(code)}
                      className="hover:text-content transition-colors"
                    >
                      {copiedCode === code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invitation codes list */}
        {invitationList && invitationList.length > 0 ? (
          <div className="rounded-xl bg-elevated border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">邀请码</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">状态</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">使用者</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">使用时间</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">生成时间</th>
                    <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invitationList.map((inv) => (
                    <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-hover transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono font-bold text-brand">{inv.code}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {inv.usedByUnionId ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-hover text-faint">
                            <UserCheck className="w-3 h-3" /> 已使用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
                            <Check className="w-3 h-3" /> 未使用
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-sub">
                          {inv.usedByUnionId ? inv.usedByUnionId.replace("local_", "") : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-faint">{inv.usedAt || "-"}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-faint">{inv.createdAt}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!inv.usedByUnionId && (
                          <button
                            onClick={() => {
                              if (confirm("确定删除此邀请码吗？")) {
                                deleteCode.mutate({ id: inv.id });
                              }
                            }}
                            className="text-[10px] text-red-400/70 hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/10 transition-all"
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-elevated border border-line p-8 text-center">
            <Ticket className="w-8 h-8 text-faint mx-auto mb-2" />
            <p className="text-xs text-faint">暂无邀请码，点击上方按钮生成</p>
          </div>
        )}
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {platformList.map((p) => {
          const cfg = configs?.find((c) => c.platform === p.key);
          const isExpanded = expanded === p.key;
          const isActive = !!status?.[p.key];

          return (
            <div
              key={p.key}
              className={`rounded-xl border transition-all ${
                isExpanded
                  ? "bg-elevated border-brand/20"
                  : "bg-elevated border-line hover:border-line"
              }`}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => handleEdit(p.key)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: p.color + "18" }}
                  >
                    <span className="text-sm font-bold" style={{ color: p.color }}>
                      {p.label[0]}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-content">{p.label}</span>
                      <StatusBadge active={isActive} />
                    </div>
                    <p className="text-[10px] text-faint mt-0.5">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cfg && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(p.key);
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                        cfg.isActive
                          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                          : "bg-hover text-faint hover:bg-hover"
                      }`}
                    >
                      {cfg.isActive ? "已启用" : "已停用"}
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-faint" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-faint" />
                  )}
                </div>
              </div>

              {/* Expanded form */}
              {isExpanded && (
                <div className="border-t border-line p-4 space-y-4">
                  {/* API Key */}
                  <div>
                    <label className="block text-xs font-medium text-sub mb-1.5">
                      X-RapidAPI-Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey[p.key] ? "text" : "password"}
                        value={editForm.apiKey}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, apiKey: e.target.value }))
                        }
                        placeholder="粘贴你的 RapidAPI Key"
                        className="w-full bg-base border border-line rounded-lg px-3 py-2.5 pr-10 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
                      />
                      <button
                        onClick={() =>
                          setShowKey((prev) => ({ ...prev, [p.key]: !prev[p.key] }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-content transition-colors"
                      >
                        {showKey[p.key] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* API Host */}
                  <div>
                    <label className="block text-xs font-medium text-sub mb-1.5">
                      X-RapidAPI-Host
                    </label>
                    <input
                      type="text"
                      value={editForm.apiHost}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, apiHost: e.target.value }))
                      }
                      placeholder={`例如: ${p.key}-scraper-2022.p.rapidapi.com`}
                      className="w-full bg-base border border-line rounded-lg px-3 py-2.5 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30 transition-colors"
                    />
                    <p className="text-[10px] text-faint mt-1.5">
                      在{" "}
                      <a
                        href={p.rapidApiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline inline-flex items-center gap-0.5"
                      >
                        RapidAPI <ExternalLink className="w-3 h-3" />
                      </a>{" "}
                      订阅对应 API 后，在 Code Snippets 页面可找到 Key 和 Host
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSave}
                        disabled={upsert.isPending}
                        className="btn-lime text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {upsert.isPending ? "保存中..." : "保存配置"}
                      </button>
                      <button
                        onClick={() => setExpanded(null)}
                        className="text-xs text-faint hover:text-content px-3 py-2 rounded-full hover:bg-hover transition-all"
                      >
                        取消
                      </button>
                    </div>
                    {cfg && (
                      <button
                        onClick={() => handleDelete(p.key)}
                        disabled={deleteConfig.isPending}
                        className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 px-3 py-2 rounded-full hover:bg-red-400/10 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        active
          ? "bg-green-500/10 text-green-400"
          : "bg-hover text-faint"
      }`}
    >
      {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {active ? "已配置" : "未配置"}
    </span>
  );
}
