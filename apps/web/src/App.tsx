import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { HomePage } from "@/pages/HomePage";
import { FriendsPage } from "@/pages/FriendsPage";
import { InboxPage } from "@/pages/InboxPage";
import { PlayPage } from "@/pages/PlayPage";
import { TeacherPage } from "@/pages/TeacherPage";
import { AdminPage } from "@/pages/AdminPage";

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}
