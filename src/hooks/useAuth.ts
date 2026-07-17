import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { getCurrentUser, logoutLocal, isAdmin as checkIsAdmin, type LocalUser } from "@/lib/local-auth";

// Unified user type that matches both local and OAuth users
interface UnifiedUser {
  id: number;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: "user" | "admin";
}

export function useAuth() {
  const [localUser, setLocalUser] = useState<Omit<LocalUser, "passwordHash"> | null>(null);
  const [checked, setChecked] = useState(false);

  const utils = trpc.useUtils();

  // Try OAuth first
  const {
    data: oauthUser,
    isLoading: oauthLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });

  // Sync local user on mount
  useEffect(() => {
    const user = getCurrentUser();
    setLocalUser(user);
    setChecked(true);
  }, []);

  // Listen for auth changes from login/register/logout in other components
  useEffect(() => {
    const handleChange = () => {
      const user = getCurrentUser();
      setLocalUser(user);
    };
    window.addEventListener("localauthchange", handleChange);
    // Also listen for storage events from other tabs
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("localauthchange", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const logout = useCallback(() => {
    // Always logout both systems
    logoutLocal();
    setLocalUser(null);
    // Immediately invalidate auth query so oauthUser becomes null
    utils.auth.me.invalidate();
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.reload();
      },
    });
  }, [logoutMutation, utils]);

  // Use OAuth user if available, otherwise use local user
  const user: UnifiedUser | null = useMemo(() => {
    if (oauthUser) {
      return {
        id: oauthUser.id,
        name: oauthUser.name,
        email: oauthUser.email,
        avatar: oauthUser.avatar,
        role: oauthUser.role as "user" | "admin",
      };
    }
    if (localUser) {
      return {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        avatar: localUser.avatar || null,
        role: localUser.role,
      };
    }
    return null;
  }, [oauthUser, localUser]);

  const isAdmin = useMemo(() => {
    // Only trust the unified user object — never fall back to stale localStorage
    return user?.role === "admin";
  }, [user]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin,
      isLoading: oauthLoading && !checked,
      logout,
      refresh: () => {
        const u = getCurrentUser();
        setLocalUser(u);
      },
    }),
    [user, isAdmin, oauthLoading, checked, logout],
  );
}
