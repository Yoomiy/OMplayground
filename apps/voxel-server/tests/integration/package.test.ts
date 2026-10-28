import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  readdir,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packageRelease,
  runtimeInventory,
} from "../../tools/package-release.ts";

const execute = promisify(execFile);
const smokeTool = new URL("../../tools/smoke-package.mjs", import.meta.url);
test(
  "isolated production package installs only runtime dependencies, verifies integrity and drains without checkout files",
  { timeout: 120000 },
  async () => {
    const parent = await mkdtemp(join(tmpdir(), "voxel-production-package-")),
      root = join(parent, "runtime");
    try {
      const manifest = await packageRelease(root);
      await assert.rejects(packageRelease(root), { code: "EEXIST" });
      assert(manifest.files.length > 30);
      for (const { path } of manifest.files)
        assert(
          !/(?:^|\/)(?:\.env[^/]*|node_modules|evidence|test-results|__tests__)(?:\/|$)|\.test\./.test(
            path,
          ),
          path,
        );
      assert(
        !manifest.files.some((f) =>
          f.path.startsWith("games/voxel/engine/pkg/"),
        ),
      );
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const options = { cwd: root, timeout: 60000, maxBuffer: 4 * 1024 * 1024 };
      const common = [
        "ci",
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--offline",
      ];
      await execute(
        npm,
        [
          ...common,
          "--workspace",
          "@playground/voxel-server",
          "--workspace",
          "@playground/game-logic",
          "--workspace",
          "@playground/observability",
          "--include-workspace-root=false",
        ],
        options,
      );
      await execute(npm, [...common, "--prefix", "games/voxel"], options);
      for (const folder of ["node_modules", "games/voxel/node_modules"])
        for (const excluded of [
          "typescript",
          "jest",
          "playwright",
          "wasm-pack",
          "vite",
          "esbuild",
        ])
          assert(
            !(await readdir(join(root, folder))).includes(excluded),
            excluded,
          );
      await execute(
        process.execPath,
        [join(root, "verify-runtime.mjs")],
        options,
      );
      assert.deepEqual(
        await runtimeInventory(root),
        manifest.files,
        "Installing dependencies must not alter the runtime files",
      );
      const smoke = await execute(
        process.execPath,
        [smokeTool.pathname, root],
        options,
      );
      const report = JSON.parse(smoke.stdout);
      assert.equal(report.result, "PASS");
      assert.equal(report.buildId, manifest.buildId);
      assert.equal(report.schemaChecks, 8);
      for (const path of [
        "apps/voxel-server/src/service.ts",
        "games/voxel/dist-server/engine.wasm",
      ]) {
        const file = join(root, path),
          original = await readFile(file);
        try {
          await writeFile(
            file,
            Buffer.concat([original, Buffer.from("corrupt")]),
          );
          await assert.rejects(
            execute(
              process.execPath,
              [join(root, "verify-runtime.mjs")],
              options,
            ),
            /inventory mismatch/,
          );
        } finally {
          await writeFile(file, original);
        }
      }
      await execute(
        process.execPath,
        [join(root, "verify-runtime.mjs")],
        options,
      );
      const reports = new URL("../../test-results/", import.meta.url);
      await mkdir(reports, { recursive: true });
      await writeFile(
        new URL("production-package.json", reports),
        JSON.stringify(
          {
            ...report,
            node: process.versions.node,
            runtimeFiles: manifest.files.length,
            isolatedDirectory: true,
            productionDependenciesOnly: true,
            serviceCorruptionRejected: true,
            wasmCorruptionRejected: true,
            sourceSymlinks: false,
            containerQualified: false,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  },
);
