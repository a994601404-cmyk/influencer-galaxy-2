import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./useAuth";

// Build SSE token from local auth
function getSseToken(): string | null {
  try {
    const raw = localStorage.getItem("pulseboost_auth_v1");
    if (!raw) return null;
    const auth = JSON.parse(raw);
    const user = auth?.user;
    if (!user?.email) return null;
    return btoa(JSON.stringify({ name: user.name || "", email: user.email, role: user.role || "user" }));
  } catch {
    return null;
  }
}

type OnNotification = (data: {
  type: string;
  id: number;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
  createdAt: string;
}) => void;

/**
 * Real-time notification delivery using SSE with polling fallback.
 * - Tries SSE first for true real-time push
 * - Falls back to 3-second polling if SSE fails or disconnects
 */
export function useNotificationRealtime(onNotification: OnNotification) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"sse" | "poll" | "idle">("idle");
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // already polling
    setMode("poll");
    setConnected(true);
    console.log("[Notification] Polling mode active (3s)");

    pollIntervalRef.current = setInterval(() => {
      // Dispatch a custom event that the notification hook can listen to
      window.dispatchEvent(new CustomEvent("notification_poll_tick"));
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      stopPolling();
      eventSourceRef.current?.close();
      return;
    }

    const token = getSseToken();
    if (!token) {
      startPolling();
      return;
    }

    // Try SSE first
    const sseUrl = `https://b4uv3gij4o2yg.kimi.site/api/sse/notifications?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    let connectedOnce = false;
    const fallbackTimer = setTimeout(() => {
      if (!connectedOnce) {
        console.log("[Notification] SSE timeout, switching to polling");
        es.close();
        startPolling();
      }
    }, 5000);

    es.onopen = () => {
      connectedOnce = true;
      clearTimeout(fallbackTimer);
      setMode("sse");
      setConnected(true);
      console.log("[Notification] SSE connected");
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat") return; // ignore heartbeats
        if (data.type === "new_notification") {
          onNotificationRef.current(data);
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!connectedOnce) return; // let fallback timer handle it
      console.log("[Notification] SSE error, switching to polling");
      setConnected(false);
      es.close();
      startPolling();
    };

    return () => {
      clearTimeout(fallbackTimer);
      es.close();
      stopPolling();
    };
  }, [isAuthenticated, startPolling, stopPolling]);

  return { mode, connected };
}
