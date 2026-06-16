import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, Mail, UserRound, Home } from "lucide-react";
import { useInbox } from "@/hooks/useInbox";
import { useOnlinePresence } from "@/hooks/usePresence";
import { useProfile } from "@/hooks/useProfile";
import { KidAvatar } from "@/components/KidAvatar";
import { discardMySoloWaitingSessions } from "@/lib/pausedSessionActions";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

export function desktopPanelClass(className?: string) {
  return cn(
    "rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md",
    className
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all duration-200",
    isActive
      ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_4px_12px_rgba(139,92,246,0.5)] scale-105"
      : "text-white/70 hover:bg-white/10 hover:text-white"
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
  const { profile } = useProfile();
  const { onlineUserIds } = useOnlinePresence();
  const { unreadTotal } = useInbox();

  async function logout() {
    const { error } = await discardMySoloWaitingSessions();
    if (error) console.error(error);
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className={cn("min-h-screen px-3 py-4 sm:px-5", className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">

        {/* ── Header ── */}
        <header className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">

            {/* Left side: Avatar + greeting */}
            <div className="flex items-center gap-3 min-w-0">
              {profile && (
                <div className="animate-kid-float shrink-0">
                  <KidAvatar
                    profile={profile}
                    className="size-12 min-h-[48px] min-w-[48px] rounded-2xl border-2 border-white/30 shadow-lg"
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/50 truncate">
                  {profile?.full_name
                    ? `שלום, ${profile.full_name} 👋 · כיתה ${profile.grade}`
                    : "אזור משחקים"}
                </p>
                <h1 className="truncate text-lg font-black text-white sm:text-xl leading-tight">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-0.5 text-xs font-bold text-white/40 truncate">{subtitle}</p>
                ) : null}
              </div>
            </div>

            {/* Right side: Nav */}
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="ניווט ראשי">
              <NavLink to="/home" className={navClass}>
                <Home className="size-4" aria-hidden />
                <span>בית</span>
              </NavLink>
              <NavLink to="/inbox" className={navClass}>
                <Mail className="size-4" aria-hidden />
                <span>הודעות</span>
                {unreadTotal > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] leading-none text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
                    {unreadTotal}
                  </span>
                ) : null}
              </NavLink>
              <NavLink to="/profile" className={navClass}>
                <UserRound className="size-4" aria-hidden />
                <span>פרופיל</span>
              </NavLink>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white/60 transition hover:bg-white/10 hover:text-white"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" aria-hidden />
                יציאה
              </button>
            </nav>
          </div>

          {/* Online count strip */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs font-bold text-white/50">
            <span className="inline-flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              {onlineUserIds.size} ילדים מחוברים עכשיו!
            </span>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            {!actions ? (
              <Link className="text-violet-400 hover:text-violet-300 underline decoration-2 underline-offset-4 transition-colors" to="/home">
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
