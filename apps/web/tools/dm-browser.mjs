import { createServer } from "vite";
import { chromium } from "../../../games/wobble-rush/node_modules/@playwright/test/index.mjs";
import assert from "node:assert/strict";
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '/src/hooks/useAuth';import {PlaygroundUserProvider} from '/src/hooks/usePlaygroundUser';
import {InboxProvider,useInbox} from '/src/hooks/useInbox';import {GlobalMessages} from '/src/components/GlobalMessages';import {supabase} from '/src/lib/supabase';import '/src/index.css';
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',fresh='00000000-0000-0000-0000-000000000003';
const person=id=>({id,full_name:id===other?'Teacher Alice':'Bob',role:id===other?'teacher':'kid',can_send:true});
const row=(id)=>({id:String(id),from_kid_id:other,to_kid_id:uid,from_display_name:'Teacher Alice',content:'Message '+id,is_read:false,created_at:new Date(1700000000000+id*1000).toISOString()});
window.fixture={fail:false,requests:[],reads:[],messages:Array.from({length:51},(_,i)=>row(51-i)),incoming:null};
Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{user:{id:uid}}},error:null})});
Object.defineProperty(supabase.auth,'onAuthStateChange',{value:(callback)=>{window.fixture.authChange=callback;return {data:{subscription:{unsubscribe(){}}}};}});
Object.defineProperty(supabase,'from',{value:(table)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='kid_profiles'?{id:uid,full_name:'Kid',gender:'boy',role:'kid'}:null,error:null})};return q;}});
Object.defineProperty(supabase,'channel',{value:()=>{const c={on:(type,filter,callback)=>{window.fixture.incoming=callback;return c;},subscribe:()=>c};return c;}});
Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
Object.defineProperty(supabase,'rpc',{value:async(name,args)=>{
 if(name==='list_private_threads')return {data:{unread_total:500,threads:[{partnerId:other,partner:person(other),lastMessage:window.fixture.latest??row(51),unreadCount:500}]}};
 if(name==='get_private_thread')return {data:{partner:person(args.p_partner),messages:args.p_partner===other?(args.p_before?window.fixture.messages.slice(50):window.fixture.messages):[]}};
 if(name==='mark_private_messages_read'){window.fixture.reads.push(...args.p_ids);window.fixture.messages=window.fixture.messages.map(m=>args.p_ids.includes(m.id)?{...m,is_read:true}:m);return {data:null};}
 if(name==='send_private_message'){window.fixture.requests.push(args);return window.fixture.fail?{error:{message:'fixture failure'}}:{data:{}};}
 return {data:null};
}});
function Entry(){const inbox=useInbox(),{user}=useAuth();return <><div id="game"><button onClick={e=>e.currentTarget.parentElement.requestFullscreen()}>Fullscreen game</button></div><button onClick={()=>inbox.select(fresh)}>New person</button><GlobalMessages key={user?.id}/></>;}
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
  await page.getByRole("button", { name: "Fullscreen game", exact: true }).click();
  await page.waitForFunction(()=>document.fullscreenElement?.id==='game');
  await page.locator('#game').getByRole("button", { name: "הודעות, 500 לא נקראו", exact: true }).click();
  await page.waitForFunction(()=>!document.fullscreenElement);
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
    "PASS: drawer, first-message composer, mobile navigation, draft isolation, failed-send retry nonce, history paging, unread count, Escape, opt-in browser alerts, atomic duplicate claims, notification click, logout isolation and browser errors",
  );
} finally {
  await browser?.close();
  await server.close();
}
