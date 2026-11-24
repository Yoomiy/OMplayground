import { useEffect, useState, type ReactNode } from "react";
import { CircleCheck, Clock, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePlaygroundAccess } from "@/hooks/usePlaygroundAccess";
import { supabase } from "@/lib/supabase";
import type { PlaygroundRole } from "@/lib/recessAccess";
import { useProfile } from "@/hooks/useProfile";
import { RecessEndingNotice } from "./RecessEndingNotice";

const RouteFallback = () => (
  <p className="p-8 text-center" role="status">
    טוען…
  </p>
);

function RecessClosed({ checking, retry }: { checking: boolean; retry: () => Promise<void> }) {
  return (
    <main
      className="grid min-h-dvh place-items-center bg-gradient-to-b from-indigo-50 to-slate-100 px-4 py-12 text-slate-900 dark:from-indigo-950 dark:to-slate-950 dark:text-slate-100"
      dir="rtl"
    >
      <section
        aria-labelledby="recess-closed-title"
        className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-play dark:border-white/10 dark:bg-slate-900 sm:p-9"
      >
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
          <Clock size={30} aria-hidden="true" />
        </div>
        <h1 id="recess-closed-title" className="text-3xl font-black">זמן לחזור לכיתה</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          כשההפסקה הבאה תתחיל, המשחקים ייפתחו כאן אוטומטית. אין צורך להתחבר מחדש.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={checking}
            onClick={() => void retry()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            <RefreshCw size={16} className={checking ? "motion-safe:animate-spin" : undefined} aria-hidden="true" />
            {checking ? "בודקים…" : "בדיקה חוזרת"}
          </button>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="min-h-11 rounded-xl px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            יציאה מהחשבון
          </button>
        </div>
      </section>
    </main>
  );
}

function RecessReopenedNotice({ reopenedAt }: { reopenedAt: number }) {
  const [visible, setVisible] = useState(() => Date.now() < reopenedAt + 6_000);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), Math.max(0, reopenedAt + 6_000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [reopenedAt]);
  if (!visible) return null;

  return (
    <div
      role="status"
      dir="rtl"
      className="pointer-events-none fixed inset-x-4 bottom-5 z-[100] mx-auto flex w-fit items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-bold text-emerald-950 shadow-lg"
    >
      <CircleCheck size={20} className="shrink-0" aria-hidden="true" />
      ההפסקה התחילה! אפשר לחזור לשחק.
    </div>
  );
}

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
  const { result, loading: accessLoading, refresh, reopenedAt } = usePlaygroundAccess(user);
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
    if (result.reason === "outside_recess") {
      return <RecessClosed checking={accessLoading} retry={refresh} />;
    }
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
  return (
    <>
      {children}
      {reopenedAt !== null && <RecessReopenedNotice key={reopenedAt} reopenedAt={reopenedAt} />}
      {result.role === "kid" && result.expiresAt !== undefined && (
        <RecessEndingNotice key={`${user.id}:${result.expiresAt}`} userId={user.id} expiresAt={result.expiresAt} />
      )}
    </>
  );
}
