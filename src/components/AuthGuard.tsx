import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * AuthGuard - Route guard that redirects unauthenticated users to the landing page.
 * All internal pages should be wrapped with this component.
 */
export default function AuthGuard({ children, fallback }: Props) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to landing page, preserving the intended path for post-login redirect
      navigate("/landing", { replace: true, state: { from: location.pathname } });
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);

  // Show nothing while checking auth (prevents flash of content)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated - show fallback or nothing
  if (!isAuthenticated) {
    return fallback || null;
  }

  // Authenticated - render the protected content
  return <>{children}</>;
}
