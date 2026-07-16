import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { isTestMode } from "@/lib/test-mode";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
// API backend URL - auto-detect environment
// On Vercel: uses same domain /api/trpc
// On Kimi platform: uses platform-provided API domain
const API_URL = typeof window !== "undefined" && window.location.hostname.includes("vercel.app")
  ? `${window.location.origin}/api/trpc`
  : "/api/trpc";

// Read local auth data from localStorage for header injection
// We send actual user metadata (not just a token) so the backend
// never needs to hardcode any role or user info.
function getLocalAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("pulseboost_auth_v1");
    if (!raw) return {};
    const auth = JSON.parse(raw);
    const user = auth?.user;
    const token = auth?.token; // token is stored at the top level, NOT inside user
    if (!user || !token) return {};
    const meta = {
      name: user.name || "",
      email: user.email || "",
      role: user.role || "user",
    };
    const headers: Record<string, string> = {
      "x-local-auth-token": String(token),
      "x-local-auth-meta": btoa(JSON.stringify(meta)),
    };
    // Pass test mode flag to backend
    if (isTestMode()) {
      headers["x-test-mode"] = "1";
    }
    return headers;
  } catch {
    // ignore
  }
  return {};
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      headers() {
        return getLocalAuthHeaders();
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
