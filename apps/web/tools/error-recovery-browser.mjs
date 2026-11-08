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
window.fixture={challengeListeners:[],invites:[],departures:{},dismissals:[],withdrawals:[],requests:[],entryCalls:[],inspectionCalls:0,roomStatus:'playing',migrationMissing:true,malformedInbox:false,profileFailure:new URLSearchParams(location.search).has('profileFailure'),roomFailure:false,joinFailure:false,failSend:false,gameMounts:0};
function abortable(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const aborted=()=>resolve({data:null,error:{code:'ABORTED',message:'Request aborted'}});
  if(signal.aborted){aborted();return;}
  signal.addEventListener('abort',aborted,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
 });
}
Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{user:{id:uid}}},error:null})});
Object.defineProperty(supabase.auth,'onAuthStateChange',{value:()=>({data:{subscription:{unsubscribe(){}}}})});
Object.defineProperty(supabase,'from',{value:table=>{
 let fields='',filters={},signal;
 const result=async(single=false)=>{
   if(table==='kid_profiles'){
     if(window.fixture.profileFailure && fields.includes('username')) throw new Error('fixture profile transport');
     return {data:profile,error:null};
   }
   if(table==='game_sessions' && single){
     if(fields==='status'){
       window.fixture.inspectionCalls++;
       if(window.fixture.inspectionHang)await new Promise(resolve=>window.fixture.finishInspection=resolve);
       if(window.fixture.inspectionFailure)return {data:null,error:{code:'NETWORK',message:'fixture inspection failure'}};
       return {data:window.fixture.roomStatus===null?null:{status:window.fixture.roomStatus},error:null};
     }
     if(window.fixture.roomFailure || (filters.invitation_code && window.fixture.joinFailure)) throw new Error('fixture room transport');
     return {data:{id:'room',status:'playing',games:{name_he:'Fixture game',game_url:'chess'}},error:null};
   }
   return {data:single?null:[],error:null};
 };
 const q={select:value=>{fields=value;return q;},eq:(key,value)=>{filters[key]=value;return q;},abortSignal:value=>{signal=value;return q;},in:()=>q,not:()=>q,contains:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>abortable(result(true),signal),then:(resolve,reject)=>result().then(resolve,reject)};
 return q;
}});
Object.defineProperty(supabase,'channel',{value:()=>{const c={on:(type,filter,callback)=>{if(filter?.table==='game_challenges')window.fixture.challengeListeners.push(callback);return c;},subscribe:()=>c,track:async()=>{},presenceState:()=>({})};return c;}});
Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
Object.defineProperty(supabase,'rpc',{value:(name,args)=>{
 const request=(async()=>{
 window.fixture.requests.push(name);
 if(name==='accept_game_challenge'||name==='prepare_challenge_entry'){
   window.fixture.entryCalls.push({name,...args});
   if(window.fixture.entryHang)await new Promise(resolve=>window.fixture.finishEntry=resolve);
   if(window.fixture.entryFailure)return {data:null,error:{code:'P0001',message:'PLAYER_IN_ANOTHER_GAME'}};
   const row=window.fixture.invites.find(row=>row.id===args.p_id);
   if(name==='accept_game_challenge')row.status='accepted';
   return {data:row.session_id,error:null};
 }
 if(name==='list_game_challenges')return window.fixture.migrationMissing?{data:null,error:{code:'PGRST202',message:'missing function'}}:{data:structuredClone(window.fixture.invites)};
 if(name==='challenge_departure')return {data:window.fixture.departures[args.p_session_id]??null};
 if(name==='resolve_game_challenges'){
   window.fixture.dismissals.push(args.p_ids);
   if(window.fixture.failDismiss)return {error:{message:'fixture dismiss failure'}};
   if(window.fixture.delayDismiss)await new Promise(resolve=>window.fixture.resolveDismiss=resolve);
   for(const row of window.fixture.invites.filter(row=>args.p_ids.includes(row.id)))window.fixture.departures[row.session_id]={actor:uid,closed_room:row.session_status==='waiting'};window.fixture.invites=window.fixture.invites.filter(row=>!args.p_ids.includes(row.id));return {data:args.p_ids.length};
 }
 if(name==='respond_game_challenge'){
   window.fixture.withdrawals.push(args);
   const row=window.fixture.invites.find(row=>row.id===args.p_id);
   if(args.p_action==='accept'){row.status='accepted';return {data:row};}
   window.fixture.departures[row.session_id]={actor:uid,closed_room:row.session_status==='waiting'};
   window.fixture.invites=window.fixture.invites.filter(row=>row.id!==args.p_id);return {data:{}};
 }
 if(name==='list_private_threads')return {data:window.fixture.malformedInbox?{threads:[{}],unread_total:1}:{threads:[{partnerId:other,partner,lastMessage:message,unreadCount:1}],unread_total:1}};
 if(name==='mark_private_messages_read'){message.is_read=true;return {data:null};}
 if(name==='get_private_thread')return {data:{partner,messages:[message]}};
 if(name==='send_private_message')return window.fixture.failSend?{error:{message:'fixture send failure'}}:{data:{}};
 return {data:null};
 })();
 request.abortSignal=signal=>abortable(request,signal);
 return request;
}});
function Controls(){const navigate=useNavigate();window.fixture.navigate=navigate;return null;}
window.history.replaceState(null,'','/home');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><PlaygroundUserProvider><Controls/><App/></PlaygroundUserProvider></AuthProvider></BrowserRouter>);
`;

const gameStandIn = `
import React,{useEffect,useState} from 'react';
export function GameSessionContainer(){const [moves,setMoves]=useState(0);useEffect(()=>{window.fixture.gameMounts++;return()=>{window.fixture.gameUnmounts=(window.fixture.gameUnmounts??0)+1}},[]);return <main><h1>Game stand-in</h1><button onClick={()=>setMoves(n=>n+1)}>Move {moves}</button></main>}
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
        if (process.argv.includes("--challenge-entry") && id.endsWith("/game/SoloGameContainer.tsx"))
          return gameStandIn + '\nexport default GameSessionContainer;';
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
  if (process.argv.includes("--challenge-entry")) {
    await challengeEntryChecks(page);
    assert.deepEqual(unexpected, []);
  } else if (process.argv.includes("--challenges")) {
    await challengeChecks(page);
    assert.deepEqual(unexpected, []);
  } else {
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
  }
} finally {
  await browser?.close();
  await server.close();
}

