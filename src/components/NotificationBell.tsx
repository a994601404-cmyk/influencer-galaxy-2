import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { setSignal } from "@/lib/signal-light";
import type { SignalType } from "@/lib/signal-light";
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
  influencer_created: { icon: UserPlus, color: "text-brand" },
  negotiation_created: { icon: Handshake, color: "text-cy" },
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

  // Sync unread notifications to signal lights on mount / data change
  // This ensures signals are set even after page refresh
  const typeMap = useMemo(() => ({
    negotiation_reviewed: "price" as SignalType,
    script_reviewed: "script" as SignalType,
    video_reviewed: "video" as SignalType,
    negotiation_created: "price" as SignalType,
    script_created: "script" as SignalType,
    video_created: "video" as SignalType,
    influencer_created: "price" as SignalType,
  }), []);

  useEffect(() => {
    // Set signal lights for all unread notifications
    for (const n of notifications) {
      if (!n.isRead && n.type && typeMap[n.type] && n.relatedId) {
        setSignal(n.relatedId, typeMap[n.type], n.createdAt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  // Real-time delivery (SSE + polling fallback)
  // 任何新通知都意味着有数据变更（审核/报价/卡片流转），同步失效相关查询，
  // 让受影响用户的页面数据准实时刷新，无需手动刷新页面
  const invalidateDataQueries = useCallback(() => {
    utils.influencer.list.invalidate();
    utils.cardCategory.list.invalidate();
    utils.cardCategory.statusCounts.invalidate();
    utils.negotiation.list.invalidate();
    utils.negotiation.listAll.invalidate();
    utils.scriptReview.listAll.invalidate();
    utils.videoReview.listAll.invalidate();
    utils.post.listAll.invalidate();
  }, [utils]);

  const { mode, connected } = useNotificationRealtime(
    useCallback((data) => {
      // Refresh notification list & count
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      // Sync underlying data (card moved out of 审核中, new review items, etc.)
      invalidateDataQueries();
      // Show toast
      setToast({ title: data.title, message: data.message });
      setTimeout(() => setToast(null), 4000);
      // Set signal light for real-time notifications
      if (data.type && typeMap[data.type] && data.relatedId) {
        setSignal(data.relatedId, typeMap[data.type], data.createdAt);
      }
    }, [utils, typeMap, invalidateDataQueries])
  );

  // Listen for polling tick events (fallback mode)
  // 未读数增加 = 有新通知 = 有数据变更，此时同步失效数据查询
  const lastUnreadRef = useRef<number>(0);
  useEffect(() => {
    const handler = () => {
      refetchCount().then((res) => {
        const n = res.data ?? 0;
        if (lastUnreadRef.current > 0 && n > lastUnreadRef.current) {
          invalidateDataQueries();
        }
        lastUnreadRef.current = n;
      });
      if (open) refetchList();
    };
    window.addEventListener("notification_poll_tick", handler);
    return () => window.removeEventListener("notification_poll_tick", handler);
  }, [refetchCount, refetchList, open, invalidateDataQueries]);

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
          className="fixed top-4 right-4 z-[100] max-w-xs bg-elevated border border-line rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-2 fade-in duration-300 cursor-pointer"
          onClick={() => { setToast(null); }}
        >
          <p className="text-xs font-bold text-brand mb-1">{toast.title}</p>
          <p className="text-[11px] text-sub line-clamp-2">{toast.message}</p>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* Bell icon */}
        <button
          onClick={() => setOpen(!open)}
          className="relative w-9 h-9 rounded-xl bg-hover hover:bg-hover flex items-center justify-center transition-colors"
        >
          <Bell className="w-4 h-4 text-sub" />
          {/* Connection status dot */}
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-elevated ${connected ? "bg-green-500" : "bg-faint"}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-content text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-11 w-[380px] max-h-[500px] bg-elevated border border-line rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-content">通知</h3>
                {connected ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-green-400">
                    <Wifi className="w-2.5 h-2.5" />{mode === "sse" ? "实时" : "轮询"}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[9px] text-faint">
                    <WifiOff className="w-2.5 h-2.5" />离线
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    showUnreadOnly
                      ? "bg-lime/10 text-brand"
                      : "bg-hover text-faint hover:text-content"
                  }`}
                >
                  {showUnreadOnly ? "全部" : "未读"}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-[10px] px-2 py-1 rounded-md bg-hover text-faint hover:text-content flex items-center gap-1 transition-colors"
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
                  <AlertCircle className="w-8 h-8 text-faint mb-2" />
                  <p className="text-xs text-faint">
                    {showUnreadOnly ? "没有未读通知" : "暂无通知"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {notifications.map((n: any) => {
                    const cfg = typeConfig[n.type] || { icon: Bell, color: "text-sub" };
                    const Icon = cfg.icon;
                    const isClickable = n.relatedId && n.relatedType === "influencer";
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                          n.isRead ? "opacity-50" : ""
                        } ${isClickable ? "cursor-pointer hover:bg-hover" : "cursor-default"}`}
                        title={isClickable ? "点击查看详情" : ""}
                      >
                        <div className={`mt-0.5 ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-bold text-content truncate">{n.title}</p>
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-sub line-clamp-2 leading-relaxed">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[9px] text-faint">{n.createdAt}</p>
                            {isClickable && (
                              <span className="text-[9px] text-cy">点击查看</span>
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
              <div className="px-4 py-2 border-t border-line text-center">
                <p className="text-[9px] text-faint">
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
