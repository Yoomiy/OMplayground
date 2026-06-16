import { cn } from "@/lib/cn";

/** Shared form field classes for auth and kid pages (Tailwind only). */
export const fieldInputClass = cn(
  "min-h-[44px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm",
  "placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200",
  "disabled:cursor-not-allowed disabled:bg-slate-100"
);

export const fieldLabelClass = "text-sm font-semibold text-slate-700";

/** Form styles tailored for the kid-facing dark theme / glassmorphic views. */
export const kidFieldInputClass = cn(
  "min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base font-bold text-white outline-none transition placeholder:text-white/40",
  "focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20",
  "disabled:cursor-not-allowed disabled:bg-white/5 disabled:opacity-50"
);

export const kidFieldLabelClass = "text-sm font-black text-white/80";

