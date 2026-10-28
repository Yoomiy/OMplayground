import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--play-bg))] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700",
        outline:
          "border-2 border-slate-300 bg-white text-slate-800 shadow-play hover:bg-slate-50 active:bg-slate-100",
        ghost:
          "text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/80",
        destructive:
          "border-2 border-rose-300 bg-white text-rose-700 hover:bg-rose-50 active:bg-rose-100",
        muted:
          "bg-slate-200/80 text-slate-700 hover:bg-slate-300/90"
      },
      size: {
        default: "h-11 min-h-[44px] px-5 py-2",
        sm: "h-9 min-h-[36px] rounded-lg px-3 text-xs font-semibold",
        lg: "h-12 min-h-[48px] rounded-xl px-8 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
