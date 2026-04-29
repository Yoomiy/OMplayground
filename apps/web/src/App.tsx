import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PresenceProvider } from "@/hooks/usePresence";
import { PendingChallengeBanner } from "@/components/PendingChallengeBanner";
import { FriendRequestPopup } from "@/components/FriendRequestPopup";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { FriendsPage } from "@/pages/FriendsPage";
import { InboxPage } from "@/pages/InboxPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PublicProfilePage } from "@/pages/PublicProfilePage";
import PlayPage from "@/pages/PlayPage";
import { TeacherPage } from "@/pages/TeacherPage";
import { AdminPage } from "@/pages/AdminPage";
import { JoinByCodePage } from "@/pages/JoinByCodePage";
import SoloGameContainer from "@/game/SoloGameContainer";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-play-muted">
        טוען…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen text-slate-800">
      <PresenceProvider>
        <PendingChallengeBanner />
        <FriendRequestPopup />
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
                <FriendsPage />
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
              <Protected>
                <TeacherPage />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected>
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
