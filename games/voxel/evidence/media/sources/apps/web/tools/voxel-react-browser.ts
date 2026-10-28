import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";
import { loadServerRelease } from "../../voxel-server/src/release.ts";
import {
  PostgresTestDatabase,
  literal,
} from "../../voxel-server/tests/helpers/postgres.ts";
import { supabaseWire } from "../../voxel-server/tests/helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../../voxel-server/tests/helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../voxel-server/src/supabase-persistence.ts";
import { SupabaseSessions } from "../../voxel-server/src/supabase-sessions.ts";
import {
  SupabaseControls,
  schoolControl,
} from "../../voxel-server/src/school-control.ts";
import { schoolGatewayPolicy } from "../../voxel-server/src/school-admission.ts";
import {
  SupabaseStaff,
  schoolStaff,
} from "../../voxel-server/src/school-staff.ts";
import { schoolRosterApi } from "../../voxel-server/src/school-roster.ts";
import {
  SupabaseModeration,
  schoolModerationApi,
} from "../../voxel-server/src/school-moderation.ts";
import { schoolSessionApi } from "../../voxel-server/src/school-session.ts";
import {
  SupabaseChat,
  schoolChatApi,
} from "../../voxel-server/src/school-chat.ts";

const web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "voxel-react-browser-")),
  root = pathToFileURL(temp + "/"),
  resolve = createRequire(new URL("../package.json", import.meta.url));
let db!: PostgresTestDatabase;
let wire: Awaited<ReturnType<typeof supabaseWire>> | undefined,
  gateway:
    | Awaited<
        ReturnType<
          Awaited<ReturnType<typeof loadServerRelease>>["createGateway"]
        >
      >
    | undefined,
  browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
