import { Link } from "react-router-dom";
import { DoorOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function ClassroomEndedPage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const dashboardPath = isAdmin ? "/admin" : "/teacher";
  const isClassroomManager = isAdmin || profile?.role === "teacher";
  const userDetailsLoading = profileLoading || adminLoading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-lg rounded-3xl border border-slate-700/70 bg-slate-900 p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
          <DoorOpen className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">השיעור הסתיים</h1>
        <p className="mt-3 leading-7 text-slate-300">
          החדר נסגר על ידי המארח. תודה שהשתתפתם.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {userDetailsLoading ? (
            <span className="text-sm text-slate-400">טוען אפשרויות…</span>
          ) : user && isClassroomManager ? (
            <Link
              to={dashboardPath}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-500"
            >
              {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
              ללוח הכיתות שלי
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
