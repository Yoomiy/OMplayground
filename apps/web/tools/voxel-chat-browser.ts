import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";

// Exercise the real dialog/preview independently of SQL and world rendering.
const fixture = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
    loader: "tsx",
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { VoxelChat } from "./src/game/voxel/VoxelChat.tsx";
      import { SessionChatPanel } from "./src/game/SessionChatPanel.tsx";
      import { VoxelApiError } from "./src/game/voxel/session-api.ts";
      const listeners = new Set();
      const sends = new Map();
      let messages = [], held = null;
      window.reads = 0;
      window.sendRequests = [];
      window.abortedSends = 0;
      window.holdRead = false;
      window.replaceMessages = (text) => {
        messages = text ? [{id: "message", sequence: 1, senderId: "peer", senderName: "Peer", message: text, at: new Date().toISOString()}] : [];
        for (const listener of listeners) listener();
      };
      window.seedHistory = () => {
        messages = Array.from({length: 201}, (_, index) => ({id: "history-" + index, sequence: index + 1,
          senderName: "Peer", message: "history " + (index + 1), at: new Date(index * 1000).toISOString()}));
        for (const listener of listeners) listener();
      };
      window.releaseRead = () => { held?.(); held = null; };
      window.ackSend = (id) => {
        sends.get(id).resolve({ requestId: id, messageId: id, action: "send", applied: true, persisted: true });
        sends.delete(id);
      };
      window.commitSend = (id, ack = true) => {
        const message = window.sendRequests.find(request => request.id === id).message;
        if (!messages.some(entry => entry.id === id)) messages = [...messages, { id, message,
          sequence: (messages.at(-1)?.sequence ?? 0) + 1, senderId: "self", senderName: "Server name", at: new Date().toISOString() }];
        for (const listener of listeners) listener();
        if (ack) window.ackSend(id);
      };
      window.rejectSend = (id, code = "UNAVAILABLE") => {
        sends.get(id).reject(new VoxelApiError(code, code === "UNAVAILABLE"));
        sends.delete(id);
      };
      const api = { sendChat: (message, id, signal) => {
        window.sendRequests.push({message, id});
        return new Promise((resolve, reject) => {
          sends.set(id, {resolve, reject});
          signal.addEventListener("abort", () => {
            window.abortedSends++;
            sends.delete(id);
            reject(new DOMException("cancelled", "AbortError"));
          }, {once: true});
        });
      }, chatHistory: async () => {
        window.reads++;
        const snapshot = { messages, before: null };
        if (window.holdRead) {
          window.holdRead = false;
          window.readHeld = true;
          await new Promise(resolve => held = resolve);
        }
        return snapshot;
      }};
      const subscribeChanges = listener => { listeners.add(listener); return () => listeners.delete(listener); };
      window.chatDatabase = {
        from: () => {
          let ascending = true;
          const query = { select: () => query, eq: () => query, order: (_key, options) => {
            ascending = options.ascending; return query;
          }, limit: async (limit) => {
            const page = await api.chatHistory();
            const rows = [...page.messages].sort((a, b) => ascending ? a.sequence - b.sequence : b.sequence - a.sequence).slice(0, limit);
            return { data: rows.map(row => ({id: row.id, sender_name: row.senderName, message: row.message,
              timestamp: row.at, is_system: false, is_deleted: false})), error: null };
          }};
          return query;
        },
        channel: () => {
          let listener;
          const channel = { on: (_kind, _filter, callback) => { listener = callback; listeners.add(callback); return channel; },
            subscribe: () => channel, close: () => listeners.delete(listener) };
          return channel;
        },
        removeChannel: channel => channel.close(),
      };
      const root = createRoot(document.getElementById("root"));
      window.unmount = () => root.unmount();
      window.listenerCount = () => listeners.size;
      const shared = sessionId => <SessionChatPanel sessionId={sessionId} observer={false} canModerate={false} ended={false} send={api.sendChat}/>;
      window.changeSharedRoom = () => root.render(shared("other-room"));
      root.render(new URL(location.href).searchParams.has("shared") ? shared("room") :
        <VoxelChat api={api} isStaff={false} canSend={true} onOpen={() => {}} subscribeChanges={subscribeChanges}/>);
    `,
  },
  bundle: true,
  write: false,
  jsx: "automatic",
  format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
  plugins: [
    {
      name: "chat-fixture",
      setup(plugin) {
        plugin.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
          path: "database",
          namespace: "chat-fixture",
        }));
        plugin.onResolve(
          { filter: /^@\/components\/KidDesktopShell$/ },
          () => ({ path: "shell", namespace: "chat-fixture" }),
        );
        plugin.onLoad(
          { filter: /.*/, namespace: "chat-fixture" },
          ({ path }) => ({
            contents:
              path === "shell"
                ? 'export const desktopPanelClass=()=>"";'
                : "export const supabase={from:(...args)=>window.chatDatabase.from(...args),channel:(...args)=>window.chatDatabase.channel(...args),removeChannel:(channel)=>window.chatDatabase.removeChannel(channel)};",
            loader: "js",
          }),
        );
      },
    },
  ],
});
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? fixture.outputFiles[0].contents
      : '<style>ul[aria-label="הודעות"]{max-height:160px;overflow:auto}</style><div id="root"></div><script src="/fixture.js"></script>',
  );
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert.ok(address && typeof address === "object");
const browser = await launchSoftwareBrowser();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction(() => (window as any).reads === 1);
  await page.evaluate(() =>
    (window as any).replaceMessages("push to closed preview"),
  );
  await page
    .getByLabel("הודעות אחרונות")
    .getByText("push to closed preview", { exact: true })
    .waitFor({ timeout: 1500 });
  await page.getByRole("button", { name: "צ׳אט", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "צ׳אט המשחק", exact: true });
  await dialog.getByText("push to closed preview", { exact: true }).waitFor();
  await page.evaluate(() => {
    (window as any).holdRead = true;
    (window as any).replaceMessages("stale snapshot");
  });
  await page.waitForFunction(() => (window as any).readHeld);
  await page.evaluate(() => {
    (window as any).replaceMessages("new commit during read");
    (window as any).releaseRead();
  });
  await dialog
    .getByText("new commit during read", { exact: true })
    .waitFor({ timeout: 1500 });
  await page.evaluate(() => (window as any).replaceMessages(null));
  await dialog
    .getByText("new commit during read", { exact: true })
    .waitFor({ state: "hidden", timeout: 1500 });
  const input = page.getByRole("textbox", { name: "הודעה למפגש", exact: true });
  const submit = page.getByRole("button", { name: "שליחה", exact: true });
  const row = (text: string) =>
    dialog.locator("li").filter({ has: page.getByText(text, { exact: true }) });
  const send = async (text: string) => {
    await input.fill(text);
    await submit.click();
    await row(text).waitFor({ timeout: 5000 });
    assert.equal(await input.inputValue(), "");
    assert.equal(await input.isEnabled(), true);
    return page.evaluate(
      () => (window as any).sendRequests.at(-1).id as string,
    );
  };
  // These promises stay unresolved: neither persistence nor a read can create the rows.
  // Assert that ordering directly; the browser deadline allows for shared CI CPU contention.
  const first = await send("first immediate message");
  const second = await send("second while first is pending");
  assert.equal(
    await row("first immediate message").getAttribute("data-delivery"),
    "sending",
  );
  assert.equal(
    await row("second while first is pending").getAttribute("data-delivery"),
    "sending",
  );
  // A push can arrive before the sender's HTTP receipt. The row remains unique.
  await page.evaluate((id) => (window as any).commitSend(id, false), first);
  await row("first immediate message")
    .getByText("Server name", { exact: true })
    .waitFor();
  assert.equal(await row("first immediate message").count(), 1);
  await page.evaluate((id) => (window as any).ackSend(id), first);
  await page.evaluate((id) => (window as any).commitSend(id), second);
  await row("second while first is pending")
    .getByText("Server name", { exact: true })
    .waitFor();
  assert.equal(await row("second while first is pending").count(), 1);
  // A lost acknowledgement must retry the same request, with just one visible row.
  const retry = await send("lost acknowledgement");
  await page.evaluate((id) => (window as any).rejectSend(id), retry);
  await row("lost acknowledgement")
    .getByRole("button", { name: "בדיקת בקשת הצ׳אט", exact: true })
    .click();
  const attempts = await page.evaluate(
    (id) =>
      (window as any).sendRequests.filter((request: any) => request.id === id),
    retry,
  );
  assert.equal(attempts.length, 2);
  assert.equal(await row("lost acknowledgement").count(), 1);
  await page.evaluate((id) => (window as any).commitSend(id), retry);
  await row("lost acknowledgement")
    .getByText("Server name", { exact: true })
    .waitFor();
  // Confirming a send must not briefly remove its local row while history is slow.
  const delayedHistory = await send("confirmed before history");
  await page.evaluate((id) => {
    (window as any).readHeld = false;
    (window as any).holdRead = true;
    (window as any).ackSend(id);
  }, delayedHistory);
  await page.waitForFunction(() => (window as any).readHeld);
  assert.equal(
    await row("confirmed before history").getAttribute("data-delivery"),
    "sent",
  );
  // That fresh history is empty for this ID (e.g. already moderated): retire it.
  await page.evaluate(() => (window as any).releaseRead());
  await row("confirmed before history").waitFor({
    state: "hidden",
    timeout: 1500,
  });
  const rejected = await send("server rejected this");
  await page.evaluate(
    (id) => (window as any).rejectSend(id, "NOT_IN_ROOM"),
    rejected,
  );
  await row("server rejected this")
    .getByRole("button", { name: "עריכת ההודעה", exact: true })
    .waitFor();
  assert.equal(
    await row("server rejected this").getAttribute("data-delivery"),
    "failed",
  );
  assert.equal(
    await row("server rejected this")
      .getByRole("button", { name: "בדיקת בקשת הצ׳אט", exact: true })
      .count(),
    0,
  );
  await row("server rejected this")
    .getByRole("button", { name: "עריכת ההודעה", exact: true })
    .click();
  assert.equal(await input.inputValue(), "server rejected this");
  await input.fill("");
  // Unrelated moderation removes canonical rows without resurrecting local echoes.
  await page.evaluate(() => (window as any).replaceMessages(null));
  await row("lost acknowledgement").waitFor({ state: "hidden", timeout: 1500 });
  const closing = await send("pending on close");
  await page.getByRole("button", { name: "צ׳אט", exact: true }).click();
  await page
    .getByLabel("הודעות אחרונות")
    .getByText("pending on close", { exact: true })
    .waitFor({ timeout: 5000 });
  await page.evaluate(() => (window as any).unmount());
  assert.equal(await page.evaluate(() => (window as any).listenerCount()), 0);
  assert.equal(await page.evaluate(() => (window as any).abortedSends), 1);
  assert.ok(closing);
  // Boards, Rocket and Wobble now render this exact shared panel/feed/outbox.
  const shared = await browser.newPage();
  shared.on("pageerror", (error) => errors.push(error.message));
  await shared.goto(`http://127.0.0.1:${address.port}/?shared`);
  await shared.waitForFunction(() => (window as any).reads === 1);
  await shared.evaluate(() => (window as any).seedHistory());
  await shared
    .getByText("history 201", { exact: true })
    .waitFor({ timeout: 5000 });
  await shared.waitForFunction(() => {
    const list = document.querySelector('ul[aria-label="הודעות"]')!;
    return list.scrollHeight - list.clientHeight - list.scrollTop < 32;
  });
  assert.equal(await shared.getByText("history 1", { exact: true }).count(), 0);
  await shared.evaluate(() => (window as any).replaceMessages(null));
  await shared
    .getByText("history 201", { exact: true })
    .waitFor({ state: "hidden" });
  const sharedInput = shared.getByRole("textbox", {
    name: "הודעה לחדר",
    exact: true,
  });
  const sharedRow = (text: string) =>
    shared
      .locator("li")
      .filter({ has: shared.getByText(text, { exact: true }) });
  const sharedSend = async (text: string) => {
    await sharedInput.fill(text);
    await shared.getByRole("button", { name: "שלח", exact: true }).click();
    await sharedRow(text).waitFor({ timeout: 5000 });
    assert.equal(await sharedInput.inputValue(), "");
    return shared.evaluate(
      () => (window as any).sendRequests.at(-1).id as string,
    );
  };
  const sharedFirst = await sharedSend("shared immediate one");
  const sharedSecond = await sharedSend("shared immediate two");
  assert.equal(
    await sharedRow("shared immediate one").getAttribute("data-delivery"),
    "sending",
  );
  await sharedInput.fill("draft while sending");
  await shared.evaluate(
    (id) => (window as any).commitSend(id, false),
    sharedFirst,
  );
  await sharedRow("shared immediate one")
    .getByText("Server name", { exact: true })
    .waitFor();
  assert.equal(await sharedRow("shared immediate one").count(), 1);
  await shared.evaluate((id) => (window as any).ackSend(id), sharedFirst);
  assert.equal(await sharedInput.inputValue(), "draft while sending");
  await shared.evaluate((id) => (window as any).rejectSend(id), sharedSecond);
  await sharedRow("shared immediate two")
    .getByRole("button", { name: "בדיקת בקשת הצ׳אט", exact: true })
    .click();
  assert.equal(
    await shared.evaluate(
      (id) =>
        (window as any).sendRequests.filter((entry: any) => entry.id === id)
          .length,
      sharedSecond,
    ),
    2,
  );
  await shared.evaluate((id) => (window as any).commitSend(id), sharedSecond);
  await sharedRow("shared immediate two")
    .getByText("Server name", { exact: true })
    .waitFor();
  assert.equal(await sharedRow("shared immediate two").count(), 1);
  await shared.evaluate(() => (window as any).replaceMessages(null));
  await sharedRow("shared immediate two").waitFor({
    state: "hidden",
    timeout: 1500,
  });
  await sharedSend("old room pending");
  await shared.evaluate(() => (window as any).changeSharedRoom());
  await sharedRow("old room pending").waitFor({
    state: "hidden",
    timeout: 1500,
  });
  assert.equal(await shared.evaluate(() => (window as any).abortedSends), 1);
  await shared.evaluate(() => (window as any).unmount());
  assert.equal(await shared.evaluate(() => (window as any).listenerCount()), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Chat: immediate concurrent sends, push/receipt reconciliation, retry, rejection, moderation, preview and cleanup passed",
  );
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error("Chat fixture failure", await page.evaluate(() => ({
      url: location.pathname + location.search,
      reads: (window as any).reads,
      listeners: (window as any).listenerCount?.(),
      text: document.body.innerText.slice(-1500),
    })).catch(() => null));
  }
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
