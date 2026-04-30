import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlaygroundAccess } from "@/hooks/usePlaygroundAccess";
import { PresenceProvider } from "@/hooks/usePresence";
import { PendingChallengeBanner } from "@/components/PendingChallengeBanner";
import { supabase } from "@/lib/supabase";
import type { PlaygroundRole } from "@/lib/recessAccess";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { FriendsDeprecatedPage } from "@/pages/FriendsDeprecatedPage";
import { InboxPage } from "@/pages/InboxPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PublicProfilePage } from "@/pages/PublicProfilePage";
import PlayPage from "@/pages/PlayPage";
import { TeacherPage } from "@/pages/TeacherPage";
import { AdminPage } from "@/pages/AdminPage";
import { JoinByCodePage } from "@/pages/JoinByCodePage";
import SoloGameContainer from "@/game/SoloGameContainer";

function homeForRole(role: PlaygroundRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/home";
}

function Protected({
  children,
  allowedRoles
}: {
  children: ReactNode;
  allowedRoles?: PlaygroundRole[];
}) {
  const { user, loading: authLoading } = useAuth();
  const { result, loading: accessLoading } = usePlaygroundAccess(user);

  useEffect(() => {
    if (user && result && !result.allowed) {
      void supabase.auth.signOut();
    }
  }, [result, user]);

  if (authLoading || (user && accessLoading && !result)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-play-muted">
        טוען…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center text-play-muted">
        טוען…
      </div>
    );
  }
  if (!result.allowed) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(result.role)) {
    return <Navigate to={homeForRole(result.role)} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen text-slate-800">
      <PresenceProvider>
        <PendingChallengeBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/home"
            element={
              <Protected>
                <HomePage />
              </Protected>
            }
          />
          <Route
            path="/friends"
            element={
              <Protected>
                <FriendsDeprecatedPage />
              </Protected>
            }
          />
          <Route
            path="/inbox"
            element={
              <Protected>
                <InboxPage />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route
            path="/profile/:kidId"
            element={
              <Protected>
                <PublicProfilePage />
              </Protected>
            }
          />
          <Route
            path="/teacher"
            element={
              <Protected allowedRoles={["teacher"]}>
                <TeacherPage />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected allowedRoles={["admin"]}>
                <AdminPage />
              </Protected>
            }
          />
          <Route
            path="/play/:sessionId"
            element={
              <Protected>
                <PlayPage />
              </Protected>
            }
          />
          <Route
            path="/solo/:gameKey"
            element={
              <Protected>
                <SoloGameContainer />
              </Protected>
            }
          />
          <Route
            path="/join/:code"
            element={
              <Protected>
                <JoinByCodePage />
              </Protected>
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </PresenceProvider>
    </div>
  );
}
