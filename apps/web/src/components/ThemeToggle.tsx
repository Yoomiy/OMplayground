import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/cn";

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition-all duration-200 outline-none",
        "hover:scale-105 active:scale-95",
        isLight
          ? "bg-amber-100/90 text-amber-950 hover:bg-amber-200/90 border border-amber-300/80 shadow-sm"
          : "bg-white/10 text-amber-300 hover:bg-white/15 border border-white/15 shadow-sm",
        className
      )}
      title={isLight ? "מעבר למצב לילה (חלל)" : "מעבר למצב יום (בהיר)"}
      aria-label={isLight ? "מעבר למצב לילה (חלל)" : "מעבר למצב יום (בהיר)"}
    >
      {isLight ? (
        <Moon className="size-4 shrink-0 transition-transform duration-300 group-hover:-rotate-12 text-indigo-600" aria-hidden />
      ) : (
        <Sun className="size-4 shrink-0 transition-transform duration-300 group-hover:rotate-45 text-amber-400" aria-hidden />
      )}
      {showLabel ? (
        <span className="text-xs font-black">
          {isLight ? "מצב לילה" : "מצב יום"}
        </span>
      ) : null}
    </button>
  );
}
