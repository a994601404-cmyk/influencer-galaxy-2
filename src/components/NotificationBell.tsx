import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  useNotificationList,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/influencer-api";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { trpc } from "@/providers/trpc";
import {
  Bell,
  CheckCheck,
  UserPlus,
  Handshake,
  FileText,
  Video,
  ClipboardCheck,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  influencer_created: { icon: UserPlus, color: "text-[#ccff00]" },
  negotiation_created: { icon: Handshake, color: "text-[#06b6d4]" },
  script_created: { icon: FileText, color: "text-amber-400" },
  video_created: { icon: Video, color: "text-purple-400" },
  negotiation_reviewed: { icon: ClipboardCheck, color: "text-green-400" },
  script_reviewed: { icon: ClipboardCheck, color: "text-green-400" },
  video_reviewed: { icon: ClipboardCheck, color: "text-green-400" },
};

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: notifications = [], refetch: refetchList } = useNotificationList(showUnreadOnly);
  const { data: unreadCount = 0, refetch: refetchCount } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Real-time delivery (SSE + polling fallback)
  const { mode, connected } = useNotificationRealtime(
    useCallback((data) => {
      // Refresh notification list & count
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      // Show toast
      setToast({ title: data.title, message: data.message });
      setTimeout(() => setToast(null), 4000);
    }, [utils])
  );

  // Listen for polling tick events (fallback mode)
  useEffect(() => {
    const handler = () => {
      refetchCount();
      if (open) refetchList();
    };
    window.addEventListener("notification_poll_tick", handler);
    return () => window.removeEventListener("notification_poll_tick", handler);
  }, [refetchCount, refetchList, open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isAuthenticated) return null;

  // Click handler: navigate to influencer detail
  const handleNotificationClick = (n: any) => {
    if (!n.isRead && n.id) {
      markRead.mutate({ id: Number(n.id) });
    }
    // Navigate to influencer detail if relatedId exists
    if (n.relatedId && n.relatedType === "influencer") {
      setOpen(false);
      navigate(`/influencers?influencerId=${n.relatedId}`);
    }
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[100] max-w-xs bg-[#1a1a1a] border border-white/[0.06] rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-2 fade-in duration-300 cursor-pointer"
          onClick={() => { setToast(null); }}
        >
          <p className="text-xs font-bold text-[#ccff00] mb-1">{toast.title}</p>
          <p className="text-[11px] text-[#aaa] line-clamp-2">{toast.message}</p>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* Bell icon */}
        <button
          onClick={() => setOpen(!open)}
          className="relative w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
        >
          <Bell className="w-4 h-4 text-[#888]" />
          {/* Connection status dot */}
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#1a1a1a] ${connected ? "bg-green-500" : "bg-[#555]"}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-11 w-[380px] max-h-[500px] bg-[#1a1a1a] border border-white/[0.06] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">通知</h3>
                {connected ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-green-400">
                    <Wifi className="w-2.5 h-2.5" />{mode === "sse" ? "实时" : "轮询"}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[9px] text-[#555]">
                    <WifiOff className="w-2.5 h-2.5" />离线
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    showUnreadOnly
                      ? "bg-[#ccff00]/10 text-[#ccff00]"
                      : "bg-white/[0.04] text-[#666] hover:text-white"
                  }`}
                >
                  {showUnreadOnly ? "全部" : "未读"}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] text-[#666] hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    全部已读
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="w-8 h-8 text-[#333] mb-2" />
                  <p className="text-xs text-[#555]">
                    {showUnreadOnly ? "没有未读通知" : "暂无通知"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {notifications.map((n: any) => {
                    const cfg = typeConfig[n.type] || { icon: Bell, color: "text-[#888]" };
                    const Icon = cfg.icon;
                    const isClickable = n.relatedId && n.relatedType === "influencer";
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                          n.isRead ? "opacity-50" : ""
                        } ${isClickable ? "cursor-pointer hover:bg-white/[0.03]" : "cursor-default"}`}
                        title={isClickable ? "点击查看详情" : ""}
                      >
                        <div className={`mt-0.5 ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-bold text-white truncate">{n.title}</p>
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#888] line-clamp-2 leading-relaxed">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[9px] text-[#555]">{n.createdAt}</p>
                            {isClickable && (
                              <span className="text-[9px] text-[#06b6d4]">点击查看</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-white/[0.06] text-center">
                <p className="text-[9px] text-[#555]">
                  {showUnreadOnly ? `共 ${unreadCount} 条未读` : `共 ${notifications.length} 条通知`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
