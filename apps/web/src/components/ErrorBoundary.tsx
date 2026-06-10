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
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-slate-800">
          <h1 className="text-xl font-semibold">משהו השתבש</h1>
          <p className="max-w-md text-sm text-slate-600">
            אירעה שגיאה בלתי צפויה. רענן את הדף או חזור למסך הבית.
          </p>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
            onClick={() => window.location.assign("/home")}
          >
            חזרה לבית
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
