import { Link } from "react-router-dom";
import { FRIENDS_DEPRECATION_MESSAGE } from "@/lib/friendsDeprecation";

export function FriendsDeprecatedPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-20 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-black text-white">Friends is deprecated</h1>
        <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
          ⚠️ {FRIENDS_DEPRECATION_MESSAGE}
        </p>
        <p className="mt-3 text-sm font-bold text-white/50">
          The old friends flow is intentionally kept in the codebase for possible
          future rollback.
        </p>
        <Link
          to="/home"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white hover:-translate-y-0.5 transition-all duration-200 w-fit"
        >
          Back to Home 🏠
        </Link>
      </div>
    </div>
  );
}
