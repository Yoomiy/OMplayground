import { useChallengeDeparture } from "@/hooks/useChallengeDeparture";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Protected } from "@/components/Protected";
import { lazy, Suspense, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PresenceProvider } from "@/hooks/usePresence";
import { GlobalMessages } from "@/components/GlobalMessages";
import { InboxProvider } from "@/hooks/useInbox";
import { ThemeProvider } from "@/context/ThemeContext";
import { ChallengeDock } from "@/components/ChallengeDock";
import { FeedbackTrigger } from "@/components/FeedbackTrigger";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { lazyImportWithRetry } from "@/lib/lazyImport";
import { gameActivityForPath } from "@/lib/gameNavigation";

function createPages() {
  const FriendsDeprecatedPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/FriendsDeprecatedPage")).then((m) => ({
      default: m.FriendsDeprecatedPage,
    })),
  );
  const InboxPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/InboxPage")).then((m) => ({ default: m.InboxPage })),
  );
  const ProfilePage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/ProfilePage")).then((m) => ({
      default: m.ProfilePage,
    })),
  );
  const PublicProfilePage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/PublicProfilePage")).then((m) => ({
      default: m.PublicProfilePage,
    })),
  );
  const PlayPage = lazy(() => lazyImportWithRetry(() => import("@/pages/PlayPage")));
  const TeacherPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/TeacherPage")).then((m) => ({
      default: m.TeacherPage,
    })),
  );
  const AdminPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/AdminPage")).then((m) => ({ default: m.AdminPage })),
  );
  const JoinByCodePage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/JoinByCodePage")).then((m) => ({
      default: m.JoinByCodePage,
    })),
  );
  const ClassroomPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/ClassroomPage")).then((m) => ({
      default: m.ClassroomPage,
    })),
  );
  const ClassroomEndedPage = lazy(() =>
    lazyImportWithRetry(() => import("@/pages/ClassroomEndedPage")).then((m) => ({
      default: m.ClassroomEndedPage,
    })),
  );
  const SoloGameContainer = lazy(() =>
    lazyImportWithRetry(() => import("@/game/SoloGameContainer")),
  );

  return {
    FriendsDeprecatedPage,
    InboxPage,
    ProfilePage,
    PublicProfilePage,
    PlayPage,
    TeacherPage,
    AdminPage,
    JoinByCodePage,
    ClassroomPage,
    ClassroomEndedPage,
    SoloGameContainer,
  };
}

function RouteFallback() {
  return <div className="flex min-h-screen items-center justify-center text-play-muted">טוען…</div>;
}

function RoutedPages() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  // React.lazy caches rejected imports. Recreate the lazy components on an explicit retry.
  const {
    FriendsDeprecatedPage,
    InboxPage,
    ProfilePage,
    PublicProfilePage,
    PlayPage,
    TeacherPage,
    AdminPage,
    JoinByCodePage,
    ClassroomPage,
    ClassroomEndedPage,
    SoloGameContainer,
  } = useMemo(createPages, [attempt]);
  return (
    <ErrorBoundary
      scope="page"
      resetKey={`${user?.id}:${location.key}`}
      onReset={() => setAttempt((value) => value + 1)}
      onHome={() => navigate("/home")}
    >
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
          <Route path="/classroom/:roomCode" element={<ClassroomPage key={location.pathname} />} />
          <Route path="/classroom-ended" element={<ClassroomEndedPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const inClassroom = gameActivityForPath(location.pathname).phase === "classroom";
  const departure = useChallengeDeparture();
  return (
    <ThemeProvider>
      <div
        className="min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-200"
        dir="rtl"
      >
        {departure.notice && (
          <div
            role="status"
            className="fixed bottom-20 right-4 z-50 max-w-sm rounded-2xl border border-violet-200 bg-white p-4 text-sm font-bold text-slate-900 shadow-lg dark:border-white/15 dark:bg-slate-900 dark:text-white"
          >
            {departure.notice}
            <button
              type="button"
              className="mr-3 rounded-lg px-2 py-1"
              onClick={departure.dismiss}
              aria-label="סגירת עדכון הזמנה"
            >
              ×
            </button>
          </div>
        )}
        <PresenceProvider>
          <InboxProvider>
            <ErrorBoundary
              scope="messages"
              compact
              title="ההודעות אינן זמינות כרגע"
              resetKey={user?.id}
              className="fixed bottom-4 left-4 z-40 max-w-xs rounded-2xl border bg-white p-4 text-sm text-slate-800 shadow-lg dark:bg-slate-900 dark:text-white"
            >
              <GlobalMessages key={user?.id ?? "anonymous"} />
            </ErrorBoundary>
            {!inClassroom && <ErrorBoundary
              scope="challenges"
              compact
              title="ההזמנות אינן זמינות כרגע"
              resetKey={user?.id}
              className="fixed bottom-20 left-4 z-40 max-w-xs rounded-2xl border bg-white p-4 text-sm text-slate-800 shadow-lg dark:bg-slate-900 dark:text-white"
            >
              <ChallengeDock key={user?.id ?? "anonymous"} />
            </ErrorBoundary>}
            {user && (
              <ErrorBoundary
                scope="feedback"
                compact
                title="לא ניתן לפתוח משוב כרגע"
                resetKey={user.id}
                className="fixed bottom-4 right-4 z-40 max-w-xs rounded-2xl border bg-white p-4 text-sm text-slate-800 shadow-lg dark:bg-slate-900 dark:text-white"
              >
                <FeedbackTrigger />
              </ErrorBoundary>
            )}
            <RoutedPages />
          </InboxProvider>
        </PresenceProvider>
      </div>
    </ThemeProvider>
  );
}
