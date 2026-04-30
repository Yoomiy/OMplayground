import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, LogOut, Mail, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInbox } from "@/hooks/useInbox";
import { useOnlinePresence } from "@/hooks/usePresence";
import { useProfile } from "@/hooks/useProfile";
import { discardMySoloWaitingSessions } from "@/lib/pausedSessionActions";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

export function desktopPanelClass(className?: string) {
  return cn(
    "rounded-2xl border border-slate-200/90 bg-white/95 shadow-play backdrop-blur-sm",
    className
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
    isActive
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-100"
  );
}

export function KidDesktopShell({
  title,
  subtitle,
  children,
  actions,
  className,
  contentClassName
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { onlineUserIds } = useOnlinePresence();
  const { unreadTotal } = useInbox(user?.id);

  async function logout() {
    const { error } = await discardMySoloWaitingSessions();
    if (error) console.error(error);
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className={cn("min-h-screen px-4 py-4 sm:px-6", className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
        <header className={desktopPanelClass("px-4 py-3")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-500">
                {profile?.full_name ? `${profile.full_name} · כיתה ${profile.grade}` : "אזור משחקים"}
              </p>
              <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <nav className="flex flex-wrap items-center gap-1" aria-label="ניווט ראשי">
              <NavLink to="/home" className={navClass}>
                <Home className="size-4" aria-hidden />
                בית
              </NavLink>
              <NavLink to="/inbox" className={navClass}>
                <Mail className="size-4" aria-hidden />
                הודעות
                {unreadTotal > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                    {unreadTotal}
                  </span>
                ) : null}
              </NavLink>
              <NavLink to="/profile" className={navClass}>
                <UserRound className="size-4" aria-hidden />
                פרופיל
              </NavLink>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" aria-hidden />
                יציאה
              </button>
            </nav>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
              {onlineUserIds.size} מחוברים עכשיו
            </span>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            {!actions ? (
              <Link className="text-indigo-700 underline decoration-2 underline-offset-4" to="/home">
                חזרה ללוח
              </Link>
            ) : null}
          </div>
        </header>

        <main className={cn("min-w-0", contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
