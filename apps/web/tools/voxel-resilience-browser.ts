import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import {
  createBuiltHarness,
  launchSoftwareBrowser,
} from "../../../games/voxel/tools/browser-harness.ts";
import { developmentAdmission } from "../../../games/voxel/tools/development-admission.ts";
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const web = fileURLToPath(new URL("../", import.meta.url));
const resolve = createRequire(new URL("../package.json", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "voxel-react-resilience-"));
const user = randomUUID(),
  room = randomUUID(),
  host = randomUUID(),
  message = randomUUID();
writeFileSync(
  join(temp, "auth.ts"),
  `export const useAuth=()=>({user:{id:'${user}'}}); export const useProfile=()=>({profile:{role:'teacher'}}); export const useIsAdmin=()=>({isAdmin:false}); export const getVoxelRuntimeUrl=()=>location.origin; export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{id:'${user}'}}}})}};`,
);
writeFileSync(
  join(temp, "bridge.ts"),
  `import * as real from '${repo}/games/voxel/src/client/embed.ts'; export * from '${repo}/games/voxel/src/client/embed.ts';export async function mountVoxel(...args){const r=await real.mountVoxel(...args);window.surfaceRuntime=r;window.mountCount=(window.mountCount??0)+1;return r;}`,
);
writeFileSync(
  join(temp, "entry.tsx"),
  `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{VoxelSessionContainer}from'${web}/src/game/voxel/VoxelSessionContainer.tsx';const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={['/play/${room}?mode=player']}><VoxelSessionContainer sessionId='${room}'/></MemoryRouter>);window.unmountFixture=()=>root.unmount();`,
);
writeFileSync(
  join(temp, "index.html"),
  `<!doctype html><html dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>`,
);
const initial = process.env.NODE_ENV;
await build({
  configFile: false,
  root: temp,
  base: "/react/",
  plugins: [react()],
  logLevel: "error",
  resolve: {
    alias: {
      "@/hooks/useAuth": join(temp, "auth.ts"),
      "@/hooks/useProfile": join(temp, "auth.ts"),
      "@/hooks/useIsAdmin": join(temp, "auth.ts"),
      "@/lib/supabase": join(temp, "auth.ts"),
      "@/lib/voxelRuntimeUrl": join(temp, "auth.ts"),
      "@playground/voxel-runtime": join(temp, "bridge.ts"),
      "@": join(web, "src"),
      "react-dom": dirname(resolve.resolve("react-dom/package.json")),
      react: dirname(resolve.resolve("react/package.json")),
      "react-router-dom": dirname(
        resolve.resolve("react-router-dom/package.json"),
      ),
    },
  },
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  worker: { format: "es" },
  build: {
    target: "es2022",
    outDir: join(temp, "built"),
    rollupOptions: { input: join(temp, "index.html") },
  },
});
if (initial === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = initial;
const assets: Record<string, Uint8Array> = {};
function index(dir: string, prefix = "/react") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name),
      name = prefix + "/" + entry.name;
    if (entry.isDirectory()) index(path, name);
    else assets[name] = readFileSync(path);
  }
}
index(join(temp, "built"));
assets["/react/"] = assets["/react/index.html"];
let failed = false,
  sessionCalls = 0,
  chatCalls = 0,
  voiceCalls = 0;