async function challengeEntryChecks(page) {
  const panel = page.getByRole("dialog", { name: "הזמנות למשחק", exact: true });
  const prompt = page.getByRole("dialog", { name: "מעבר להזמנה מאושרת", exact: true });
  const openPanel = async () => {
    if (!(await panel.isVisible()))
      await page.getByRole("button", { name: "הזמנות למשחק, 1", exact: true }).click();
  };
  await page.evaluate(() => {
    window.fixture.makeEntryInvite = (pending = false) => ({
      id: "Entry", from_kid_id: pending ? "00000000-0000-0000-0000-000000000002" : "00000000-0000-0000-0000-000000000001",
      to_kid_id: pending ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002",
      session_id: "target-room", game_id: "chess", status: pending ? "pending" : "accepted",
      created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 120000).toISOString(),
      partner_name: "Friend", partner_role: "kid", game_name: "Chess", self_busy: true,
      partner_busy: false, self_in_session: false, partner_in_session: true,
      can_cancel: true, session_status: "waiting",
    });
    window.fixture.navigate("/solo/chess-solo");
    window.fixture.migrationMissing = false;
    window.fixture.invites = [window.fixture.makeEntryInvite()];
    window.dispatchEvent(new Event("challenges-retry"));
  });
  await page.getByRole("button", { name: "Move 0", exact: true }).click();
  await openPanel();
  await panel.getByRole("button", { name: "כניסה לחדר", exact: true }).click();
  await prompt.getByText("אתם באמצע משחק יחיד", { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.entryCalls.length), 0);
  assert.equal(await page.evaluate(() => window.fixture.inspectionCalls), 0);
  await prompt.getByRole("button", { name: "להישאר כאן" }).click();
  await page.getByRole("button", { name: "Move 1", exact: true }).waitFor();
  await openPanel();
  await panel.getByRole("button", { name: "כניסה לחדר", exact: true }).click();
  await prompt.getByRole("button", { name: "כן, לעבור לחדר" }).click();
  await page.waitForURL("**/play/target-room?mode=player");

  // The recipient confirms departure before acceptance; a failed switch stays pending.
  await page.evaluate(() => {
    window.fixture.roomStatus = "playing";
    window.fixture.navigate("/play/current-room");
    window.fixture.invites = [window.fixture.makeEntryInvite(true)];
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await openPanel();
  await panel.getByRole("button", { name: "קבלה וכניסה", exact: true }).click();
  await prompt.getByText("קבלת ההזמנה תוציא אתכם מהמשחק הפעיל", { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.invites[0].status), "pending");
  await page.evaluate(() => (window.fixture.entryFailure = true));
  await prompt.getByRole("button", { name: "קבלה וכניסה לחדר", exact: true }).click();
  await panel.getByText("לא ניתן להיכנס כרגע", { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.invites[0].status), "pending");
  assert.match(page.url(), /\/play\/current-room$/);
  await page.evaluate(() => (window.fixture.entryFailure = false));
  await panel.getByRole("button", { name: "קבלה וכניסה", exact: true }).click();
  await prompt.getByRole("button", { name: "קבלה וכניסה לחדר", exact: true }).click();
  await page.waitForURL("**/play/target-room?mode=player");
  assert.deepEqual(await page.evaluate(() => window.fixture.entryCalls.at(-1)), {
    name: "accept_game_challenge", p_id: "Entry", p_leave_session: "current-room",
  });

  // A hanging lookup is bounded and shared with a manual inspection, then recoverable.
  await page.evaluate(() => {
    window.fixture.inspectionHang = true;
    window.fixture.invites = [window.fixture.makeEntryInvite()];
    window.fixture.navigate("/play/unverified-room");
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await openPanel();
  const calls = await page.evaluate(() => window.fixture.inspectionCalls);
  await panel.getByRole("button", { name: "בדיקה וכניסה לחדר", exact: true }).click();
  await panel.getByText("לא ניתן לבדוק את מצב החדר הנוכחי", { exact: false }).waitFor({ timeout: 12000 });
  assert.equal(await page.evaluate(() => window.fixture.inspectionCalls), calls);
  assert.equal(await panel.getByRole("button", { name: "בדיקה וכניסה לחדר", exact: true }).isEnabled(), true);
  await page.evaluate(() => {
    window.fixture.inspectionHang = false;
    window.fixture.roomStatus = "paused";
  });
  await panel.getByRole("button", { name: "בדיקה וכניסה לחדר", exact: true }).click();
  await page.waitForURL("**/play/target-room?mode=player");

  // A late entry response cannot redirect a user who has moved to a different solo game.
  await page.evaluate(() => {
    window.fixture.entryHang = true;
    window.fixture.navigate("/solo/chess-solo");
  });
  await openPanel();
  await panel.getByRole("button", { name: "כניסה לחדר", exact: true }).click();
  await prompt.getByRole("button", { name: "כן, לעבור לחדר" }).click();
  await page.waitForFunction(() => !!window.fixture.finishEntry);
  await page.evaluate(() => window.fixture.navigate("/solo/another-solo"));
  await page.getByRole("button", { name: "הזמנות למשחק, 1", exact: true }).waitFor();
  await page.evaluate(() => {
    window.fixture.entryHang = false;
    window.fixture.finishEntry();
  });
  await openPanel();
  assert.equal(await panel.getByRole("button", { name: "כניסה לחדר", exact: true }).isEnabled(), true);
  assert.match(page.url(), /\/solo\/another-solo$/);
  assert.equal(await page.evaluate(() => window.documentToken), "same document");
  console.log("PASS: solo entry/stay, acceptance confirms active-game departure, failed acceptance stays pending, bounded/coalesced inspection and stale entry cancellation");
}

async function challengeChecks(page) {
  await page.evaluate(() => {
    const make = (id, overrides = {}) => ({
      id,
      from_kid_id: "00000000-0000-0000-0000-000000000001",
      to_kid_id: "00000000-0000-0000-0000-000000000002",
      session_id: id + "-room",
      game_id: "chess",
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120000).toISOString(),
      partner_name: id,
      partner_role: "kid",
      game_name: "Chess",
      self_busy: false,
      partner_busy: false,
      self_in_session: false,
      partner_in_session: false,
      can_cancel: true,
      session_status: "waiting",
      ...overrides,
    });
    window.fixture.makeInvite = make;
    window.fixture.migrationMissing = false;
    window.fixture.invites = [
      make("Outgoing"),
      make("Stale", {
        from_kid_id: "00000000-0000-0000-0000-000000000002",
        to_kid_id: "00000000-0000-0000-0000-000000000001",
        status: "accepted",
        self_in_session: true,
      }),
      make("History", { status: "accepted", session_status: "completed" }),
    ];
    window.dispatchEvent(new Event("challenges-retry"));
  });
  const panel = page.getByRole("dialog", { name: "הזמנות למשחק", exact: true });
  await page.getByRole("button", { name: "הזמנות למשחק, 2", exact: true }).click();
  assert.equal(await panel.getByRole("button", { name: "הסתיימו", exact: true }).count(), 0);
  assert.equal(await panel.getByRole("article").count(), 2);
  assert.equal(await panel.getByText("אתם בחדר", { exact: true }).count(), 0);
  assert.equal(await panel.getByText("History", { exact: true }).count(), 0);
  // Accepted cancellation always resolves before the card disappears.
  await panel
    .getByRole("article")
    .filter({ hasText: "Stale" })
    .getByRole("button", { name: "ביטול והסרה", exact: true })
    .click();
  await panel.getByRole("article").filter({ hasText: "Stale" }).waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.fixture.withdrawals.at(-1).p_action), "decline");
  // Cancel remains available with old server presence and even after another player entered.
  await panel.getByRole("button", { name: "ביטול הזמנה", exact: true }).click();
  await page
    .getByRole("button", { name: "הזמנות למשחק, 2", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.fixture.withdrawals.at(-1).p_action), "cancel");
  // Clean all snapshots the list: a later arrival survives the pending request.
  await page.evaluate(() => {
    window.fixture.invites = [
      window.fixture.makeInvite("First"),
      window.fixture.makeInvite("Second"),
    ];
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await page.getByRole("button", { name: "הזמנות למשחק, 2", exact: true }).click();
  await page.evaluate(() => (window.fixture.delayDismiss = true));
  await panel.getByRole("button", { name: "ניקוי הכל", exact: true }).click();
  await page.waitForFunction(() => !!window.fixture.resolveDismiss);
  await page.evaluate(() => {
    window.fixture.invites.push(window.fixture.makeInvite("Later"));
    window.fixture.resolveDismiss();
    window.fixture.delayDismiss = false;
  });
  await panel.getByRole("article").filter({ hasText: "Later" }).waitFor();
  assert.equal(await panel.getByRole("article").count(), 1);
  assert.deepEqual(await page.evaluate(() => window.fixture.dismissals.at(-1)), [
    "First",
    "Second",
  ]);
  await page.keyboard.press("Escape");
  // Declining an accepted, running invitation unmounts just that game and returns home.
  await page.evaluate(() => {
    window.fixture.invites = [
      window.fixture.makeInvite("Active", {
        status: "accepted",
        session_status: "playing",
        session_id: "room",
        from_kid_id: "00000000-0000-0000-0000-000000000002",
        to_kid_id: "00000000-0000-0000-0000-000000000001",
      }),
    ];
    window.fixture.navigate("/play/room");
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await page.getByRole("heading", { name: "Game stand-in" }).waitFor();
  await page.getByRole("button", { name: "הזמנות למשחק, 1", exact: true }).click();
  await panel.getByRole("button", { name: "ביטול ויציאה", exact: true }).click();
  await page.getByText("שלום, Tester!").waitFor();
  assert.equal(await page.evaluate(() => window.fixture.gameUnmounts), 1);
  await page.getByRole("status").filter({ hasText: "יצאתם מהחדר" }).waitFor();
  // A withdrawal arriving from another tab/device works without a visible challenge/history row.
  await page.evaluate(() => {
    window.fixture.navigate("/play/remote-room");
  });
  await page.getByRole("heading", { name: "Game stand-in" }).waitFor();
  await page.evaluate(() => {
    window.fixture.departures["remote-room"] = {
      actor: "00000000-0000-0000-0000-000000000002",
      closed_room: false,
    };
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByRole("button", { name: "Move 0", exact: true }).click();
  await page.getByRole("button", { name: "Move 1", exact: true }).waitFor(); // peer's active-game withdrawal does not eject me
  await page.evaluate(() => {
    window.fixture.departures["remote-room"] = {
      actor: "00000000-0000-0000-0000-000000000001",
      closed_room: false,
    };
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    for (const listener of window.fixture.challengeListeners)
      listener({
        new: {
          session_id: "remote-room",
          withdrawn_by: "00000000-0000-0000-0000-000000000001",
          withdrawn_at: new Date().toISOString(),
          withdrawn_phase: "playing",
        },
      });
  });
  await page.getByText("שלום, Tester!").waitFor();
  await page.evaluate(() =>
    Object.defineProperty(document, "hidden", { value: false, configurable: true }),
  );
  assert.equal(await page.evaluate(() => window.fixture.gameUnmounts), 2);
  assert.equal(await page.evaluate(() => window.documentToken), "same document");
  console.log(
    "PASS: no history, departed-room perspective, resolved removal, clear-all snapshot, cancellation, accepted decline leaves game, remote departure and peer isolation",
  );
}
