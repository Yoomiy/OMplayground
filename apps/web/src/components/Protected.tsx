import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlaygroundAccess } from "@/hooks/usePlaygroundAccess";
import { supabase } from "@/lib/supabase";
import type { PlaygroundRole } from "@/lib/recessAccess";
import { useProfile } from "@/hooks/useProfile";
const RouteFallback = () => (
  <p className="p-8 text-center" role="status">
    טוען…
  </p>
);

function homeForRole(role: PlaygroundRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/home";
}

export function Protected({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: PlaygroundRole[];
}) {
  const { user, loading: authLoading } = useAuth();
  const { result, loading: accessLoading, refresh } = usePlaygroundAccess(user);
  const { profile, error: profileError, loading: profileLoading, refetch } = useProfile();

  if (authLoading || (user && accessLoading && !result)) {
    return <RouteFallback />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!result) {
    return <RouteFallback />;
  }
  if (!result.allowed) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center" dir="rtl">
        <p role="status">{result.message}</p>
        <p className="my-4">נבדוק שוב אוטומטית. אין צורך להתחבר מחדש.</p>
        <button type="button" disabled={accessLoading} onClick={() => void refresh()}>
          {accessLoading ? "בודקים…" : "בדיקה חוזרת"}
        </button>
        <button type="button" className="mx-4" onClick={() => void supabase.auth.signOut()}>
          יציאה מהחשבון
        </button>
      </main>
    );
  }
  if (allowedRoles && !allowedRoles.includes(result.role)) {
    return <Navigate to={homeForRole(result.role)} replace />;
  }
  if (result.role !== "admin" && !profile && profileError) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center" dir="rtl">
        <p role="alert">{profileError}</p>
        <button
          type="button"
          disabled={profileLoading}
          onClick={() => void refetch()}
          className="mt-4 rounded-xl border px-4 py-2"
        >
          {profileLoading ? "טוענים…" : "נסו שוב"}
        </button>
      </main>
    );
  }
  return <>{children}</>;
}
