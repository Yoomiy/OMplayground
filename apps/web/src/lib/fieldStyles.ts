import { cn } from "@/lib/cn";

/** Shared form field classes for auth and kid pages (Tailwind only). */
export const fieldInputClass = cn(
  "min-h-[44px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm",
  "placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200",
  "disabled:cursor-not-allowed disabled:bg-slate-100"
);

export const fieldLabelClass = "text-sm font-semibold text-slate-700";

/** Form styles tailored for the kid-facing views with light and dark theme support. */
export const kidFieldInputClass = cn(
  "min-h-[44px] w-full rounded-2xl px-4 py-3 text-base font-bold outline-none transition",
  "border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm",
  "focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15",
  "dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:shadow-none",
  "dark:focus:border-violet-400 dark:focus:ring-violet-500/20",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-white/5"
);

export const kidFieldLabelClass = "text-sm font-black text-slate-700 dark:text-white/80";

