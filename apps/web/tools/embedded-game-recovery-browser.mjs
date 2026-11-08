// Targeted network/iframe failures; no real matchmaking or gameplay services.
import { createServer } from "vite";
import { chromium } from "../../../games/wobble-rush/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
const port = 19035,
  origin = `http://127.0.0.1:${port}`;
let mode = "config-fail",
  launches = 0;
const logs = [];
const uid = "00000000-0000-0000-0000-000000000001",
  room = "00000000-0000-0000-0000-000000000002";
const rocketConfig = {
  protocol: 1,
  capabilities: [
    "lobby-controls",
    "session-chat",
    "voice",
    "retained-matches",
    "queued-roster",
    "rematch",
    "save-outcomes",
    "platform-only",
  ],
};
const wobbleConfig = {
  version: 1,
  protocol: 7,
  content: "playground-action-4",
  release: "fixture",
  capabilities: [
    "authenticated-rooms",
    "host-start",
    "saved-games",
    "teacher-observation",
    "social",
  ],
  courses: [{ id: "fixture", name: "Fixture" }],
};
const snapshot = {
  version: 1,
  sessionId: room,
  actorId: "rocket-0",
  observer: false,
  pending: false,
  paused: false,
  phase: "playing",
  selfUserId: uid,
  hostUserId: uid,
  pendingPlayers: [],
  observers: [],
  canControl: false,
  canModerate: false,
  canRematch: false,
  score: { blue: 0, orange: 0 },
  rematch: null,
  players: Array.from({ length: 8 }, (_, i) => ({
    actorId: `rocket-${i}`,
    name: i ? "" : "Tester",
    kind: i ? "empty" : "human",
    userId: i ? null : uid,
    connected: i === 0,
    team: i < 4 ? "blue" : "orange",
  })),
};
const fixture = `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
import{RocketSessionContainer}from'/src/game/RocketSessionContainer';import{WobbleSessionContainer}from'/src/game/WobbleSessionContainer';
import{ThemeProvider}from'/src/context/ThemeContext';import{AuthProvider}from'/src/hooks/useAuth';import{PlaygroundUserProvider}from'/src/hooks/usePlaygroundUser';import{supabase}from'/src/lib/supabase';import{flushTelemetry}from'/src/utils/telemetry';import'/src/index.css';
window.fixture={flush:()=>flushTelemetry('game-server'),documentToken:crypto.randomUUID()};
Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{user:{id:'${uid}'},access_token:'fixture-access-token'}},error:null})});
Object.defineProperty(supabase.auth,'onAuthStateChange',{value:()=>({data:{subscription:{unsubscribe(){}}}})});
Object.defineProperty(supabase,'from',{value:table=>{const result=()=>({data:table==='kid_profiles'?{id:'${uid}',full_name:'Tester',username:'tester',role:'kid',gender:'boy',is_active:true,grade:'3'}:table==='admin_profiles'?null:[],error:null});const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>result(),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};return q;}});
Object.defineProperty(supabase,'channel',{value:()=>{const c={on:()=>c,subscribe:()=>c};return c;}});Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});Object.defineProperty(supabase,'rpc',{value:async()=>({data:[],error:null})});
function Entry(){const[wobble,setWobble]=useState(false);return <><button onClick={()=>setWobble(true)}>Switch to Wobble</button>{wobble?<WobbleSessionContainer sessionId='${room}'/>:<RocketSessionContainer sessionId='${room}'/>}</>}
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><PlaygroundUserProvider><ThemeProvider><Entry/></ThemeProvider></PlaygroundUserProvider></AuthProvider></BrowserRouter>);
`;
process.chdir(new URL("../", import.meta.url).pathname);
process.env.VITE_SUPABASE_URL = origin;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fixture";
process.env.VITE_ROCKET_SERVICE_URL = origin;
process.env.VITE_WOBBLE_SERVICE_URL = origin;
process.env.VITE_GAME_SERVER_URL = origin;
const server = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [
    {
      name: "embedded-recovery-fixture",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, origin);
          if (url.pathname === "/__fixture.html") {
            res.setHeader("Content-Type", "text/html");
            res.end(
              await server.transformIndexHtml(
                req.url,
                '<html><body><div id="root"></div><script type="module" src="/__fixture.tsx"></script></body></html>',
              ),
            );
            return;
          }
          if (url.pathname === "/api/telemetry") {
            let body = "";
            for await (const chunk of req) body += chunk;
            logs.push(...JSON.parse(body).logs);
            res.end("{}");
            return;
          }
          if (url.pathname.endsWith("/config")) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = mode === "config-fail" ? 503 : 200;
            res.end(JSON.stringify(url.pathname.includes("rocket") ? rocketConfig : wobbleConfig));
            return;
          }
          if (url.pathname === "/api/rocket/launch") {
            launches++;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                version: 1,
                sessionId: room,
                reservation: { room: { roomId: "fixture-room" }, sessionId: "fixture-seat" },
              }),
            );
            return;
          }
          if (url.pathname === "/" && url.searchParams.has("bridgeId")) {
            if (mode === "reset") {
              req.socket.destroy();
              return;
            }
            res.setHeader("Content-Type", "text/html");
            res.end(
              `<html><body>Game document<script>const bridgeId=${JSON.stringify(url.searchParams.get("bridgeId"))};const post=(kind,extra={})=>parent.postMessage({source:'rocket-frame',version:1,bridgeId,kind,...extra},${JSON.stringify(origin)});addEventListener('message',event=>{if(event.data?.kind==='launch')post('state',{state:${JSON.stringify(snapshot)}})});post('ready');</script></body></html>`,
            );
            return;
          }
          next();
        });
      },
      resolveId(id) {
        if (id === "/__fixture.tsx") return id;
      },
      load(id) {
        if (id === "/__fixture.tsx") return fixture;
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/__fixture.html");
  const documentToken = await page.evaluate(() => window.fixture.documentToken);
  await page.getByRole("alert").filter({ hasText: "שרת המשחק אינו זמין" }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  await page.evaluate(() => window.fixture.flush());
  const retryResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/rocket/config"),
  );
  await page.getByRole("button", { name: "ניסיון נוסף", exact: true }).click();
  await retryResponse;
  await page.getByRole("alert").filter({ hasText: "שרת המשחק אינו זמין" }).waitFor();
  await page.evaluate(() => window.fixture.flush());
  const attempts = logs.filter((log) => log.message === "Embedded game startup failed");
  assert.equal(new Set(attempts.map((log) => log.context.attemptId)).size, 2);
  mode = "reset";
  await page.clock.install();
  await page.getByRole("button", { name: "ניסיון נוסף", exact: true }).click();
  await page.locator("iframe").waitFor({ state: "attached" });
  await page.getByRole("status", { name: "טעינת רוקט ארנה" }).waitFor();
  await page.clock.fastForward(25_050);
  await page.getByRole("alert").filter({ hasText: "לא הצלחנו לטעון את המשחק" }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(launches, 0);
  await page.evaluate(() => window.fixture.flush());
  assert.ok(
    logs.some(
      (log) => log.context?.code === "FRAME_READY_TIMEOUT" && log.context.game === "rocket",
    ),
  );
  mode = "healthy";
  await page.getByRole("button", { name: "ניסיון נוסף", exact: true }).click();
  await page.getByRole("status", { name: "טעינת רוקט ארנה" }).waitFor({ state: "hidden" });
  assert.equal(launches, 1);
  assert.equal(await page.locator("iframe").count(), 1);
  mode = "config-fail";
  await page.getByRole("button", { name: "Switch to Wobble" }).click();
  await page.getByRole("alert").filter({ hasText: "שרת המשחק אינו זמין" }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  mode = "reset";
  await page.getByRole("button", { name: "ניסיון נוסף", exact: true }).click();
  await page.locator("iframe").waitFor({ state: "attached" });
  await page.clock.fastForward(25_050);
  await page.getByRole("alert").filter({ hasText: "לא הצלחנו לטעון את המשחק" }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  await page.evaluate(() => window.fixture.flush());
  assert.ok(
    logs.some(
      (log) => log.context?.code === "FRAME_READY_TIMEOUT" && log.context.game === "wobble",
    ),
  );
  assert.equal(await page.evaluate(() => window.fixture.documentToken), documentToken);
  assert.deepEqual(errors, []);
  assert.ok(!JSON.stringify(logs).includes("fixture-access-token"));
  console.log(
    "PASS: Rocket/Wobble preflight failure, reset iframe containment, per-retry logging, Rocket recovery, no premature launch or document reload",
  );
} finally {
  await browser?.close();
  await server.close();
}
