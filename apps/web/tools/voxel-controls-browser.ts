/** Real VoxelSurface, fixture runtime: a confirmed Resume must stay busy until the world updates. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";
const repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-controls-"));
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  server: ReturnType<typeof createServer> | undefined;
try {
  writeFileSync(
    join(temp, "index.html"),
    '<html dir="rtl"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>',
  );
  writeFileSync(
    join(temp, "children.tsx"),
    "export const VoxelChat=()=>null,VoxelVoice=()=>null,VoxelModeration=()=>null,VoxelRoomControls=()=>null,VoxelHelp=()=>null;",
  );
  writeFileSync(
    join(temp, "runtime.ts"),
    `export const identity={buildId:'${"a".repeat(64)}'},content={items:[],blocks:[]},ITEM_LABELS={};
export async function mountVoxel(){const f=window.controlFixture;const r={command(){},dispose(){},subscribe(fn){f.publish=fn;fn(f.hud);return()=>{};},itemIcon(){return null;},debug(){return{};},voiceScene(){return null;}};return r;}
export const mountTouchControls=()=>({dispose(){}}),mountInventoryControls=()=>({dispose(){}});`,
  );
  writeFileSync(
    join(temp, "entry.tsx"),
    `import React from 'react';import{createRoot}from'react-dom/client';import{VoxelSurface}from'${join(repo, "apps/web/src/game/voxel/VoxelSurface.tsx")}';
const f=window.controlFixture={calls:0,resolve:null,publish:null,hud:{mode:'creative',role:'participant',status:'paused',lifecycle:'paused',worldPauseReason:'session',graphics:'ready',inputMode:'desktop',hotbar:[],selectedSlot:0,selected:0,inventoryOpen:false,message:'paused',environment:{hour:12,rain:false,daytime:true},effectsAvailable:false}};
const api={socketUrl:'ws://localhost/voxel',control(){f.calls++;return new Promise(resolve=>f.resolve=resolve);}};
createRoot(document.querySelector('#root')).render(<VoxelSurface api={api} session={{id:'room',hostId:'kid',hostName:'kid',status:'paused',connected:[],presenceUntil:0}} userId="kid" isStaff={false} canChoosePlayer={false} onExit={()=>{}}/>);`,
  );
  await build({
    configFile: false,
    root: temp,
    logLevel: "error",
    esbuild: { jsx: "automatic" },
    resolve: {
      alias: [
        {
          find: "@playground/voxel-runtime",
          replacement: join(temp, "runtime.ts"),
        },
        ...[
          "VoxelChat",
          "VoxelVoice",
          "VoxelModeration",
          "VoxelRoomControls",
          "VoxelHelp",
        ].map((name) => ({
          find: "./" + name,
          replacement: join(temp, "children.tsx"),
        })),
        { find: "@", replacement: join(repo, "apps/web/src") },
        { find: "react", replacement: join(repo, "node_modules/react") },
        {
          find: "react-dom",
          replacement: join(repo, "node_modules/react-dom"),
        },
      ],
    },
    build: { target: "es2022", outDir: join(temp, "built") },
  });
  const files = new Map<string, string>();
  const index = (path: string, prefix = "") => {
    for (const e of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, e.name),
        key = prefix + "/" + e.name;
      if (e.isDirectory()) index(file, key);
      else files.set(key, file);
    }
  };
  index(join(temp, "built"));
  server = createServer((req, res) => {
    const file = files.get(req.url === "/" ? "/index.html" : (req.url ?? ""));
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  browser = await launchSoftwareBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  const controls = page.getByRole("navigation", { name: "ניהול המפגש" }),
    resume = controls.getByRole("button", { name: "המשך", exact: true });
  await resume.waitFor();
  await resume.click();
  assert.equal(await resume.isDisabled(), true);
  await page.evaluate(() => {
    const f = (window as any).controlFixture;
    f.resolve({ current: true });
  });
  await page
    .getByText("פעולת החידוש אושרה. ממתינים לעדכון העולם…", { exact: true })
    .waitFor();
  assert.equal(await resume.isDisabled(), true);
  await resume.evaluate((button: HTMLButtonElement) => button.click());
  assert.equal(
    await page.evaluate(() => (window as any).controlFixture.calls),
    1,
  );
  await page.evaluate(() => {
    const f = (window as any).controlFixture;
    f.hud = { ...f.hud, lifecycle: "playing", worldPauseReason: null };
    f.publish(f.hud);
  });
  const pause = controls.getByRole("button", { name: "השהה", exact: true });
  await pause.waitFor();
  await page
    .getByText("המפגש חודש. לחצו על כניסה לעולם כדי להמשיך.", { exact: true })
    .waitFor();
  assert.equal(await pause.isDisabled(), false);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      requestPending: true,
      receiptWaitsForWorld: true,
      duplicateResumeBlocked: true,
      worldUpdateCompletesControl: true,
    }),
  );
} finally {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  rmSync(temp, { recursive: true, force: true });
}
