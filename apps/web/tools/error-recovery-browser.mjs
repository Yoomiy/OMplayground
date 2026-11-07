// Focused fault injection: real app routing/social widgets, with a stateful game stand-in.
import { createServer } from "vite";
import { chromium } from "../../../games/wobble-rush/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useNavigate} from 'react-router-dom';
import App from '/src/App';
import {AuthProvider} from '/src/hooks/useAuth';
import {PlaygroundUserProvider} from '/src/hooks/usePlaygroundUser';
import {supabase} from '/src/lib/supabase';
import '/src/index.css';
const uid='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002';
const profile={id:uid,full_name:'Tester',username:'tester',role:'teacher',is_active:true,grade:'3',gender:'boy',avatar_color:'#8b5cf6',avatar_url:null,avatar_preset_id:null};
const partner={id:other,full_name:'Friend',role:'kid',can_send:true};
const message={id:'message',from_kid_id:other,to_kid_id:uid,from_display_name:'Friend',content:'Hello',is_read:false,created_at:new Date().toISOString()};
window.fixture={requests:[],migrationMissing:true,malformedInbox:false,profileFailure:new URLSearchParams(location.search).has('profileFailure'),roomFailure:false,joinFailure:false,failSend:false,gameMounts:0};
Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{user:{id:uid}}},error:null})});
Object.defineProperty(supabase.auth,'onAuthStateChange',{value:()=>({data:{subscription:{unsubscribe(){}}}})});
Object.defineProperty(supabase,'from',{value:table=>{
 let fields='',filters={};
 const result=async(single=false)=>{
   if(table==='kid_profiles'){
     if(window.fixture.profileFailure && fields.includes('username')) throw new Error('fixture profile transport');
     return {data:profile,error:null};
   }
   if(table==='game_sessions' && single){
     if(window.fixture.roomFailure || (filters.invitation_code && window.fixture.joinFailure)) throw new Error('fixture room transport');
     return {data:{id:'room',status:'playing',games:{name_he:'Fixture game',game_url:'chess'}},error:null};
   }
   return {data:single?null:[],error:null};
 };
 const q={select:value=>{fields=value;return q;},eq:(key,value)=>{filters[key]=value;return q;},in:()=>q,not:()=>q,contains:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>result(true),then:(resolve,reject)=>result().then(resolve,reject)};
 return q;
}});
Object.defineProperty(supabase,'channel',{value:()=>{const c={on:()=>c,subscribe:()=>c,track:async()=>{},presenceState:()=>({})};return c;}});
Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
Object.defineProperty(supabase,'rpc',{value:async(name,args)=>{
 window.fixture.requests.push(name);
 if(name==='list_game_challenges')return window.fixture.migrationMissing?{data:null,error:{code:'PGRST202',message:'missing function'}}:{data:[]};
 if(name==='list_private_threads')return {data:window.fixture.malformedInbox?{threads:[{}],unread_total:1}:{threads:[{partnerId:other,partner,lastMessage:message,unreadCount:1}],unread_total:1}};
 if(name==='mark_private_messages_read'){message.is_read=true;return {data:null};}
 if(name==='get_private_thread')return {data:{partner,messages:[message]}};
 if(name==='send_private_message')return window.fixture.failSend?{error:{message:'fixture send failure'}}:{data:{}};
 return {data:null};
}});
function Controls(){const navigate=useNavigate();window.fixture.navigate=navigate;return null;}
window.history.replaceState(null,'','/home');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><PlaygroundUserProvider><Controls/><App/></PlaygroundUserProvider></AuthProvider></BrowserRouter>);
`;

const gameStandIn = `
import React,{useEffect,useState} from 'react';
export function GameSessionContainer(){const [moves,setMoves]=useState(0);useEffect(()=>{window.fixture.gameMounts++},[]);return <main><h1>Game stand-in</h1><button onClick={()=>setMoves(n=>n+1)}>Move {moves}</button></main>}
export const RocketSessionContainer=GameSessionContainer,WobbleSessionContainer=GameSessionContainer;
`;
const faults = {
  "/src/components/ChallengeDock.tsx": ["export function ChallengeDock() {", "throwChallenge"],
  "/src/components/GlobalMessages.tsx": ["export function GlobalMessages() {", "throwMessages"],
  "/src/components/InboxPanel.tsx": ["function InboxContent() {", "throwInbox"],
  "/src/pages/ProfilePage.tsx": ["export function ProfilePage() {", "throwProfile"],
  "/src/lib/lazyImport.ts": ["    return await load();", "failImports"],
};
process.chdir(new URL("../", import.meta.url).pathname);
process.env.VITE_SUPABASE_URL = "http://127.0.0.1:19031";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fixture-key";
const server = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  plugins: [
    {
      name: "error-recovery-fixture",
      enforce: "pre",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/__recovery.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              req.url,
              '<html><body><div id="root"></div><script type="module" src="/__recovery.tsx"></script></body></html>',
            ),
          );
        });
      },
      resolveId(id) {
        if (id === "/__recovery.tsx") return id;
      },
      load(id) {
        if (id === "/__recovery.tsx") return fixture;
        if (
          /\/game\/(GameSessionContainer|RocketSessionContainer|WobbleSessionContainer)\.tsx$/.test(
            id,
          )
        )
          return gameStandIn;
      },
      transform(code, id) {
        for (const [suffix, [needle, flag]] of Object.entries(faults)) {
          if (!id.endsWith(suffix)) continue;
          const check = `if(window.fixture?.${flag}) throw new Error('fixture ${flag}');`;
          return code.replace(
            needle,
            suffix.endsWith("lazyImport.ts") ? check + needle : needle + check,
          );
        }
      },
    },
  ],
  server: { host: "127.0.0.1", port: 19031, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const unexpected = [];
  page.on("pageerror", (error) => {
    if (
      !/^fixture (throwChallenge|throwMessages|throwInbox|throwProfile|failImports)$/.test(
        error.message,
      )
    )
      unexpected.push(error.message);
  });
  // All recovery below must happen in the same document.
  await page.goto("http://127.0.0.1:19031/__recovery.html");
  await page.evaluate(() => (window.documentToken = "same document"));
  await page.getByText("שלום, Tester!").waitFor();
  console.log("Home loaded");
  await page.getByRole("button", { name: "הזמנות למשחק, לא זמין כרגע", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "לא ניתן לרענן הזמנות" }).waitFor();
  const initialCalls = await page.evaluate(
    () => window.fixture.requests.filter((name) => name === "list_game_challenges").length,
  );
  // Advancing the application's poll proves missing migrations do not hammer the server.
  await page.clock.install();
  await page.clock.fastForward(16_000);
  assert.equal(
    await page.evaluate(
      () => window.fixture.requests.filter((name) => name === "list_game_challenges").length,
    ),
    initialCalls,
  );
  await page.evaluate(() => (window.fixture.migrationMissing = false));
  await page.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "לא ניתן לרענן הזמנות" })
    .waitFor({ state: "hidden" });
  await page.clock.resume();
  console.log("Migration recovery passed");

  await page.evaluate(() => window.fixture.navigate("/play/room"));
  await page.getByRole("button", { name: "Move 0", exact: true }).click();
  const mounts = await page.evaluate(() => window.fixture.gameMounts);
  await page.evaluate(() => {
    window.fixture.throwChallenge = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(1100);
  const challengeFault = page.getByRole("alert").filter({ hasText: "ההזמנות אינן זמינות כרגע" });
  await challengeFault.waitFor();
  await page.getByRole("button", { name: "Move 1", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.gameMounts), mounts);
  await page.evaluate(() => (window.fixture.throwChallenge = false));
  await challengeFault.getByRole("button", { name: "נסו שוב" }).click();

  console.log("Challenge widget isolation passed");
  // Malformed successful responses are contained, with an explicit retry.
  await page.evaluate(() => {
    window.fixture.malformedInbox = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByRole("button", { name: /^הודעות, 1 לא נקראו$/ }).click();
  await page.getByRole("alert").filter({ hasText: "ההודעות אינן זמינות כרגע" }).waitFor();
  await page.evaluate(() => (window.fixture.malformedInbox = false));
  await page.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await page.getByRole("button", { name: /Friend.*Hello/ }).click();
  await page.getByRole("textbox", { name: "כתיבת הודעה" }).fill("Keep this draft");
  // A panel crash must keep its surrounding dialog, draft, and game state.
  await page.evaluate(() => {
    window.fixture.throwInbox = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(16_000);
  const panelFault = page.getByRole("alert").filter({ hasText: "לא ניתן להציג את השיחה כרגע" });
  await panelFault.waitFor();
  await page.evaluate(() => (window.fixture.throwInbox = false));
  await panelFault.getByRole("button", { name: "נסו שוב" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "כתיבת הודעה" }).inputValue(),
    "Keep this draft",
  );
  await page.getByRole("button", { name: "סגירת הודעות", exact: true }).click();
  await page.getByRole("button", { name: "Move 1", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.gameMounts), mounts);

  console.log("Inbox panel recovery passed");
  // The outer shared-widget boundary also leaves the game mounted.
  await page.evaluate(() => {
    window.fixture.throwMessages = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(16_000);
  const messagesFault = page.getByRole("alert").filter({ hasText: "ההודעות אינן זמינות כרגע" });
  await messagesFault.waitFor();
  await page.getByRole("button", { name: "Move 1", exact: true }).waitFor();
  await page.evaluate(() => (window.fixture.throwMessages = false));
  await messagesFault.getByRole("button", { name: "נסו שוב" }).click();
  assert.equal(await page.evaluate(() => window.fixture.gameMounts), mounts);

  // Failed room loading gets a retry rather than an infinite spinner or a false invalid invite.
  await page.evaluate(() => {
    window.fixture.roomFailure = true;
    window.fixture.navigate("/play/other-room");
  });
  await page.getByRole("alert").filter({ hasText: "לא ניתן לטעון את החדר" }).waitFor();
  await page.evaluate(() => (window.fixture.roomFailure = false));
  await page.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await page.getByRole("heading", { name: "Game stand-in" }).waitFor();
  await page.evaluate(() => {
    window.fixture.joinFailure = true;
    window.fixture.navigate("/join/code");
  });
  await page.getByRole("alert").filter({ hasText: "לא ניתן לבדוק את ההזמנה" }).waitFor();
  await page.evaluate(() => (window.fixture.joinFailure = false));
  await page.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await page.getByRole("heading", { name: "Game stand-in" }).waitFor();

  // Page crashes and cached lazy rejections recover without reloading the application.
  await page.evaluate(() => {
    window.fixture.throwProfile = true;
    window.fixture.navigate("/profile");
  });
  await page.getByRole("heading", { name: "לא ניתן להציג את המסך כרגע" }).waitFor();
  await page.evaluate(() => {
    window.fixture.throwProfile = false;
    window.fixture.navigate("/home");
  });
  await page.getByText("שלום, Tester!").waitFor();
  await page.evaluate(() => {
    window.fixture.failImports = true;
    window.fixture.navigate("/inbox");
  });
  await page.clock.fastForward(200);
  await page.getByRole("heading", { name: "לא ניתן להציג את המסך כרגע" }).waitFor();
  await page.evaluate(() => (window.fixture.failImports = false));
  await page.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await page.getByRole("heading", { name: "הודעות", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.documentToken), "same document");
  const profilePage = await browser.newPage();
  await profilePage.goto("http://127.0.0.1:19031/__recovery.html?profileFailure=1");
  await profilePage.getByRole("alert").filter({ hasText: "לא ניתן לטעון את הפרופיל" }).waitFor();
  await profilePage.evaluate(() => (window.fixture.profileFailure = false));
  await profilePage.getByRole("button", { name: "נסו שוב", exact: true }).click();
  await profilePage.getByText("שלום, Tester!").waitFor();
  await profilePage.close();
  assert.deepEqual(unexpected, []);
  console.log(
    "PASS: migration errors, malformed data, widget isolation, draft/game preservation, room/join retry, route navigation, lazy retry",
  );
} finally {
  await browser?.close();
  await server.close();
}
