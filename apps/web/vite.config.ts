import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin as EsbuildPlugin } from "esbuild";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const viteConfigDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * noa-engine imports deep paths like `@babylonjs/core/Meshes/transformNode`
 * without the `.js` suffix. Babylon's package is native ESM (`"type":"module"`)
 * with no `exports` map, so Rollup's production resolver does not append `.js`.
 * Map those specifiers to the real files on disk.
 */
function resolveBabylonCoreJsFile(source: string): string | null {
  if (!source.startsWith("@babylonjs/core/")) return null;
  if (source.endsWith(".js") || source.endsWith(".wasm")) return null;
  const rel = source.slice("@babylonjs/core/".length);
  if (!rel || rel.includes("\0")) return null;
  const filePath = `${rel}.js`;
  const candidates = [
    path.join(viteConfigDir, "node_modules", "@babylonjs/core", filePath),
    path.join(
      viteConfigDir,
      "..",
      "..",
      "node_modules",
      "@babylonjs/core",
      filePath
    )
  ];
  for (const abs of candidates) {
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function babylonCoreSubpathJs(): Plugin {
  return {
    name: "babylon-core-unprefixed-subpath-js",
    enforce: "pre",
    resolveId(source) {
      return resolveBabylonCoreJsFile(source);
    }
  };
}

/**
 * `optimizeDeps` is handled by esbuild, which does not run Vite `resolveId` hooks.
 * Mirror the same Babylon subpath → `.js` file mapping during pre-bundling.
 */
function babylonCoreSubpathEsbuild(): EsbuildPlugin {
  return {
    name: "babylon-core-unprefixed-subpath-js-esbuild",
    setup(build) {
      build.onResolve({ filter: /^@babylonjs\/core\// }, (args) => {
        const file = resolveBabylonCoreJsFile(args.path);
        if (file) return { path: file };
      });
    }
  };
}

export default defineConfig({
  plugins: [babylonCoreSubpathJs(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(viteConfigDir, "src"),
      "@playground/game-logic": path.resolve(
        viteConfigDir,
        "../../packages/game-logic/src/index.ts"
      ),
      "@playground/voxel-content": path.resolve(
        viteConfigDir,
        "../../packages/voxel-content/src/index.ts"
      )
    }
  },
  // noa-engine + Babylon are heavy and contain CJS-style imports. Pre-bundle them
  // so Vite serves a single ESM module per package and we don't pay a 200+
  // request stall on the Minecraft route in dev.
  optimizeDeps: {
    include: ["noa-engine", "@babylonjs/core"],
    esbuildOptions: {
      plugins: [babylonCoreSubpathEsbuild()]
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/react-router") || id.includes("node_modules/@remix-run/router")) {
            return "router-vendor";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "supabase-vendor";
          }
          if (id.includes("node_modules/socket.io-client")) {
            return "socket-vendor";
          }
        }
      }
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
