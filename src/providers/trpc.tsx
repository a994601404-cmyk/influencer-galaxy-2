import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../server/router";
import type { ReactNode } from "react";
import { isTestMode } from "@/lib/test-mode";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60s 内重复挂载/切换页面直接使用缓存；
      // 跨用户变更由 SSE 通知驱动 invalidate，自己的操作由 mutation invalidate
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});
// API backend URL - auto-detect environment
// On Vercel: uses same domain /api/trpc
// On Kimi platform: uses platform-provided API domain
const API_URL = typeof window !== "undefined" && window.location.hostname.includes("vercel.app")
  ? `${window.location.origin}/api/trpc`
  : "/api/trpc";

// Identity is carried exclusively by the signed session cookie
// (credentials: "include"). Never send client-asserted identity headers.
function getRequestHeaders(): Record<string, string> {
  if (isTestMode()) {
    return { "x-test-mode": "1" };
  }
  return {};
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      headers() {
        return getRequestHeaders();
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
