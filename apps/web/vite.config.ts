import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    port: 5173
  }
});
