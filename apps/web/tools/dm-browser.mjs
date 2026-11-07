import { createServer } from "vite";
import { chromium } from "../../../games/wobble-rush/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,useNavigate} from 'react-router-dom';
import {AuthProvider,useAuth} from '/src/hooks/useAuth';import {PlaygroundUserProvider} from '/src/hooks/usePlaygroundUser';
import {ChallengeDock} from '/src/components/ChallengeDock';import {KidActionSheet} from '/src/components/KidActionSheet';import {WobbleRematchControls} from '/src/game/WobbleRematchControls';
import {InboxProvider,useInbox} from '/src/hooks/useInbox';import {GlobalMessages} from '/src/components/GlobalMessages';import {supabase} from '/src/lib/supabase';import '/src/index.css';
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',fresh='00000000-0000-0000-0000-000000000003';
const person=id=>({id,full_name:id===other?'Teacher Alice':'Bob',role:id===other?'teacher':'kid',can_send:true});
const row=(id)=>({id:String(id),from_kid_id:other,to_kid_id:uid,from_display_name:'Teacher Alice',content:'Message '+id,is_read:false,created_at:new Date(1700000000000+id*1000).toISOString()});
window.fixture={roomStatuses:{'first-room':'playing','second-room':'waiting'},prepared:[],fail:false,requests:[],reads:[],messages:Array.from({length:51},(_,i)=>row(51-i)),incoming:null};
window.fixture.invites=[{id:'challenge-b',from_kid_id:uid,to_kid_id:other,session_id:'second-room',game_id:'chess',game_name:'שחמט',partner_name:'נועם',partner_role:'kid',status:'accepted',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+300000).toISOString(),self_busy:true,partner_busy:false,self_in_session:false,partner_in_session:true,can_cancel:false},{id:'challenge-c',from_kid_id:uid,to_kid_id:fresh,session_id:'third-room',game_id:'chess',game_name:'שחמט',partner_name:'דנה',partner_role:'kid',status:'pending',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),self_busy:true,partner_busy:false,self_in_session:false,partner_in_session:false,can_cancel:true}];
Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{user:{id:uid}}},error:null})});
Object.defineProperty(supabase.auth,'onAuthStateChange',{value:(callback)=>{window.fixture.authChange=callback;return {data:{subscription:{unsubscribe(){}}}};}});
Object.defineProperty(supabase,'from',{value:(table)=>{let selected;const q={select:()=>q,eq:(key,value)=>{if(key==='id')selected=value;return q;},in:()=>q,order:async()=>({data:[{id:'chess',name_he:'שחמט'}],error:null}),maybeSingle:async()=>({data:table==='kid_profiles'?{id:uid,full_name:'Kid',gender:'boy',role:'kid'}:table==='game_sessions'?{status:window.fixture.roomStatuses[selected]??'waiting'}:null,error:null})};return q;}});
Object.defineProperty(supabase,'channel',{value:()=>{const c={on:(type,filter,callback)=>{if(filter?.table==='private_messages')window.fixture.incoming=callback;return c;},subscribe:()=>c};return c;}});
Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
Object.defineProperty(supabase,'rpc',{value:async(name,args)=>{
 if(name==='prepare_challenge_entry'){window.fixture.prepared.push(args);return {data:window.fixture.invites.find(row=>row.id===args.p_id)?.session_id};}
 if(name==='create_game_challenge')return {data:{session_id:'new-room',challenge_id:'newly-sent'}};
 if(name==='list_game_challenges')return {data:structuredClone(window.fixture.invites)};
 if(name==='list_private_threads')return {data:{unread_total:500,threads:[{partnerId:other,partner:person(other),lastMessage:window.fixture.latest??row(51),unreadCount:500}]}};
 if(name==='get_private_thread')return {data:{partner:person(args.p_partner),messages:args.p_partner===other?(args.p_before?window.fixture.messages.slice(50):window.fixture.messages):[]}};
 if(name==='mark_private_messages_read'){window.fixture.reads.push(...args.p_ids);window.fixture.messages=window.fixture.messages.map(m=>args.p_ids.includes(m.id)?{...m,is_read:true}:m);return {data:null};}
 if(name==='send_private_message'){window.fixture.requests.push(args);return window.fixture.fail?{error:{message:'fixture failure'}}:{data:{}};}
 return {data:null};
}});
function Entry(){const inbox=useInbox(),{user}=useAuth(),navigate=useNavigate(),[sheet,setSheet]=React.useState(false);return <><button onClick={()=>navigate('/home')}>Home</button><button onClick={()=>setSheet(true)}>Challenge Bob</button><KidActionSheet kid={sheet?{id:fresh,full_name:'Bob',username:'bob',gender:'boy',grade:3,role:'kid',avatar_color:'#8b5cf6',avatar_url:null,avatar_preset_id:null}:null} onClose={()=>setSheet(false)}/><button onClick={()=>navigate('/play/first-room')}>Game one</button><ChallengeDock/><div data-testid='rematch-controls'><WobbleRematchControls view={{selfUserId:uid,saved:true,players:[{userId:uid,connected:true},{userId:other,connected:true}],rematch:{id:'vote',requestedBy:uid,accepted:[uid],refused:[]}}} error={null} control={()=>{}}/></div><div id="game"><button onClick={e=>e.currentTarget.parentElement.requestFullscreen()}>Fullscreen game</button></div><button onClick={()=>inbox.select(fresh)}>New person</button><GlobalMessages key={user?.id}/></>;}
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><PlaygroundUserProvider><InboxProvider><Entry/></InboxProvider></PlaygroundUserProvider></AuthProvider></BrowserRouter>);
`;
process.chdir(new URL("../", import.meta.url).pathname);
process.env.VITE_SUPABASE_URL = "http://127.0.0.1:19029";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fixture-key";
const server = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  plugins: [
    {
      name: "dm-browser-fixture",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/__dm_fixture.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              req.url,
              '<html><body><div id="root"></div><script type="module" src="/__dm_fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
      resolveId(id) {
        if (id === "/__dm_fixture.tsx") return id;
      },
      load(id) {
        if (id === "/__dm_fixture.tsx") return fixture;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 19029, strictPort: true },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } }),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  await page.addInitScript(() => {
    window.notificationRequests = 0;
    window.browserNotes = [];
    window.Notification = class {
      static permission = "default";
      static async requestPermission() {
        window.notificationRequests++;
        this.permission = "granted";
        return "granted";
      }
      constructor(title, options) {
        this.title = title;
        this.options = options;
        window.browserNotes.push(this);
      }
      close() {
        this.closed = true;
      }
    };
  });
  await page.goto("http://127.0.0.1:19029/__dm_fixture.html");
  await page.getByRole("button", { name: "Game one", exact: true }).click();
  const invitationButton = page.getByRole("button", { name: "הזמנות למשחק, 2", exact: true });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) =>
        button.getAttribute("aria-label") === "הזמנות למשחק, 2" &&
        button.getBoundingClientRect().y > 650,
    ),
  );
  await invitationButton.click();
  const invitationDialog = page.getByRole("dialog", { name: "הזמנות למשחק", exact: true });
  await invitationDialog
    .getByText("נועם כבר בחדר ומחכה לכם. אתם במשחק אחר — צאו ממנו כשתרצו להצטרף.", { exact: true })
    .waitFor();
  const before = await invitationDialog.locator("time").first().textContent();
  await page.waitForTimeout(1100);
  const after = await invitationDialog.locator("time").first().textContent();
  assert.notEqual(before, after);
  if (process.env.CHALLENGE_SCREENSHOT)
    await invitationDialog.screenshot({ path: process.env.CHALLENGE_SCREENSHOT });
  await page.mouse.click(1050, 10);
  await invitationDialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Challenge Bob", exact: true }).click();
  const challengeMenu = page.locator('[aria-labelledby="kid-action-title"]');
  await challengeMenu.getByRole("button", { name: /שחמט/ }).click();
  await challengeMenu.waitFor({ state: "hidden" });
  await page.getByText("ההזמנה לBob נשלחה", { exact: true }).waitFor();
  await page.getByRole("button", { name: "סגירת הודעת הזמנה", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.evaluate(() => {
    window.fixture.invites[0].self_busy = false;
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await page.getByText("התפניתם? ההזמנה עדיין מחכה לכם", { exact: true }).waitFor();
  assert.ok(page.url().endsWith("/home"));
  await page
    .getByRole("status")
    .filter({ hasText: "התפניתם?" })
    .getByRole("button", { name: "כניסה לחדר", exact: true })
    .click();
  await page.waitForURL("**/play/second-room*");
  await page
    .getByText("התפניתם? ההזמנה עדיין מחכה לכם", { exact: true })
    .waitFor({ state: "hidden" });
  // A later acceptance must still ask even when its invitation existed before this lobby was chosen.
  await page.evaluate(() => {
    window.fixture.invites[1].status = "accepted";
    window.dispatchEvent(new Event("challenges-changed"));
  });
  const laterPrompt = page.getByRole("dialog", { name: "מעבר להזמנה מאושרת", exact: true });
  await laterPrompt.getByRole("heading", { name: "לעבור לחדר של דנה?", exact: true }).waitFor();
  assert.ok(page.url().includes("/play/second-room"));
  await laterPrompt.getByRole("button", { name: "להישאר כאן", exact: true }).click();
  await page.evaluate(() => {
    window.fixture.invites[1].status = "pending";
    window.dispatchEvent(new Event("challenges-changed"));
  });
  // Waiting rooms ask; a start racing the confirmation must keep the invitation and current game.
  await page.evaluate(() => {
    window.fixture.roomStatuses["first-room"] = "waiting";
  });
  await page.getByRole("button", { name: "Game one", exact: true }).click();
  const switchPrompt = page.getByRole("dialog", { name: "מעבר להזמנה מאושרת", exact: true });
  await switchPrompt.waitFor();
  assert.ok(page.url().includes("/play/first-room"));
  await switchPrompt.getByRole("button", { name: "להישאר כאן", exact: true }).click();
  await invitationButton.click();
  await invitationDialog.getByRole("button", { name: "כניסה לחדר", exact: true }).click();
  await switchPrompt.waitFor();
  await page.evaluate(() => {
    window.fixture.roomStatuses["first-room"] = "playing";
  });
  await switchPrompt.getByRole("button", { name: "כן, לעבור לחדר", exact: true }).click();
  await switchPrompt.waitFor({ state: "hidden" });
  assert.ok(page.url().includes("/play/first-room"));
  await invitationDialog
    .getByText("המשחק הנוכחי התחיל בינתיים. ההזמנה מחכה לכם כאן", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  for (const phase of ["completed", "paused"]) {
    await page.evaluate(() => {
      window.fixture.roomStatuses["first-room"] = "playing";
    });
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "Game one", exact: true }).click();
    await page.evaluate((phase) => {
      window.fixture.roomStatuses["first-room"] = phase;
      window.dispatchEvent(new Event("focus"));
    }, phase);
    await page.waitForURL("**/play/second-room*");
    assert.equal(await switchPrompt.isVisible(), false);
  }
  // Accepted invitations survive old expiry timestamps and a target that has already started.
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.evaluate(() => {
    window.fixture.invites[0].expires_at = new Date(Date.now() - 3600000).toISOString();
    window.fixture.invites[0].partner_in_session = false;
    window.fixture.invites[0].session_status = "playing";
    window.dispatchEvent(new Event("challenges-changed"));
  });
  await invitationButton.click();
  await invitationDialog.getByRole("button", { name: "כניסה לחדר", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByTestId("rematch-controls")
      .getByRole("button", { name: /לא הפעם/ })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Fullscreen game", exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement?.id === "game");
  await page
    .locator("#game")
    .getByRole("button", { name: "הודעות, 500 לא נקראו", exact: true })
    .click();
  await page.waitForFunction(() => !document.fullscreenElement);
  const dialog = page.getByRole("dialog", { name: "הודעות פרטיות" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: /Teacher Alice/ }).click();
  await dialog.getByLabel("כתיבת הודעה").fill("draft A");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New person" }).click();
  await dialog.getByLabel("כתיבת הודעה").fill("hello Bob");
  await page.evaluate(() => {
    window.fixture.fail = true;
  });
  await dialog.getByRole("button", { name: "שליחה", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByLabel("כתיבת הודעה").inputValue(), "hello Bob");
  await page.evaluate(() => {
    window.fixture.fail = false;
  });
  await dialog.getByRole("button", { name: "שליחה", exact: true }).click();
  await page.waitForFunction(() => window.fixture.requests.length === 2);
  const requests = await page.evaluate(() => window.fixture.requests);
  assert.equal(requests[0].p_request_id, requests[1].p_request_id);
  await dialog.getByRole("button", { name: /Teacher Alice/ }).click();
  assert.equal(await dialog.getByLabel("כתיבת הודעה").inputValue(), "draft A");
  await dialog.getByRole("button", { name: "הודעות קודמות" }).click();
  await dialog.getByText("Message 1", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "הודעות, 500 לא נקראו", exact: true }).click();
  await dialog.getByRole("button", { name: "חזרה", exact: true }).click();
  await dialog.getByRole("button", { name: /Teacher Alice/ }).waitFor();
  assert.equal(await page.evaluate(() => window.notificationRequests), 0);
  await dialog.getByRole("button", { name: "הפעלת התראות דפדפן", exact: true }).click();
  assert.equal(await page.evaluate(() => window.notificationRequests), 1);
  const claimed = await page.evaluate(async () => {
    const { claimMessageAlert } = await import("/src/lib/messageNotifications.ts");
    return Promise.all([
      claimMessageAlert("fixture", "dedup"),
      claimMessageAlert("fixture", "dedup"),
    ]);
  });
  assert.deepEqual(claimed.sort(), [false, true]);
  await page.evaluate(() => {
    window.fixture.hidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => window.fixture.hidden,
    });
    window.fixture.latest = {
      ...window.fixture.messages[0],
      id: "new-notification",
      content: "New message preview",
      is_read: false,
    };
    window.fixture.incoming();
  });
  await page.waitForFunction(() => window.browserNotes.length === 1);
  assert.equal(
    await page.evaluate(() => window.browserNotes[0].options.body),
    "New message preview",
  );
  await page.evaluate(() => window.fixture.incoming());
  assert.equal(await page.evaluate(() => window.browserNotes.length), 1);
  await page.evaluate(() => {
    window.fixture.hidden = false;
    window.browserNotes[0].onclick();
  });
  await dialog.getByLabel("כתיבת הודעה").waitFor();
  await page.evaluate(() => window.fixture.authChange("SIGNED_OUT", null));
  await dialog.waitFor({ state: "hidden" });
  await page.evaluate(() =>
    window.fixture.authChange("SIGNED_IN", {
      user: { id: "00000000-0000-0000-0000-000000000009" },
    }),
  );
  await page.getByRole("button", { name: "New person" }).click();
  await dialog.getByLabel("כתיבת הודעה").waitFor();
  assert.equal(await dialog.getByLabel("כתיבת הודעה").inputValue(), "");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: drawer, first-message composer, mobile navigation, draft isolation, failed-send retry nonce, history paging, unread count, Escape, invitation dock, live countdown, busy-challenger copy, available-again reminder, waiting-room confirmation, start/switch race, automatic finished/paused entry, durable accepted listing, full-inbox expansion, send-and-close feedback, outside dismissal, requester-only actions, opt-in browser alerts, atomic duplicate claims, notification click, logout isolation and browser errors",
  );
} finally {
  await browser?.close();
  await server.close();
}
