import { Link } from "react-router-dom";
import { FRIENDS_DEPRECATION_MESSAGE } from "@/lib/friendsDeprecation";

export function FriendsDeprecatedPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-20 sm:px-6">
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Friends is deprecated</h1>
        <p className="mt-4 rounded-2xl border border-amber-300 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300">
          ⚠️ {FRIENDS_DEPRECATION_MESSAGE}
        </p>
        <p className="mt-3 text-sm font-bold text-slate-500 dark:text-white/50">
          The old friends flow is intentionally kept in the codebase for possible
          future rollback.
        </p>
        <Link
          to="/home"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-5 py-2.5 text-sm font-black text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 transition-all duration-200 w-fit shadow-sm"
        >
          Back to Home 🏠
        </Link>
      </div>
    </div>
  );
}
