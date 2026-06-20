import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlaygroundAccess } from "@/hooks/usePlaygroundAccess";
import { PresenceProvider } from "@/hooks/usePresence";
import { InboxProvider } from "@/hooks/useInbox";
import { PendingChallengeBanner } from "@/components/PendingChallengeBanner";
import { FeedbackTrigger } from "@/components/FeedbackTrigger";
import { supabase } from "@/lib/supabase";
import type { PlaygroundRole } from "@/lib/recessAccess";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";

const FriendsDeprecatedPage = lazy(() =>
  import("@/pages/FriendsDeprecatedPage").then((m) => ({
    default: m.FriendsDeprecatedPage
  }))
);
const InboxPage = lazy(() =>
  import("@/pages/InboxPage").then((m) => ({ default: m.InboxPage }))
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);
const PublicProfilePage = lazy(() =>
  import("@/pages/PublicProfilePage").then((m) => ({
    default: m.PublicProfilePage
  }))
);
const PlayPage = lazy(() => import("@/pages/PlayPage"));
const TeacherPage = lazy(() =>
  import("@/pages/TeacherPage").then((m) => ({ default: m.TeacherPage }))
);
const AdminPage = lazy(() =>
  import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage }))
);
const JoinByCodePage = lazy(() =>
  import("@/pages/JoinByCodePage").then((m) => ({ default: m.JoinByCodePage }))
);
const SoloGameContainer = lazy(() => import("@/game/SoloGameContainer"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-play-muted">
      טוען…
    </div>
  );
}

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
    return <RouteFallback />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!result) {
    return <RouteFallback />;
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
  const { user } = useAuth();
  return (
    <div className="min-h-screen text-slate-100">
      <PresenceProvider>
        <InboxProvider>
          <PendingChallengeBanner />
          {user && <FeedbackTrigger />}
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </InboxProvider>
      </PresenceProvider>
    </div>
  );
}
