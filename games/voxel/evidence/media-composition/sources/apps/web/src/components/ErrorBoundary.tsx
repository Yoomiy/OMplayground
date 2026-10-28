import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportTelemetry } from "@/utils/telemetry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportTelemetry(
      {
        level: "error",
        message: error.message,
        stack: error.stack,
        context: {
          appArea: "react-boundary",
          componentStack: info.componentStack?.slice(0, 2000)
        }
      },
      "game-server"
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-md w-full">
            <span className="text-5xl block mb-4 animate-kid-float">⚠️</span>
            <h1 className="text-2xl font-black text-white">משהו השתבש</h1>
            <p className="mt-2 text-sm font-semibold text-white/70">
              אירעה שגיאה בלתי צפויה. רעננו את הדף או חזרו למסך הבית.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 text-sm font-black text-white hover:shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 transition duration-200"
              onClick={() => window.location.assign("/home")}
            >
              חזרה לבית 🚀
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
