import "@/utils/diagnostics";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PlaygroundUserProvider } from "@/hooks/usePlaygroundUser";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installGlobalTelemetry } from "@/utils/telemetry";
import App from "./App";
import "./index.css";

installGlobalTelemetry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PlaygroundUserProvider>
            <App />
          </PlaygroundUserProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
