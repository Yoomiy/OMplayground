import { cn } from "@/lib/cn";

/** Shared form field classes for auth and kid pages (Tailwind only). */
export const fieldInputClass = cn(
  "min-h-[44px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm",
  "placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200",
  "disabled:cursor-not-allowed disabled:bg-slate-100"
);

export const fieldLabelClass = "text-sm font-semibold text-slate-700";
