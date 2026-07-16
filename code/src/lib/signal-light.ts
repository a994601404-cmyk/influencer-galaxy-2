// Signal Light system - tracks unread admin review actions per influencer
// Three-layer sync:
//   1. Same tab:   in-memory Set<fn> — instant, zero latency
//   2. Cross-tab:  BroadcastChannel — instant across browser tabs
//   3. Cross-tab:  window 'storage' event — fallback for older browsers

export type SignalType = "price" | "script" | "video";

interface SignalState {
  price: boolean;
  script: boolean;
  video: boolean;
}

const LISTENERS = new Set<() => void>();
const BC_NAME = "pulseboost_signal_light";

let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(BC_NAME);
  bc.onmessage = () => {
    // Another tab changed localStorage — re-read and notify
    LISTENERS.forEach((fn) => {
      try { fn(); } catch { /* ignore */ }
    });
  };
} catch {
  // BroadcastChannel not supported — fall through to storage event
}

// Fallback: storage event fires when another tab modifies localStorage
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("signals_")) {
      LISTENERS.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    }
  });
}

function emit() {
  LISTENERS.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
  // Notify other tabs via BroadcastChannel
  if (bc) {
    try { bc.postMessage("sync"); } catch { /* ignore */ }
  }
}

export function subscribeToSignals(fn: () => void): () => void {
  LISTENERS.add(fn);
  return () => { LISTENERS.delete(fn); };
}

function getKey(): string {
  const auth = localStorage.getItem("local_auth");
  if (!auth) return "_signals";
  try {
    const parsed = JSON.parse(auth);
    return `signals_${parsed.unionId || "_"}`;
  } catch {
    return "_signals";
  }
}

function getAll(): Record<number, SignalState> {
  try {
    const raw = localStorage.getItem(getKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<number, SignalState>) {
  localStorage.setItem(getKey(), JSON.stringify(data));
}

// Internal: viewedAt tracking (no top-level state)
function getViewedAt(influencerId: number): number {
  try { const r = localStorage.getItem(`${getKey()}_viewedAt`); const m = r ? JSON.parse(r) : {}; return m[influencerId] || 0; } catch { return 0; }
}
function recordViewed(influencerId: number) {
  try { const k = `${getKey()}_viewedAt`; const r = localStorage.getItem(k); const m = r ? JSON.parse(r) : {}; m[influencerId] = Date.now(); localStorage.setItem(k, JSON.stringify(m)); } catch { /* */ }
}

// Set a signal light on (called when a NEW notification arrives).
// If notificationTimestamp is provided, skip setting signal for already-viewed cards.
export function setSignal(influencerId: number, type: SignalType, notificationTimestamp?: string) {
  const viewedAt = getViewedAt(influencerId);
  if (viewedAt > 0 && notificationTimestamp) {
    const notifTime = new Date(notificationTimestamp.replace(/-/g, '/')).getTime();
    if (!isNaN(notifTime) && notifTime < viewedAt) return;
  }
  const all = getAll();
  if (!all[influencerId]) all[influencerId] = { price: false, script: false, video: false };
  all[influencerId][type] = true;
  saveAll(all);
  emit();
}

// Clear a specific signal light (called when user views a tab)
export function clearSignal(influencerId: number, type: SignalType) {
  const all = getAll();
  if (!all[influencerId]) return;
  all[influencerId][type] = false;
  if (!all[influencerId].price && !all[influencerId].script && !all[influencerId].video) {
    delete all[influencerId];
  }
  saveAll(all);
  recordViewed(influencerId);
  emit();
}

// Clear ALL signal lights for an influencer (called when opening detail card)
export function clearAllSignals(influencerId: number) {
  const all = getAll();
  if (all[influencerId]) {
    delete all[influencerId];
    saveAll(all);
  }
  recordViewed(influencerId);
  emit();
}

// Check if any signal is active for an influencer
export function hasSignal(influencerId: number): boolean {
  const all = getAll();
  const s = all[influencerId];
  if (!s) return false;
  return s.price || s.script || s.video;
}

// Get active signal types for an influencer
export function getActiveSignals(influencerId: number): SignalType[] {
  const all = getAll();
  const s = all[influencerId];
  if (!s) return [];
  const result: SignalType[] = [];
  if (s.price) result.push("price");
  if (s.script) result.push("script");
  if (s.video) result.push("video");
  return result;
}
