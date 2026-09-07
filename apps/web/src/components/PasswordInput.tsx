import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { kidFieldInputClass } from "@/lib/fieldStyles";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

/** A theme-aware password input with a local visibility control. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(kidFieldInputClass, "pl-12", className)}
      />
      <button
        type="button"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