try {
  db = new PostgresTestDatabase();
  db.installSessionControls();
  const room = db.session(),
    kid = randomUUID(),
    teacher = randomUUID(),
    game = randomUUID();
  db.exec(
    `INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES(${literal(kid)},'תלמיד','boy','ג','kid'),(${literal(teacher)},'מורה','girl',NULL,'teacher');UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(kid)},host_name='תלמיד',host_grade='ג',gender='boy',player_ids=ARRAY[${literal(kid)}]::uuid[],player_names=ARRAY['תלמיד'] WHERE id=${literal(room)}`,
  );
  wire = await supabaseWire(db);
  const mobileRoom = db.session();
  db.exec(
    `UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(kid)},host_name='תלמיד',host_grade='ג',gender='boy',player_ids=ARRAY[${literal(kid)}]::uuid[],player_names=ARRAY['תלמיד'] WHERE id=${literal(mobileRoom)}`,
  );
  const school = schoolSqlFixture(db, [room, mobileRoom], [kid, teacher]),
    client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    }),
    backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    commands = new SupabaseControls(client),
    staff = new SupabaseStaff(client),
    moderation = new SupabaseModeration(client),
    chat = new SupabaseChat(client),
    runtime = await loadServerRelease();
  const fixture = {
    room,
    kid,
    teacher,
    tokens: { kid: school.token(kid), teacher: school.token(teacher) },
  };
  const source = `import React,{StrictMode,useEffect,useMemo,useState} from 'react';
 import{createRoot}from'react-dom/client';
 import{VoxelSurface}from'@/game/voxel/VoxelSurface';
 import{createVoxelApi}from'@/game/voxel/session-api';
 const config=${JSON.stringify(fixture)};config.room=new URL(location.href).searchParams.get('room')??config.room;
 function App(){
  const role=new URL(location.href).searchParams.get('role')==='teacher'?'teacher':'kid',id=config[role];
  const api=useMemo(()=>createVoxelApi({serverUrl:location.origin,room:config.room,getToken:async()=>config.tokens[role]}),[]);
  const[shown,setShown]=useState(true),[session,setSession]=useState(null),[departureId]=useState(()=>crypto.randomUUID()),[left,setLeft]=useState(false);
  useEffect(()=>{window.strictEffects=(window.strictEffects??0)+1;const abort=new AbortController();let running=false,ended=false;
   const refresh=async()=>{if(running||ended)return;running=true;try{const value=await api.session(abort.signal);if(!abort.signal.aborted){setSession(value);ended=value.status==='completed';}}catch{}finally{running=false;}};
   void refresh();const timer=setInterval(refresh,1000);return()=>{abort.abort();clearInterval(timer);};},[api]);
  return shown?<VoxelSurface api={api} session={session} userId={id} isStaff={role==='teacher'} canChoosePlayer={false} onExit={()=>{window.exitCalls=(window.exitCalls??0)+1;setShown(false);}} onRuntime={r=>{window.surfaceRuntime=r;window.readyCount=(window.readyCount??0)+1;return()=>{window.disposedRuntime=r;};}}/>:<main dir='rtl'><p>המפגש נסגר</p><button onClick={()=>setShown(true)}>כניסה חוזרת</button><button disabled={left} onClick={async()=>{window.rosterReceipt=await api.leave(departureId);setLeft(true);}}>עזיבת הסגל</button>{left&&<p>ההשתתפות במפגש הוסרה</p>}</main>;
 }
 createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);`;
  writeFileSync(new URL("entry.tsx", root), source);
  writeFileSync(
    new URL("index.html", root),
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>`,
  );
  await viteBuild({
    configFile: false,
    root: temp,
    base: "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": join(web, "src"),
        "@playground/voxel-runtime": join(
          repo,
          "games/voxel/src/client/embed.ts",
        ),
        "react-dom": dirname(resolve.resolve("react-dom/package.json")),
        react: dirname(resolve.resolve("react/package.json")),
      },
    },
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    worker: { format: "es" },
    build: {
      target: "es2022",
      outDir: join(temp, "built"),
      emptyOutDir: true,
      minify: false,
      rollupOptions: { input: join(temp, "index.html") },
    },
  });
  const assets = new Map<string, string>();
  const index = (path: string, prefix = "") => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const name = prefix + "/" + entry.name,
        file = join(path, entry.name);
      if (entry.isDirectory()) index(file, name);
      else assets.set(name, file);
    }
  };
  index(join(temp, "built"));
  const events: {
    event: string;
    context: Record<string, string | number | boolean>;
  }[] = [];
  gateway = await runtime.createGateway({
    build: runtime.build,
    content: runtime.content,
    ...schoolGatewayPolicy(school.access, sessions),
    persistence: { objects: backend, metadata: backend },
    control: (req, body, res) =>
      body && typeof body === "object" && "command" in body
        ? schoolStaff(school.access, staff)(req, body, res)
        : schoolControl(school.access, commands)(req, body, res),
    api: {
      ...schoolChatApi(school.access, chat, (event, context) =>
        events.push({ event, context }),
      ),
      ...schoolModerationApi(school.access, moderation, (event, context) =>
        events.push({ event, context }),
      ),
      ...schoolSessionApi(school.access, client, (event, context) =>
        events.push({ event, context }),
      ),
      ...schoolRosterApi(school.access, client, (event, context) =>
        events.push({ event, context }),
      ),
    },
    worldDefaults: { mode: "survival" },
    handleClient(req, res) {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (path === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      const file = assets.get(path === "/" ? "/index.html" : path);
      if (!file) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".wasm")
              ? "application/wasm"
              : "text/html",
        "Cache-Control": "no-store",
      });
      res.end(readFileSync(file));
    },
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  browser = await launchSoftwareBrowser();
  browser.on("disconnected", () =>
    console.log("React fixture browser disconnected"),
  );
  const errors: string[] = [],
    expectedNetworkErrors: string[] = [],
    failedControlResponses: { action: string; requestId: string }[] = [],
    controlRequests: { action: string; requestId: string }[] = [],
    moderationRequests: { action: string; requestId: string }[] = [],
    failedModerationResponses: { action: string; requestId: string }[] = [],
    chatSendRequests: string[] = [],
    failedChatResponses: string[] = [],
    bannedAdmissionResponses: string[] = [],
    bannedSessionResponses: string[] = [],
    admissions: string[] = [];
  let teacherUnloads = 0;
  deadline = setTimeout(() => {
    console.error("React voxel browser exceeded 240 seconds");
    void browser?.close();
  }, 240000);
  const kidContext = await browser.newContext({
      viewport: { width: 900, height: 650 },
    }),
    teacherContext = await browser.newContext({
      viewport: { width: 800, height: 600 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
  const kidPage = await kidContext.newPage(),
    teacherPage = await teacherContext.newPage();
  for (const page of [kidPage, teacherPage]) {
    page.setDefaultTimeout(20000);
    page.on("crash", () => console.error("React fixture page crashed"));
    if (page === teacherPage)
      page.on("websocket", (socket) =>
        socket.on("framereceived", (frame) => {
          if (typeof frame.payload === "string") {
            try {
              if (JSON.parse(frame.payload).type === "unload") teacherUnloads++;
            } catch {}
          }
        }),
      );
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("React fixture page error", error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        if (
          message.text() ===
            "Failed to load resource: the server responded with a status of 503 (Service Unavailable)" &&
          (message.location().url.endsWith("/api/voxel/control") ||
            message.location().url.endsWith("/api/voxel/moderation") ||
            message.location().url.endsWith("/api/voxel/chat-send"))
        )
          expectedNetworkErrors.push(message.text());
        else if (
          message.text() ===
            "Failed to load resource: the server responded with a status of 403 (Forbidden)" &&
          (message.location().url.endsWith("/api/voxel/admission") ||
            message.location().url.endsWith("/api/voxel/session"))
        )
          expectedNetworkErrors.push(message.text());
        else errors.push(`${message.text()} (${message.location().url})`);
      }
    });
    page.on("response", (response) => {
      if (
        response.status() === 503 &&
        response.url().endsWith("/api/voxel/chat-send")
      )
        failedChatResponses.push(response.request().postDataJSON().requestId);
      if (
        response.status() === 503 &&
        response.url().endsWith("/api/voxel/moderation")
      ) {
        const value = response.request().postDataJSON();
        failedModerationResponses.push({
          action: value.action,
          requestId: value.requestId,
        });
      }
      if (
        response.status() === 403 &&
        (response.url().endsWith("/api/voxel/admission") ||
          response.url().endsWith("/api/voxel/session"))
      ) {
        void response
          .json()
          .then((value) => {
            assert.equal(value.error, "BANNED");
            (response.url().endsWith("/api/voxel/admission")
              ? bannedAdmissionResponses
              : bannedSessionResponses
            ).push(value.error);
          })
          .catch((error) => errors.push(error.message));
      }
      if (
        response.status() === 503 &&
        response.url().endsWith("/api/voxel/control")
      ) {
        const v = response.request().postDataJSON();
        failedControlResponses.push({
          action: v.action,
          requestId: v.requestId,
        });
      }
    });
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/voxel/chat-send")
      )
        chatSendRequests.push(request.postDataJSON().requestId);
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/voxel/moderation")
      ) {
        const value = request.postDataJSON();
        moderationRequests.push({
          action: value.action,
          requestId: value.requestId,
        });
      }
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/voxel/control")
      ) {
        const v = request.postDataJSON();
        controlRequests.push({ action: v.action, requestId: v.requestId });
      }
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/voxel/admission")
      )
        admissions.push(page === kidPage ? "kid" : "teacher");
    });
  }
  let releaseWasm!: () => void, wasmRequested!: () => void;
  const held = new Promise<void>((r) => (releaseWasm = r)),
    requested = new Promise<void>((r) => (wasmRequested = r));
  await kidContext.route("**/*.wasm", async (route) => {
    wasmRequested();
    await held;
    await route.continue();
  });
  await kidPage.goto(origin + "/?role=kid", { waitUntil: "domcontentloaded" });
  await Promise.race([
    requested,
    kidPage.waitForTimeout(30000).then(() => {
      throw new Error("React fixture did not request its engine");
    }),
  ]);
  await kidPage.getByRole("button", { name: "יציאה", exact: true }).click();
  releaseWasm();
  await kidPage.getByText("המפגש נסגר", { exact: true }).waitFor();
  await kidPage.waitForTimeout(300);
  assert.equal(await kidPage.locator(".voxel-session canvas").count(), 0);
  assert.equal(admissions.length, 0);
  assert.equal(gateway.rooms.size, 0);
  await kidContext.unroute("**/*.wasm");
  await kidPage
    .getByRole("button", { name: "כניסה חוזרת", exact: true })
    .click();
  const ready = async (page: typeof kidPage) => {
    await page.waitForFunction(
      () => {
        const d = (window as any).surfaceRuntime?.debug();
        return (
          d?.phase === "playing" && d.collisionColumns >= 9 && d.meshed >= 9
        );
      },
      null,
      { timeout: 60000 },
    );
  };
  await ready(kidPage);
  assert.ok(await kidPage.evaluate(() => (window as any).strictEffects >= 2));
  assert.equal(await kidPage.locator(".voxel-session canvas").count(), 1);
  await teacherPage.goto(origin + "/?role=teacher", {
    waitUntil: "domcontentloaded",
  });
  await ready(teacherPage);
  await teacherPage
    .getByText("תצפית נסתרת · אין בנייה או פגיעה בשחקנים", { exact: true })
    .waitFor();
  const debug = async (page: typeof kidPage) =>
    page.evaluate(() => (window as any).surfaceRuntime.debug());
  await kidPage.bringToFront();
  await kidPage
    .getByRole("button", { name: "כניסה לעולם", exact: true })
    .click();
  await kidPage.waitForFunction(
    () =>
      document.pointerLockElement !== null &&
      (window as any).surfaceRuntime.debug().focused,
  );
  await kidPage.keyboard.press("KeyE");
  await kidPage
    .getByRole("dialog", { name: "תיק ויצירה", exact: true })
    .waitFor();
  assert.equal((await debug(kidPage)).inventoryOpen, true);
  // Opening the dialog precedes the authoritative frozen-body baseline.
  await kidPage.waitForFunction(() => {
    const d = (window as any).surfaceRuntime.debug();
    return d.inventoryOpen && d.body?.frozen === 1;
  });
  await kidPage.getByRole("button", { name: "סגירה", exact: true }).click();
  await kidPage.getByRole("button", { name: "מסך מלא", exact: true }).click();
  await kidPage.waitForFunction(() =>
    document.fullscreenElement?.classList.contains("voxel-session"),
  );
  await kidPage
    .getByRole("button", { name: "תיק ויצירה (E)", exact: true })
    .click();
  assert.equal(
    await kidPage
      .getByRole("dialog", { name: "תיק ויצירה", exact: true })
      .evaluate((e) => document.fullscreenElement?.contains(e)),
    true,
  );
  await kidPage.screenshot({
    path: join(web, "test-results/voxel-react-inventory.png"),
  });
  await kidPage.getByRole("button", { name: "סגירה", exact: true }).click();
  const admissionsBeforeStaff = admissions.length,
    beforeStaff = await debug(teacherPage),
    ownedBeforeStaff = (await debug(kidPage)).inventory.bag;
  await teacherPage.bringToFront();
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  await teacherPage
    .getByRole("button", { name: "מעבר למצב יצירתי", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "אישור הפעולה", exact: true })
    .tap();
  for (const page of [kidPage, teacherPage])
    await page.waitForFunction(
      () => (window as any).surfaceRuntime.debug().mode === "creative",
    );
  assert.equal((await debug(kidPage)).combat, false);
  assert.deepEqual((await debug(kidPage)).inventory.bag, ownedBeforeStaff);
  await kidPage.bringToFront();
  await kidPage
    .getByRole("button", { name: "תיק ויצירה (E)", exact: true })
    .click();
  await kidPage.locator("#inventory-catalog").waitFor();
  const giveRevision = (await debug(kidPage)).inventory.revision;
  await kidPage.locator("#inventory-catalog").selectOption("oak_log");
  await kidPage.locator("#inventory-give").click();
  await kidPage.waitForFunction((revision) => {
    const d = (window as any).surfaceRuntime.debug();
    return d.inventory.revision > revision && !d.inventoryPending;
  }, giveRevision);
  const ownedForSurvival = (await debug(kidPage)).inventory.bag;
  assert.ok(
    ownedForSurvival.some(
      (stack: any) => stack?.itemType === "oak_log" && stack.count > 0,
    ),
  );
  await kidPage.getByRole("button", { name: "סגירה", exact: true }).click();
  await teacherPage.bringToFront();

  await teacherPage
    .getByRole("button", { name: "מעבר למצב שרידות", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "אישור הפעולה", exact: true })
    .tap();
  for (const page of [kidPage, teacherPage])
    await page.waitForFunction(
      () => (window as any).surfaceRuntime.debug().mode === "survival",
    );
  assert.deepEqual((await debug(kidPage)).inventory.bag, ownedForSurvival);
  assert.equal((await debug(kidPage)).focused, false);
  // Move through normal touch input far enough to unload the destination's
  // former subscription before testing teleport readiness and origin reset.
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  await teacherPage
    .getByRole("button", { name: "כניסה לתצפית", exact: true })
    .tap();
  await teacherPage.waitForFunction(
    () => (window as any).surfaceRuntime.debug().focused,
  );
  if (!(await debug(teacherPage)).body.flying)
    await teacherPage.getByRole("button", { name: "תעופה", exact: true }).tap();
  await teacherPage.waitForFunction(
    () => (window as any).surfaceRuntime.debug().body.flying === 1,
  );
  const travelCdp = await teacherContext.newCDPSession(teacherPage),
    jumpBox = await teacherPage.locator('[data-control="jump"]').boundingBox();
  assert.ok(jumpBox);
  const jumpPoint = {
    x: jumpBox.x + jumpBox.width / 2,
    y: jumpBox.y + jumpBox.height / 2,
    id: 7,
    radiusX: 4,
    radiusY: 4,
    force: 1,
  };
  const childBeforeTravel = (await debug(kidPage)).position,
    unloadsBeforeTravel = teacherUnloads;
  await travelCdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [jumpPoint],
  });
  await teacherPage.waitForFunction(
    (y) => (window as any).surfaceRuntime.debug().position[1] > y + 12,
    childBeforeTravel[1],
  );
  await travelCdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const travelStick = await teacherPage
    .locator(".voxel-touch-stick")
    .boundingBox();
  assert.ok(travelStick);
  const movePoint = {
    x: travelStick.x + travelStick.width / 2,
    y: travelStick.y + travelStick.height / 2,
    id: 8,
    radiusX: 4,
    radiusY: 4,
    force: 1,
  };
  await travelCdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [movePoint],
  });
  await travelCdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...movePoint, x: movePoint.x + travelStick.width * 0.35 }],
  });
  await teacherPage.waitForFunction(
    (p) => {
      const d = (window as any).surfaceRuntime.debug();
      return Math.hypot(d.position[0] - p[0], d.position[2] - p[2]) > 65;
    },
    childBeforeTravel,
    { timeout: 30000 },
  );
  await travelCdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const farStaff = await debug(teacherPage);
  assert.ok(teacherUnloads > unloadsBeforeTravel);
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  await teacherPage
    .getByLabel("יעד להשתגרות", { exact: true })
    .selectOption(kid);
  await teacherPage
    .getByRole("button", { name: "השתגרות ליעד", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "אישור הפעולה", exact: true })
    .tap();
  await teacherPage
    .getByText("ההשתגרות אושרה. ממתינים לשטח בטוח, ואז אפשר להיכנס לעולם.", {
      exact: true,
    })
    .waitFor();
  const expectedTarget = (await debug(kidPage)).position;
  await teacherPage.waitForFunction((p) => {
    const d = (window as any).surfaceRuntime.debug();
    return Math.hypot(d.position[0] - p[0], d.position[2] - p[2]) < 0.1;
  }, expectedTarget);
  await ready(teacherPage);
  await teacherPage.waitForFunction(
    (epoch) => (window as any).surfaceRuntime.debug().epoch > epoch,
    farStaff.epoch,
  );
  const afterStaff = await debug(teacherPage),
    childPose = (await debug(kidPage)).position;
  console.log(
    "Staff teleport",
    JSON.stringify({
      from: farStaff.position,
      to: afterStaff.position,
      target: childPose,
      epoch: afterStaff.epoch,
      unloads: teacherUnloads - unloadsBeforeTravel,
    }),
  );
  assert.equal(afterStaff.focused, false);
  assert.ok(
    Math.hypot(
      afterStaff.position[0] - childPose[0],
      afterStaff.position[2] - childPose[2],
    ) < 0.1,
  );
  // A blocked camera offset may resolve to the target's safe ground during readiness.
  assert.ok(
    afterStaff.position[1] >= childPose[1] - 0.1 &&
      afterStaff.position[1] <= childPose[1] + 2.1,
  );
  assert.equal(admissions.length, admissionsBeforeStaff);
  await teacherPage.screenshot({
    path: join(web, "test-results/voxel-react-staff.png"),
  });
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  const staffReceipts = db.value(
    `SELECT jsonb_agg(jsonb_build_object('command',command,'completed',completed,'result',result) ORDER BY revision) FROM public.voxel_staff_commands WHERE session_id=${literal(room)}`,
  );
  assert.equal(staffReceipts.length, 3);
  assert.ok(staffReceipts.every((row: any) => row.completed && row.result.ok));
  // All access changes go through visible staff controls; readmission is an
  // explicit student action. A lost provider response must keep its request ID.
  const moderationAdmissionsBefore = admissions.length;
  const moderationInventoryBefore = (await debug(kidPage)).inventory.bag;
  let lastJoinedEpoch = (await debug(kidPage)).epoch;
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  await teacherPage.getByText("ניהול משתתפים", { exact: true }).tap();
  await teacherPage
    .getByRole("combobox", { name: "משתתף או משתתפת לניהול", exact: true })
    .selectOption(kid);
  const confirmAccess = () =>
    teacherPage
      .getByRole("dialog")
      .getByRole("button", { name: "אישור עדכון הגישה", exact: true })
      .tap();
  wire.control.loseModerationResponse = true;
  await teacherPage
    .getByRole("button", { name: "הוצאה מהעולם", exact: true })
    .tap();
  await confirmAccess();
  await teacherPage
    .getByText("לא התקבל אישור לעדכון הגישה. אפשר לבדוק שוב את אותה בקשה.", {
      exact: true,
    })
    .waitFor();
  assert.equal(moderationRequests.length, 1);
  await teacherPage
    .getByRole("button", { name: "בדיקת בקשת הגישה", exact: true })
    .tap();
  await teacherPage
    .getByText("נשלחה בקשת ניתוק. אפשר להצטרף שוב בכניסה חדשה.", {
      exact: true,
    })
    .waitFor();
  assert.equal(moderationRequests.length, 2);
  assert.equal(
    moderationRequests[0].requestId,
    moderationRequests[1].requestId,
  );
  await kidPage
    .getByRole("button", { name: "התחברות מחדש", exact: true })
    .waitFor();
  assert.equal(admissions.length, moderationAdmissionsBefore);
  const rejoinKid = async () => {
    await kidPage
      .getByRole("button", { name: "התחברות מחדש", exact: true })
      .click();
    await kidPage.waitForFunction((previous) => {
      const d = (window as any).surfaceRuntime.debug();
      return (
        d.epoch > previous &&
        d.phase === "playing" &&
        d.collisionColumns >= 9 &&
        d.meshed >= 9
      );
    }, lastJoinedEpoch);
    lastJoinedEpoch = (await debug(kidPage)).epoch;
  };
  await rejoinKid();
  assert.deepEqual(
    (await debug(kidPage)).inventory.bag,
    moderationInventoryBefore,
  );
  await teacherPage
    .getByRole("button", { name: "חסימת כניסה", exact: true })
    .tap();
  await confirmAccess();
  await teacherPage
    .getByText("הכניסה לעולם נחסמה. חיבורים קודמים נשלחו לניתוק.", {
      exact: true,
    })
    .waitFor();
  await kidPage
    .getByRole("button", { name: "התחברות מחדש", exact: true })
    .waitFor();
  assert.equal(admissions.length, moderationAdmissionsBefore + 1);
  await kidPage
    .getByRole("button", { name: "התחברות מחדש", exact: true })
    .click();
  await kidPage
    .getByText("הגישה לעולם נחסמה. פנו לאיש צוות.", { exact: true })
    .waitFor();
  assert.equal(admissions.length, moderationAdmissionsBefore + 2);
  await teacherPage
    .getByRole("button", { name: "ביטול חסימה", exact: true })
    .tap();
  await confirmAccess();
  await teacherPage
    .getByText("הגישה אינה חסומה. אפשר להיכנס לעולם.", { exact: true })
    .waitFor();
  await rejoinKid();
  assert.deepEqual(
    (await debug(kidPage)).inventory.bag,
    moderationInventoryBefore,
  );
  assert.equal(admissions.length, moderationAdmissionsBefore + 3);
  const moderationReceipts = db.value(
    `SELECT jsonb_agg(jsonb_build_object('requestId',request_id,'action',action,'revision',revision,'banned',banned) ORDER BY revision) FROM public.voxel_moderation_commands WHERE session_id=${literal(room)}`,
  );
  assert.deepEqual(
    moderationReceipts.map((v: any) => v.action),
    ["remove", "ban", "unban"],
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(room)} AND action IN ('VOXEL_REMOVE','VOXEL_BAN','VOXEL_UNBAN')`,
    ),
    3,
  );
  await teacherPage
    .getByRole("button", { name: "רענון משתתפים", exact: true })
    .tap();
  await teacherPage.waitForFunction(() => {
    const select = document.querySelector(
      'select[aria-label="משתתף או משתתפת לניהול"]',
    ) as HTMLSelectElement | null;
    return (
      select &&
      !select.disabled &&
      select.selectedOptions[0]?.textContent === "תלמיד"
    );
  });
  await teacherPage.screenshot({
    path: join(web, "test-results/voxel-react-moderation.png"),
  });
  await teacherPage.getByText("כלי מורה", { exact: true }).tap();
  // Persisted chat uses visible owned dialogs and the real SQL/SDK boundary.
  const chatText = "<img src=x onerror=alert(1)> שלום 🙂";
  await kidPage.getByRole("button", { name: "צ׳אט", exact: true }).click();
  await kidPage
    .getByRole("textbox", { name: "הודעה למפגש", exact: true })
    .fill(chatText);
  wire.control.loseChatResponse = true;
  await kidPage
    .getByRole("button", { name: "שליחת הודעה", exact: true })
    .click();
  try {
    await kidPage
      .getByText("לא התקבל אישור. אפשר לבדוק שוב את אותה בקשת צ׳אט.", {
        exact: true,
      })
      .waitFor();
  } catch (error) {
    console.error(
      "Chat retry diagnostics",
      JSON.stringify({
        chatSendRequests,
        failedChatResponses,
        events,
        ui: await kidPage.locator(".voxel-session__chat").innerText(),
      }),
    );
    await kidPage.screenshot({
      path: join(web, "test-results/voxel-react-chat-failure.png"),
    });
    throw error;
  }
  await kidPage
    .getByRole("button", { name: "בדיקת בקשת הצ׳אט", exact: true })
    .click();
  await kidPage.getByText("ההודעה נשמרה.", { exact: true }).waitFor();
  assert.equal(chatSendRequests.length, 2);
  assert.equal(chatSendRequests[0], chatSendRequests[1]);
  await kidPage.getByText(chatText, { exact: true }).waitFor();
  assert.equal(
    await kidPage.locator(".voxel-session__chat-lines img").count(),
    0,
  );
  await kidPage
    .getByRole("button", { name: "סגירת הצ׳אט", exact: true })
    .click();
  await kidPage.getByRole("button", { name: "צ׳אט", exact: true }).click();
  await kidPage.getByText(chatText, { exact: true }).waitFor();
  await teacherPage.getByRole("button", { name: "צ׳אט", exact: true }).tap();
  await teacherPage.getByText(chatText, { exact: true }).waitFor();
  assert.equal(
    await teacherPage
      .getByRole("textbox", { name: "הודעה למפגש", exact: true })
      .count(),
    0,
  );
  await teacherPage
    .getByRole("button", { name: "מחיקת הודעה 1", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "אישור שינוי הצ׳אט", exact: true })
    .tap();
  await kidPage
    .getByText(chatText, { exact: true })
    .waitFor({ state: "hidden" });
  await kidPage
    .getByRole("textbox", { name: "הודעה למפגש", exact: true })
    .fill("הודעה נוספת לניקוי");
  await kidPage
    .getByRole("button", { name: "שליחת הודעה", exact: true })
    .click();
  await teacherPage.getByText("הודעה נוספת לניקוי", { exact: true }).waitFor();
  await teacherPage
    .getByRole("button", { name: "ניקוי הצ׳אט", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "אישור שינוי הצ׳אט", exact: true })
    .tap();
  await kidPage
    .getByText("הודעה נוספת לניקוי", { exact: true })
    .waitFor({ state: "hidden" });
  await teacherPage.getByText("אין הודעות להצגה.", { exact: true }).waitFor();
  await teacherPage.screenshot({
    path: join(web, "test-results/voxel-react-chat.png"),
  });
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_chat_messages WHERE session_id=${literal(room)} AND NOT is_deleted`,
    ),
    0,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_chat_requests WHERE session_id=${literal(room)} AND action='send'`,
    ),
    2,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(room)} AND action LIKE 'VOXEL_CHAT_%'`,
    ),
    2,
  );
  assert.doesNotMatch(JSON.stringify(events), /onerror|הודעה נוספת לניקוי/);
  await kidPage
    .getByRole("button", { name: "סגירת הצ׳אט", exact: true })
    .click();
  await teacherPage
    .getByRole("button", { name: "סגירת הצ׳אט", exact: true })
    .tap();
  wire.control.failUpload = true;
  await teacherPage
    .getByRole("button", { name: "השהיית המפגש", exact: true })
    .click();
  await teacherPage
    .getByRole("button", { name: "ניסיון חוזר של אותה פעולה", exact: true })
    .waitFor();
  assert.equal(controlRequests.filter((v) => v.action === "pause").length, 1);
  assert.equal((await debug(kidPage)).lifecycle, "paused");
  const paused = await debug(kidPage);
  assert.equal(
    await kidPage
      .getByRole("button", { name: "תיק ויצירה (E)", exact: true })
      .isDisabled(),
    true,
  );
  wire.control.failUpload = false;
  await teacherPage
    .getByRole("button", { name: "ניסיון חוזר של אותה פעולה", exact: true })
    .click();
  await teacherPage
    .getByText("המפגש הושהה והשמירה אושרה.", { exact: true })
    .waitFor();
  const pauses = controlRequests.filter((v) => v.action === "pause");
  assert.equal(pauses.length, 2);
  assert.equal(pauses[0].requestId, pauses[1].requestId);
  await teacherPage
    .getByRole("button", { name: "כניסה לתצפית", exact: true })
    .tap();
  const camera = await debug(teacherPage),
    button = await teacherPage.locator('[data-control="jump"]').boundingBox();
  assert.ok(button);
  const cdp = await teacherContext.newCDPSession(teacherPage);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: button.x + button.width / 2,
        y: button.y + button.height / 2,
        id: 1,
        radiusX: 4,
        radiusY: 4,
        force: 1,
      },
    ],
  });
  await teacherPage.waitForFunction(
    (y) => (window as any).surfaceRuntime.debug().position[1] > y + 2,
    camera.position[1],
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const elevated = await debug(teacherPage);
  assert.equal((await debug(kidPage)).worldTick, paused.worldTick);
  assert.equal(elevated.worldTick, paused.worldTick);
  await teacherPage.screenshot({
    path: join(web, "test-results/voxel-react-observer.png"),
  });
  await teacherPage
    .getByRole("button", { name: "חידוש המפגש", exact: true })
    .tap();
  await kidPage.waitForFunction(
    () => (window as any).surfaceRuntime.debug().lifecycle === "playing",
  );
  assert.equal((await debug(kidPage)).focused, false);
  await kidPage.bringToFront();
  await kidPage
    .getByRole("button", { name: "כניסה לעולם", exact: true })
    .click();
  await kidPage.waitForFunction(
    () => (window as any).surfaceRuntime.debug().focused,
  );
  const before = await debug(kidPage);
  await kidPage.keyboard.down("KeyS");
  await kidPage.waitForFunction((p) => {
    const d = (window as any).surfaceRuntime.debug();
    return Math.hypot(d.position[0] - p[0], d.position[2] - p[2]) > 0.2;
  }, before.position);
  await kidPage.keyboard.up("KeyS");
  await kidPage.screenshot({
    path: join(web, "test-results/voxel-react-playing.png"),
  });
  await teacherPage
    .getByRole("button", { name: "סיום המפגש", exact: true })
    .tap();
  await teacherPage
    .getByRole("button", { name: "שמירה וסיום", exact: true })
    .tap();
  try {
    await teacherPage
      .getByText("המפגש הסתיים והשמירה אושרה.", { exact: true })
      .waitFor();
  } catch (error) {
    console.error(
      "End confirmation diagnostics",
      JSON.stringify({
        connected: browser.isConnected(),
        closed: teacherPage.isClosed(),
        events,
        controls: db.value(
          `SELECT jsonb_agg(jsonb_build_object('action',action,'completed',completed,'savedSequence',saved_sequence)) FROM public.voxel_session_commands WHERE session_id=${literal(room)}`,
        ),
      }),
    );
    if (!teacherPage.isClosed())
      console.error(
        "End confirmation UI",
        await teacherPage
          .locator("body")
          .innerText()
          .catch(() => "unavailable"),
      );
    throw error;
  }
  for (const page of [kidPage, teacherPage])
    await page.waitForFunction(
      () => (window as any).surfaceRuntime.debug().lifecycle === "ended",
    );
  const admissionsAtEnd = admissions.length;
  await kidPage.waitForTimeout(1700);
  assert.equal(admissions.length, admissionsAtEnd);
  const cleanup = [],
    exitInteractions: string[] = [],
    exitInputEvents: {
      type: string;
      tag?: string;
      text?: string;
      trusted: boolean;
      time: number;
    }[] = [];
  let mouseClickAcknowledged = true;
  for (const page of [kidPage, teacherPage]) {
    console.log(
      "Before exit",
      JSON.stringify(
        await page.evaluate(() => ({
          visible: document.visibilityState,
          focused: document.hasFocus(),
          fullscreen: !!document.fullscreenElement,
          role: (window as any).surfaceRuntime.debug().role,
        })),
      ),
    );
    await page.bringToFront();
    const exit = page.getByRole("button", { name: "יציאה", exact: true });
    if (page === kidPage) {
      await page.exposeFunction(
        "recordExitInput",
        (value: (typeof exitInputEvents)[number]) =>
          exitInputEvents.push(value),
      );
      await page.evaluate(() => {
        for (const type of [
          "pointerdown",
          "mousedown",
          "pointerup",
          "mouseup",
          "click",
          "fullscreenchange",
        ])
          document.addEventListener(
            type,
            (event) => {
              const target = event.target as Element | null;
              void (window as any).recordExitInput({
                type,
                trusted: event.isTrusted,
                tag: target?.tagName,
                text: target?.textContent?.slice(0, 30),
                fullscreen: !!document.fullscreenElement,
                pointerLock: !!document.pointerLockElement,
                time: performance.now(),
              });
            },
            true,
          );
      });
      const priorExits = await page.evaluate(
        () => (window as any).exitCalls ?? 0,
      );
      const bounds = await exit.boundingBox();
      assert.ok(bounds);
      const pointer = await kidContext.newCDPSession(page);
      // Use the same browser-level physical dispatch as the touch scenarios.
      // Locator.click can stall awaiting a compositor mouse-move/release ack.
      // Actual trusted events and completed disposal remain mandatory below.
      const position = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      const inspectExit = () =>
        page.evaluate(
          ({ x, y }) => ({
            target: (() => {
              const e = document.elementFromPoint(x, y);
              return { tag: e?.tagName, text: e?.textContent?.slice(0, 80) };
            })(),
            pointerLock: document.pointerLockElement?.tagName,
            fullscreen: document.fullscreenElement?.className,
            dialogs: [...document.querySelectorAll("dialog")].map((d) => ({
              open: d.open,
              label: d.getAttribute("aria-labelledby"),
            })),
            exits: (window as any).exitCalls,
            disposed: (window as any).disposedRuntime?.debug().disposed,
            audio: (window as any).disposedRuntime?.debug().audio,
            resources: (window as any).disposedRuntime?.debug().resources,
            geometry: [...document.querySelectorAll("button")]
              .filter((b) => b.textContent === "יציאה")
              .map((b) => ({
                rect: JSON.parse(JSON.stringify(b.getBoundingClientRect())),
                pointer: getComputedStyle(b).pointerEvents,
              })),
          }),
          position,
        );
      const beforeExitHit = await inspectExit();
      console.log(
        "Before mouse dispatch",
        JSON.stringify({ position, ...beforeExitHit }),
      );
      const press = pointer.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...position,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      const release = pointer.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...position,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
      // Always observe a pending protocol promise when the browser later closes.
      const acknowledged = Promise.all([press, release]).then(
        () => true,
        () => false,
      );
      try {
        await page.waitForFunction((previous) => {
          const d = (window as any).disposedRuntime?.debug();
          return (
            (window as any).exitCalls === previous + 1 &&
            !document.querySelector(".voxel-session") &&
            !document.fullscreenElement &&
            !document.pointerLockElement &&
            d?.disposed &&
            d.audio.state === "closed" &&
            d.resources.workers === 0
          );
        }, priorExits);
      } catch (error) {
        console.error(
          "Mouse exit diagnostics",
          JSON.stringify({
            before: beforeExitHit,
            after: await inspectExit(),
            events: exitInputEvents,
          }),
        );
        await page.screenshot({
          path: join(web, "test-results/voxel-react-mouse-exit-failure.png"),
        });
        throw error;
      }
      mouseClickAcknowledged = await Promise.race([
        acknowledged,
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 5000),
        ),
      ]);
      const physical = exitInputEvents.filter(
        (value) => value.tag === "BUTTON" && value.text === "יציאה",
      );
      assert.deepEqual(
        physical.map((value) => value.type),
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"],
      );
      assert.ok(physical.every((value) => value.trusted));
      assert.equal(
        await page.evaluate(() => (window as any).exitCalls ?? 0),
        priorExits + 1,
      );
      exitInteractions.push("mouse click while fullscreen");
    } else {
      await exit.tap();
      exitInteractions.push("touch tap");
    }
    await page.waitForFunction(() => {
      const d = (window as any).disposedRuntime?.debug();
      return (
        d?.disposed && d.audio.state === "closed" && d.resources.workers === 0
      );
    });
    const state = await page.evaluate(() =>
      (window as any).disposedRuntime.debug(),
    );
    assert.deepEqual(state.resources, {
      geometries: 0,
      textures: 0,
      workers: 0,
    });
    assert.equal(
      await page.locator(".voxel-touch,.voxel-inventory,canvas").count(),
      0,
    );
    cleanup.push({ resources: state.resources, audio: state.audio.state });
  }
  const mobileContext = await browser.newContext({
    viewport: { width: 540, height: 800 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(20000);
  mobilePage.on("pageerror", (error) => errors.push(error.message));
  await mobilePage.goto(origin + "/?role=kid&room=" + mobileRoom, {
    waitUntil: "domcontentloaded",
  });
  await ready(mobilePage);
  await mobilePage
    .getByRole("button", { name: "כניסה לעולם", exact: true })
    .tap();
  await mobilePage.waitForFunction(
    () => (window as any).surfaceRuntime.debug().focused,
  );
  const touchLayout = await mobilePage.evaluate(() => {
    const vitals = document
      .querySelector(".voxel-session__vitals")!
      .getBoundingClientRect();
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        ".voxel-touch-stick,.voxel-touch-actions button",
      ),
    ].filter((node) => node.getBoundingClientRect().width > 0);
    return controls.map((node) => {
      const r = node.getBoundingClientRect();
      return {
        control:
          node.dataset.control ??
          (node.classList.contains("voxel-touch-stick")
            ? "joystick"
            : (node.textContent ?? "action")),
        overlap:
          Math.max(
            0,
            Math.min(r.right, vitals.right) - Math.max(r.left, vitals.left),
          ) *
          Math.max(
            0,
            Math.min(r.bottom, vitals.bottom) - Math.max(r.top, vitals.top),
          ),
        reachable: node.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        ),
      };
    });
  });
  assert.ok(
    touchLayout.every((item) => item.overlap === 0 && item.reachable),
    "player vitals must not cover touch controls",
  );
  const mobileBefore = await debug(mobilePage),
    stick = await mobilePage.locator(".voxel-touch-stick").boundingBox();
  assert.ok(stick);
  const mobileCdp = await mobileContext.newCDPSession(mobilePage),
    point = {
      x: stick.x + stick.width / 2,
      y: stick.y + stick.height / 2,
      id: 1,
      radiusX: 5,
      radiusY: 5,
      force: 1,
    };
  await mobileCdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await mobileCdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, y: point.y + stick.height * 0.3 }],
  });
  await mobilePage.waitForFunction((p) => {
    const d = (window as any).surfaceRuntime.debug();
    return Math.hypot(d.position[0] - p[0], d.position[2] - p[2]) > 0.15;
  }, mobileBefore.position);
  await mobileCdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await mobilePage.screenshot({
    path: join(web, "test-results/voxel-react-mobile.png"),
  });
  await mobilePage.getByRole("button", { name: "יציאה", exact: true }).tap();
  await mobilePage.waitForFunction(
    () => (window as any).disposedRuntime?.debug().audio.state === "closed",
  );
  const mobileCleanup = await mobilePage.evaluate(
    () => (window as any).disposedRuntime.debug().resources,
  );
  assert.deepEqual(mobileCleanup, { geometries: 0, textures: 0, workers: 0 });
  cleanup.push({ resources: mobileCleanup, audio: "closed" });
  for (let i = 0; i < 200 && gateway.rooms.size; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(failedControlResponses.length, 1);
  assert.deepEqual(
    failedControlResponses[0],
    controlRequests.find((v) => v.action === "pause"),
  );
  assert.equal(failedModerationResponses.length, 1);
  assert.equal(bannedAdmissionResponses.length, 1);
  assert.equal(failedChatResponses.length, 1);
  assert.equal(chatSendRequests.length, 3);
  assert.equal(failedChatResponses[0], chatSendRequests[0]);
  assert.ok(expectedNetworkErrors.length <= 4 + bannedSessionResponses.length);
  assert.deepEqual(errors, []);
  assert.equal(gateway.rooms.size, 0);
  await mobilePage
    .getByRole("button", { name: "עזיבת הסגל", exact: true })
    .tap();
  await mobilePage.getByText("ההשתתפות במפגש הוסרה", { exact: true }).waitFor();
  const rosterReceipt = await mobilePage.evaluate(
    () => (window as any).rosterReceipt,
  );
  assert.equal(rosterReceipt.left, true);
  assert.equal(rosterReceipt.ended, true);
  assert.equal(rosterReceipt.revision, 1);
  assert.equal("saved" in rosterReceipt, false);
  assert.equal(
    db.value(
      `SELECT status FROM public.game_sessions WHERE id=${literal(mobileRoom)}`,
    ),
    "completed",
  );
  assert.deepEqual(
    db.value(
      `SELECT player_ids FROM public.game_sessions WHERE id=${literal(mobileRoom)}`,
    ),
    [],
  );
  const receipts = db.value(
    `SELECT jsonb_agg(jsonb_build_object('action',action,'completed',completed,'savedSequence',saved_sequence) ORDER BY revision) FROM public.voxel_session_commands WHERE session_id=${literal(room)}`,
  );
  assert.equal(receipts.length, 3);
  assert.ok(receipts.every((r: any) => r.completed));
  const fixtureArchive = join(web, "test-results/react-fixture");
  rmSync(fixtureArchive, { recursive: true, force: true });
  for (const [path, file] of assets) {
    const output = join(fixtureArchive, path.slice(1));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, readFileSync(file));
  }
  const inventory = [...assets].map(([path, file]) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  }));
  writeFileSync(
    join(web, "test-results/voxel-react.json"),
    JSON.stringify(
      {
        result: mouseClickAcknowledged
          ? "PASS"
          : "PASS_WITH_MOUSE_ACKNOWLEDGEMENT_TIMEOUT",
        mouseClickAcknowledged,
        buildId: runtime.build.buildId,
        engineHash: runtime.build.engineHash,
        contentHash: runtime.build.contentHash,
        browser: browser.version(),
        scope:
          "Built React development StrictMode fixture, actual native packaged worker and SDK/PostgreSQL; fixture Auth/PostgREST/Storage transports, not full hosted shell or hardware qualification",
        lateMountCancelled: true,
        strictMode: true,
        fullscreenInventory: true,
        playerTouchLayout: touchLayout,
        playerTouchMovement: true,
        rosterReceipt,
        staffReceipts,
        moderationReceipts,
        moderationFlow: true,
        chatFlow: true,
        chatRetrySameRequest: true,
        chatEscapedText: true,
        chatHiddenStaffReadOnly: true,
        chatPersistedAfterReopen: true,
        chatDeleteAndClear: true,
        expectedChatFailureResponses: failedChatResponses.length,
        moderationRetrySameRequest: true,
        moderationInventoryPreserved: true,
        expectedModerationFailureResponses: failedModerationResponses.length,
        expectedBannedAdmissionResponses: bannedAdmissionResponses.length,
        expectedBannedSessionResponses: bannedSessionResponses.length,
        staffModeAndTeleport: true,
        staffTeleportTravel: {
          from: farStaff.position,
          to: afterStaff.position,
          originBefore: farStaff.renderOrigin,
          originAfter: afterStaff.renderOrigin,
          unloads: teacherUnloads - unloadsBeforeTravel,
        },
        failedSaveNotConfirmed: true,
        expectedControlFailureResponses: failedControlResponses.length,
        expectedBrowserNetworkErrors: expectedNetworkErrors.length,
        sameRequestRetry: true,
        teacherRise: elevated.position[1] - camera.position[1],
        noAutomaticReadmission: true,
        receipts,
        cleanup,
        exitInteractions,
        exitInputEvents,
        errors,
        clientArtifacts: inventory,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "React StrictMode cancellation, owned HUD/inventory/fullscreen, SQL save failure/retry, paused teacher flight, resume/end and complete teardown pass",
  );
} finally {
  if (deadline) clearTimeout(deadline);
  await browser?.close();
  await gateway?.close();
  await wire?.close();
  db?.close();
  rmSync(temp, { recursive: true, force: true });
}
