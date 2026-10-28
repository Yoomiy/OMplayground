import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import WebSocket, { WebSocketServer } from "ws";
import { SignalRequest, SignalResponse } from "@livekit/protocol";
import { VoiceSignaling } from "../src/voice-signaling.ts";
async function wait(check: () => boolean) {
  const until = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > until) throw new Error("Signaling condition timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
function probe(url: string, origin?: string) {
  const socket = new WebSocket(url, {
      headers: origin ? { Origin: origin } : undefined,
    }),
    frames: Buffer[] = [];
  socket.on("message", (data) => frames.push(Buffer.from(data as Buffer)));
  socket.on("error", () => {});
  const opened = new Promise<number>((resolve) => {
    socket.once("open", () => resolve(101));
    socket.once("unexpected-response", (_request, response) => {
      const status = response.statusCode!;
      response.resume();
      socket.terminate();
      resolve(status);
    });
    socket.once("error", () => resolve(0));
  });
  return { socket, frames, opened };
}
async function edge(endpoint: string) {
  const relay = new VoiceSignaling(endpoint, ["https://school.invalid"], true);
  await relay.ready;
  const http = createServer((request, response) => {
    if (!relay.handleHttp(request, response)) {
      response.writeHead(404);
      response.end();
    }
  });
  http.on("upgrade", (request, socket, head) => {
    if (!relay.upgrade(request, socket, head)) socket.destroy();
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const address = http.address();
  assert(address && typeof address === "object");
  return {
    relay,
    origin: `ws://127.0.0.1:${address.port}/voxel-media/rtc`,
    close: async () => {
      await relay.close();
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
}
test("single-use media tickets bridge real signaling while keeping reusable provider credentials out of browser frames", async () => {
  const upstream = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(upstream, "listening");
  const address = upstream.address();
  assert(address && typeof address === "object");
  const tokens: string[] = [];
  upstream.on("connection", (socket, request) => {
    tokens.push(
      new URL(request.url!, "http://localhost").searchParams.get(
        "access_token",
      )!,
    );
    socket.send(
      new SignalResponse({
        message: { case: "join", value: { serverVersion: "fixture" } },
      }).toBinary(),
    );
    socket.send(
      new SignalResponse({
        message: {
          case: "refreshToken",
          value: "private-refreshed-fixture-token",
        },
      }).toBinary(),
    );
    socket.on("message", (data) => {
      if (
        SignalRequest.fromBinary(Buffer.from(data as Buffer)).message.case ===
        "leave"
      )
        socket.close();
    });
  });
  const server = await edge(`ws://127.0.0.1:${address.port}`),
    clients: WebSocket[] = [];
  try {
    const grant = {
      scope: randomUUID(),
      token: "private-original-fixture-token",
      publish: true,
      expiresAt: Date.now() + 4000,
      policy: { room: randomUUID(), actor: randomUUID(), revision: 0 },
      revalidate: async () => ({ expiresAt: Date.now() + 3000 }),
    };
    const { ticket } = server.relay.issue(grant),
      blocked = probe(
        server.origin + "?access_token=" + ticket,
        "https://other.invalid",
      );
    clients.push(blocked.socket);
    assert.equal(await blocked.opened, 401);
    const allowed = probe(
      server.origin + "?access_token=" + ticket,
      "https://school.invalid",
    );
    clients.push(allowed.socket);
    assert.equal(await allowed.opened, 101);
    await wait(
      () =>
        allowed.frames.length > 0 && server.relay.stats.filteredTokens === 1,
    );
    assert.deepEqual(tokens, ["private-original-fixture-token"]);
    assert(
      allowed.frames.every((frame) => !frame.includes(Buffer.from("private-"))),
    );
    const replay = probe(
      server.origin + "?access_token=" + ticket,
      "https://school.invalid",
    );
    clients.push(replay.socket);
    assert.equal(await replay.opened, 401);
    assert.equal(server.relay.stats.sessions, 1);
    grant.policy.revision = 99; // Reusing a caller DTO cannot upgrade the admitted cohort.
    server.relay.revoke(grant.policy.room, grant.policy.actor, 1);
    await wait(() => server.relay.stats.sessions === 0);
    const freshTicket = server.relay.issue({
      ...grant,
      token: "private-fresh-fixture-token",
      expiresAt: Date.now() + 4000,
      policy: { ...grant.policy, revision: 1 },
    }).ticket;
    const fresh = probe(
      server.origin + "?access_token=" + freshTicket,
      "https://school.invalid",
    );
    clients.push(fresh.socket);
    assert.equal(await fresh.opened, 101);
    await wait(() => fresh.frames.length > 0);
    server.relay.revoke(grant.policy.room, grant.policy.actor, 1);
    assert.equal(server.relay.stats.sessions, 1);
    const closing = server.relay.close();
    assert.equal(server.relay.close(), closing);
    await closing;
    assert.equal(server.relay.stats.sessions, 0);
  } finally {
    for (const socket of clients) socket.terminate();
    await server.close();
    for (const socket of upstream.clients) socket.terminate();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});
test("late policy replies cannot revive an expired unused media ticket or allocate an upstream connection", async () => {
  const upstream = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(upstream, "listening");
  const address = upstream.address();
  assert(address && typeof address === "object");
  let connections = 0;
  upstream.on("connection", () => connections++);
  const server = await edge(`ws://127.0.0.1:${address.port}`);
  try {
    const { ticket } = server.relay.issue({
      scope: randomUUID(),
      token: "private-fixture",
      publish: true,
      expiresAt: Date.now() + 80,
      revalidate: async () => {
        await new Promise((r) => setTimeout(r, 160));
        return { expiresAt: Date.now() + 2000 };
      },
    });
    const client = probe(server.origin + "?access_token=" + ticket);
    assert.notEqual(await client.opened, 101);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(connections, 0);
    assert.equal(server.relay.stats.sessions, 0);
    client.socket.terminate();
  } finally {
    await server.close();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});
test("the signaling worker ends provider media on its own deadline while the gateway event loop is blocked", async () => {
  const fixture = new Worker(
    `const {parentPort}=require('node:worker_threads');const {WebSocketServer}=require('ws');const {SignalRequest,SignalResponse}=require('@livekit/protocol');
    const server=new WebSocketServer({port:0,host:'127.0.0.1'});server.on('listening',()=>parentPort.postMessage({type:'port',port:server.address().port}));
    server.on('connection',socket=>{socket.send(new SignalResponse({message:{case:'join',value:{serverVersion:'fixture'}}}).toBinary());
      socket.on('message',data=>{if(SignalRequest.fromBinary(data).message.case==='leave'){parentPort.postMessage({type:'left',at:performance.now()});socket.close();}});});
    parentPort.on('message',()=>{for(const socket of server.clients)socket.terminate();server.close(()=>parentPort.close());});`,
    { eval: true },
  );
  const port = (await once(fixture, "message"))[0].port,
    server = await edge(`ws://127.0.0.1:${port}`);
  let leftAt: number | null = null,
    calls = 0;
  fixture.on("message", (message) => {
    if (message.type === "left") leftAt = message.at;
  });
  let client: WebSocket | undefined;
  try {
    const { ticket } = server.relay.issue({
      scope: randomUUID(),
      token: "private-fixture",
      publish: true,
      expiresAt: Date.now() + 4000,
      revalidate: async () => {
        calls++;
        return { expiresAt: Date.now() + 350 };
      },
    });
    const connected = probe(server.origin + "?access_token=" + ticket);
    client = connected.socket;
    assert.equal(await connected.opened, 101);
    await wait(() => connected.frames.length > 0);
    const blockedAt = performance.now(),
      until = blockedAt + 900;
    while (performance.now() < until) {}
    const unblockedAt = performance.now();
    await wait(() => leftAt !== null);
    assert(
      leftAt! < unblockedAt - 100,
      JSON.stringify({ leftAt, blockedAt, unblockedAt }),
    );
    assert(leftAt! > blockedAt + 100);
    assert.equal(calls, 1);
    await wait(() => server.relay.stats.sessions === 0);
  } finally {
    client?.terminate();
    await server.close();
    fixture.postMessage("close");
    await fixture.terminate();
  }
});
