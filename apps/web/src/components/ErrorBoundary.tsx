import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportTelemetry } from "@/utils/telemetry";

interface Props {
  children: ReactNode;
  scope?: string;
  title?: string;
  compact?: boolean;
  className?: string;
  resetKey?: string;
  onReset?: () => void;
  onHome?: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(previous: Props): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  retry = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportTelemetry({
      level: "error",
      message: error.message,
      stack: error.stack,
      context: {
        appArea: "react-boundary",
        scope: this.props.scope ?? "app",
        componentStack: info.componentStack?.slice(0, 2000),
      },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <section
            role="alert"
            dir="rtl"
            className={
              this.props.className ??
              "rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-white"
            }
          >
            <p className="font-bold">{this.props.title ?? "לא ניתן להציג את האזור הזה כרגע"}</p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-2 rounded-lg border border-current/20 px-3 py-2 font-bold"
            >
              נסו שוב
            </button>
          </section>
        );
      }
      return (
        <div
          role="alert"
          dir="rtl"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white"
        >
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-md w-full">
            <span className="text-5xl block mb-4 animate-kid-float">⚠️</span>
            <h1 className="text-2xl font-black text-white">
              {this.props.title ?? "לא ניתן להציג את המסך כרגע"}
            </h1>
            <p className="mt-2 text-sm font-semibold text-white/70">
              אפשר לנסות שוב או לעבור למסך הבית.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 text-sm font-black text-white hover:shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 transition duration-200"
              onClick={this.retry}
            >
              נסו שוב
            </button>
            {this.props.onHome ? (
              <button
                type="button"
                className="mt-4 text-sm underline"
                onClick={() => {
                  this.props.onHome?.();
                  this.retry();
                }}
              >
                חזרה לבית
              </button>
            ) : (
              <a href="/home" className="mt-4 inline-block text-sm underline">
                חזרה לבית
              </a>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
