/** Actual route guard + access hook, fixture provider decisions, no school writes. */
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
import tailwindcss from "tailwindcss";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";
const repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "access-recovery-"));
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  server: ReturnType<typeof createServer> | undefined;
try {
  writeFileSync(
    join(temp, "index.html"),
    '<html dir="rtl"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>',
  );
  writeFileSync(
    join(temp, "auth.ts"),
    "export function useAuth(){return {user:window.accessFixture.user,loading:false};}",
  );
  writeFileSync(
    join(temp, "profile.ts"),
    "export function useProfile(){return {profile:null,error:null,loading:false};}",
  );
  writeFileSync(
    join(temp, "supabase.ts"),
    "export const supabase={auth:{signOut:async()=>{window.accessFixture.signouts++;window.accessFixture.user=null;window.renderAccess();}}};",
  );
  writeFileSync(
    join(temp, "access.ts"),
    `export {accessAfterCheck} from '${join(repo, "apps/web/src/lib/recessAccess.ts")}';
export const RECESS_RECHECK_MS=100;
export async function getPlaygroundAccessForUser(id){const f=window.accessFixture;f.checks++;if(f.hold)return new Promise(resolve=>f.waiting.push({id,resolve}));return structuredClone(f.next);}`,
  );
  writeFileSync(
    join(temp, "entry.tsx"),
    `import React,{useEffect} from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route}from'react-router-dom';import{Protected}from'${join(repo, "apps/web/src/components/Protected.tsx")}';import '${join(repo, "apps/web/src/index.css")}';
window.accessFixture={user:{id:'a'},next:{allowed:false,reason:'profile_error',message:'temporary'},checks:0,mounts:0,signouts:0,waiting:[],hold:false};
function Game(){useEffect(()=>{window.accessFixture.mounts++;},[]);return <div data-game><iframe title="Test game" srcDoc="<p>playing</p>"/><button type="button" onClick={(event)=>void event.currentTarget.parentElement.querySelector('iframe').requestFullscreen()}>Fullscreen iframe</button><button type="button" onClick={(event)=>void event.currentTarget.parentElement.requestFullscreen()}>Fullscreen wrapper</button></div>;}
const root=createRoot(document.querySelector('#root'));window.renderAccess=()=>root.render(<MemoryRouter><Routes><Route path="/" element={<Protected key={window.accessFixture.routeKey}><Game/></Protected>}/><Route path="/login" element={<p data-login>login</p>}/></Routes></MemoryRouter>);window.renderAccess();`,
  );
  await build({
    configFile: false,
    root: temp,
    logLevel: "error",
    esbuild: { jsx: "automatic" },
    css: {
      postcss: {
        plugins: [tailwindcss({
          ...((await import("../tailwind.config.js")).default),
          content: [join(repo, "apps/web/src/**/*.{ts,tsx}")],
        })],
      },
    },
    resolve: {
      alias: [
        { find: "@/lib/recessAccess", replacement: join(temp, "access.ts") },
        { find: "@/hooks/useAuth", replacement: join(temp, "auth.ts") },
        { find: "@/hooks/useProfile", replacement: join(temp, "profile.ts") },
        { find: "@/lib/supabase", replacement: join(temp, "supabase.ts") },
        { find: "@", replacement: join(repo, "apps/web/src") },
        { find: "react", replacement: join(repo, "node_modules/react") },
        {
          find: "react-dom",
          replacement: join(repo, "node_modules/react-dom"),
        },
        {
          find: "react-router-dom",
          replacement: join(repo, "node_modules/react-router-dom"),
        },
      ],
    },
    build: {
      target: "es2022",
      outDir: join(temp, "built"),
      commonjsOptions: {
        include: [/node_modules/, /packages\/game-logic\/dist/],
      },
    },
  });
  const assets = new Map<string, string>();
  function index(path: string, prefix = "") {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, item.name),
        key = prefix + "/" + item.name;
      if (item.isDirectory()) index(file, key);
      else assets.set(key, file);
    }
  }
  index(join(temp, "built"));
  server = createServer((req, res) => {
    const file = assets.get(req.url === "/" ? "/index.html" : (req.url ?? ""));
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
    );
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  browser = await launchSoftwareBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page
    .getByRole("button", { name: "בדיקה חוזרת", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => (window as any).accessFixture.signouts),
    0,
  );
  await page.evaluate(() => {
    (window as any).accessFixture.next = {
      allowed: true,
      role: "kid",
      expiresAt: Date.now() + 120000,
    };
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "בדיקה חוזרת")!
      .click();
  });
  await page.locator("[data-game]").waitFor();
  const warning = page.getByText("ההפסקה כמעט נגמרה!", { exact: true });
  const reopened = page.getByText("ההפסקה התחילה! אפשר לחזור לשחק.", { exact: true });
  assert.equal(await warning.count(), 0);
  assert.equal(await reopened.count(), 0);
  await page.evaluate(() => {
    const f = (window as any).accessFixture;
    f.next = { allowed: false, reason: "schedule_error", message: "temporary" };
    f.before = f.checks;
  });
  await page.waitForFunction(
    () =>
      (window as any).accessFixture.checks >
      (window as any).accessFixture.before + 1,
  );
  assert.equal(await page.locator("[data-game]").count(), 1);
  assert.equal(
    await page.evaluate(() => (window as any).accessFixture.mounts),
    1,
  );
  await page.getByRole("button", { name: "Fullscreen iframe" }).click();
  await page.waitForFunction(() => document.fullscreenElement?.tagName === "IFRAME");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(() => {
    (window as any).accessFixture.next = {
      allowed: true,
      role: "kid",
      expiresAt: Date.now() + 61000,
    };
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.runFor(500);
  assert.equal(await warning.count(), 0);
  await page.clock.runFor(500);
  await warning.waitFor();
  assert.equal(await warning.evaluate((text) => Boolean(text.closest(":popover-open"))), true);
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.getByRole("button", { name: "Fullscreen wrapper" }).click();
  await page.waitForFunction(() => document.fullscreenElement?.hasAttribute("data-game"));
  assert.equal(await page.locator("[data-game]").count(), 1);
  await page.getByRole("button", { name: "סגירת התראת הפסקה" }).click();
  await warning.waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => document.fullscreenElement?.hasAttribute("data-game")), true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    (window as any).accessFixture.routeKey = "remounted";
    (window as any).renderAccess();
  });
  await page.locator("[data-game]").waitFor();
  await page.clock.runFor(100);
  assert.equal(await warning.count(), 0);
  await page.clock.fastForward(60000);
  await page
    .getByRole("heading", { name: "זמן לחזור לכיתה" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => (window as any).accessFixture.signouts),
    0,
  );
  await page.evaluate(() => {
    (window as any).accessFixture.next = {
      allowed: true,
      role: "kid",
      expiresAt: Date.now() + 120000,
    };
  });
  await page.clock.runFor(100);
  await page.locator("[data-game]").waitFor();
  await reopened.waitFor();
  await page.clock.fastForward(6000);
  await reopened.waitFor({ state: "detached" });
  await page.clock.fastForward(54000);
  await warning.waitFor();
  await page.evaluate(() => {
    (window as any).accessFixture.hold = true;
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForFunction(
    () => (window as any).accessFixture.waiting.length > 0,
  );
  await page.evaluate(() => {
    const f = (window as any).accessFixture;
    f.hold = false;
    f.user = { id: "b" };
    f.next = {
      allowed: false,
      reason: "inactive_profile",
      message: "inactive",
    };
    (window as any).renderAccess();
  });
  await page.getByText("inactive", { exact: true }).waitFor();
  await page.evaluate(() => {
    for (const item of (window as any).accessFixture.waiting)
      item.resolve({
        allowed: true,
        role: "kid",
        expiresAt: Date.now() + 10000,
      });
  });
  await page.waitForTimeout(150);
  assert.equal(await page.locator("[data-game]").count(), 0);
  await page
    .getByRole("button", { name: "יציאה מהחשבון", exact: true })
    .click();
  await page.locator("[data-login]").waitFor();
  assert.equal(
    await page.evaluate(() => (window as any).accessFixture.signouts),
    1,
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      initialOutageRetry: true,
      backgroundOutagePreservesGame: true,
      localRecessCutoff: true,
      oneMinuteRecessWarning: true,
      dismissibleWarningRemainsClosed: true,
      automaticReopenConfirmation: true,
      automaticReopenWithoutLogin: true,
      staleAccountReplyIgnored: true,
      logoutOnlyExplicit: true,
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
