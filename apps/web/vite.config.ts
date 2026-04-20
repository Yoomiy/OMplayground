import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@playground/game-logic": path.resolve(
        __dirname,
        "../../packages/game-logic/src/index.ts"
      )
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true
      }
    }
  }
});