const errors: string[] = [];
const actor = {
  id: user,
  role: "participant" as const,
  capabilities: {
    build: true,
    fly: true,
    observe: false,
    combat: true,
    explosives: true,
  },
};
const unavailable = (res: any) => {
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "UNAVAILABLE" }));
};
const { gateway, origin } = await createBuiltHarness(
  { seed: 4242 },
  async () => developmentAdmission(actor),
  undefined,
  undefined,
  {
    clientAssets: assets,
    api: {
      "/api/voxel/session": async (_req, _body, res) => {
        sessionCalls++;
        if (failed) {
          unavailable(res);
          return;
        }
        return {
          id: room,
          host_id: host,
          host_name: "Fixture host",
          status: "playing",
          connected_player_ids: [host],
          connected_player_names: ["Cached player"],
          voxel_presence_expires_at: new Date(Date.now() + 60000).toISOString(),
        };
      },
      "/api/voxel/chat-history": async (_req, _body, res) => {
        chatCalls++;
        if (failed) {
          unavailable(res);
          return;
        }
        return {
          messages: [
            {
              id: message,
              sequence: 1,
              senderId: user,
              senderName: "Fixture player",
              message: "Previously loaded message",
              at: new Date().toISOString(),
            },
          ],
          before: null,
        };
      },
      "/api/voxel/voice-token": async (_req, _body, res) => {
        voiceCalls++;
        unavailable(res);
      },
      "/api/voxel/diagnostics": async () => ({ ok: true }),
    },
  },
);
const browser = await launchSoftwareBrowser();
const deadline = setTimeout(() => void browser.close(), 120000);
const report: any = { result: "RUNNING" };
try {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 900, height: 650 },
  });
  await context.addInitScript(() => {
    const evidence = { starts: 0, peak: 0 };
    (window as any).recordedAudioEvidence = evidence;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const result = start.apply(this, args);
      if (this.loop || !this.buffer) return result;
      evidence.starts++;
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 1024;
      const silent = this.context.createGain();
      silent.gain.value = 0;
      this.connect(analyser);
      analyser.connect(silent).connect(this.context.destination);
      const samples = new Float32Array(analyser.fftSize);
      const poll = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        for (const value of samples)
          evidence.peak = Math.max(evidence.peak, Math.abs(value));
      }, 10);
      this.addEventListener(
        "ended",
        () => {
          clearInterval(poll);
          analyser.disconnect();
          silent.disconnect();
        },
        { once: true },
      );
      return result;
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/react/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => (window as any).surfaceRuntime?.debug().phase === "playing",
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() =>
    (window as any).surfaceRuntime.command({ type: "resume" }),
  );
  await page.waitForFunction(
    () => (window as any).surfaceRuntime.debug().body.frozen === 0,
  );
  await page
    .locator("option")
    .filter({ hasText: "Cached player" })
    .waitFor({ state: "attached" });
  await page.locator(".voxel-session__chat-toggle").click();
  await page.getByText("Previously loaded message", { exact: true }).waitFor();
  const callsBefore = chatCalls;
  failed = true;
  await page.waitForFunction(
    () => document.querySelector(".voxel-session-metadata-error") !== null,
    null,
    { timeout: 25000 },
  );
  await page
    .getByText("לא ניתן לטעון את הצ׳אט כעת.", { exact: true })
    .waitFor({ timeout: 15000 });
  assert(chatCalls > callsBefore);
  assert(sessionCalls >= 2);
  assert(voiceCalls > 0);
  assert.equal(
    await page.getByText("Previously loaded message", { exact: true }).count(),
    1,
    "failed chat refresh preserves messages",
  );
  assert.equal(
    await page.getByText("Cached player", { exact: true }).count(),
    1,
    "failed metadata refresh preserves presence until its TTL",
  );
  assert.equal(
    await page.evaluate(() => (window as any).mountCount),
    1,
    "optional failures do not remount the world",
  );
  await page.locator(".voxel-session__chat-toggle").click();
  await page.evaluate(() =>
    (window as any).surfaceRuntime.command({ type: "resume" }),
  );
  await page.waitForFunction(
    () => (window as any).surfaceRuntime.debug().body.frozen === 0,
  );
  const before = await page.evaluate(() =>
    (window as any).surfaceRuntime.debug(),
  );
  await page.evaluate(() =>
    (window as any).surfaceRuntime.command({
      type: "touch",
      x: 1,
      z: 0,
      jump: false,
      sneak: false,
      sprint: false,
    }),
  );
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    (window as any).surfaceRuntime.command({
      type: "touch",
      x: 0,
      z: 0,
      jump: false,
      sneak: false,
      sprint: false,
    }),
  );
  const after = await page.evaluate(() =>
    (window as any).surfaceRuntime.debug(),
  );
  assert(
    after.position.some(
      (v: number, i: number) => Math.abs(v - before.position[i]) > 0.05,
    ),
    "gameplay continues",
  );
  assert.equal(after.actorId, before.actorId);
  assert.equal(after.worldId, before.worldId);
  await page.waitForFunction(
    () => {
      const evidence = (window as any).recordedAudioEvidence;
      return evidence.starts > 0 && evidence.peak > 0.00001;
    },
    null,
    { timeout: 5000 },
  );
  report.recordedAudio = await page.evaluate(
    () => (window as any).recordedAudioEvidence,
  );
  failed = false;
  await page.waitForFunction(
    () => document.querySelector(".voxel-session-metadata-error") === null,
    null,
    { timeout: 25000 },
  );
  assert.equal(await page.evaluate(() => (window as any).mountCount), 1);
  await page.evaluate(() => (window as any).unmountFixture());
  await page.waitForFunction(
    () => (window as any).surfaceRuntime.debug().disposed,
  );
  await page.waitForFunction(
    () => (window as any).surfaceRuntime.debug().audio.contexts === 0,
  );
  assert.deepEqual(errors, []);
  Object.assign(report, {
    result: "PASS",
    sessionCalls,
    chatCalls,
    voiceCalls,
    errors,
  });
} catch (error) {
  Object.assign(report, {
    result: "FAIL",
    error: error instanceof Error ? error.stack : String(error),
    errors,
  });
  throw error;
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
  mkdirSync(join(web, "test-results"), { recursive: true });
  writeFileSync(
    join(web, "test-results/voxel-resilience-browser.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
