import { useCallback, useMemo } from "react";
import { trpc } from "@/providers/trpc";

// Unified user type (Kimi OAuth and email/password accounts look the same)
interface UnifiedUser {
  id: number;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: "user" | "admin";
}

export function useAuth() {
  const utils = trpc.useUtils();

  // Server is the single source of truth for identity (session cookie)
  const {
    data: authUser,
    isLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(() => {
    utils.auth.me.invalidate();
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.reload();
      },
    });
  }, [logoutMutation, utils]);

  const user: UnifiedUser | null = useMemo(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      avatar: authUser.avatar,
      role: authUser.role as "user" | "admin",
    };
  }, [authUser]);

  const isAdmin = useMemo(() => user?.role === "admin", [user]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin,
      isLoading,
      logout,
      refresh: () => {
        utils.auth.me.invalidate();
      },
    }),
    [user, isAdmin, isLoading, logout, utils],
  );
}
