import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { developmentProxies } from "./tools/dev-proxy.ts";

const viteConfigDir = path.dirname(fileURLToPath(import.meta.url));

/** The rewritten client must not pull old voxel code or authority into its bundle. */
function voxelBrowserBoundary(report = false): Plugin {
  let building = false;
  return {
    name: "voxel-browser-boundary",
    configResolved(config) {
      building = config.command === "build";
    },
    buildStart() {
      if (!report || !building) return;
      try {
        execFileSync(
          process.execPath,
          [
            path.resolve(
              viteConfigDir,
              "../../games/voxel/tools/verify-release.mjs",
            ),
          ],
          { stdio: "pipe" },
        );
      } catch {
        this.error(
          "Voxel artifacts are stale or missing. Run npm run build:voxel before building the app.",
        );
      }
    },
    generateBundle(_options, bundle) {
      const gameModules = new Set<string>();
      for (const output of Object.values(bundle))
        if (output.type === "chunk")
          for (const id of Object.keys(output.modules)) {
            const normalized = id.replaceAll("\\", "/");
            if (
              /\/games\/voxel\/src\/(?:server|sim)\/|\/apps\/voxel-server\/src\/|noa-engine|@babylonjs|\/src\/game\/MinecraftSessionContainer|\/src\/games\/MinecraftClient|\/src\/games\/voxel\//.test(
                normalized,
              )
            )
              this.error("Forbidden voxel/browser module: " + id);
            if (normalized.includes("/games/voxel/src/"))
              gameModules.add(normalized);
          }
      if (report) {
        if (!gameModules.size) this.error("Missing rewritten voxel client");
        this.emitFile({
          type: "asset",
          fileName: "voxel-browser-boundary.json",
          source: JSON.stringify({
            result: "PASS",
            gameModules: gameModules.size,
            forbiddenModules: 0,
          }),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [voxelBrowserBoundary(true), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(viteConfigDir, "src"),
      "@playground/voxel-runtime": path.resolve(
        viteConfigDir,
        "../../games/voxel/src/client/embed.ts",
      ),
      "@playground/game-logic": path.resolve(
        viteConfigDir,
        "../../packages/game-logic/src/index.ts",
      ),
    },
  },
  worker: { format: "es", plugins: () => [voxelBrowserBoundary()] },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@remix-run/router")
          ) {
            return "router-vendor";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "supabase-vendor";
          }
          if (id.includes("node_modules/socket.io-client")) {
            return "socket-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: developmentProxies(),
  },
});
