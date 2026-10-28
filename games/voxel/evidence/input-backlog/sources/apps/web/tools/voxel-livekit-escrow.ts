/** Isolated real-provider proof for backend credential escrow; no school data. */
import assert from "node:assert/strict";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { SignalResponse } from "@livekit/protocol";
import { VoiceSignaling } from "../../voxel-server/src/voice-signaling.ts";
import { providerSearch } from "../../voxel-server/src/voice-signal-protocol.ts";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { once } from "node:events";
import { createServer } from "node:http";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";
if (process.env.VOXEL_TEST_LIVEKIT !== "1")
  throw new Error("Set VOXEL_TEST_LIVEKIT=1 for an isolated provider room");
const endpoint = process.env.LIVEKIT_URL ?? "",
  key = process.env.LIVEKIT_API_KEY,
  secret = process.env.LIVEKIT_API_SECRET;
if (!key || !secret) throw new Error("LiveKit configuration required");
const api = new RoomServiceClient(
    endpoint.replace(/^wss:/, "https:"),
    key,
    secret,
    { requestTimeout: 5 },
  ),
  room = "voxel-escrow-qualification-" + randomUUID(),
  actor = randomUUID(),
  applicationRoom = randomUUID(),
  scope = randomUUID(),
  web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-livekit-escrow-"));
let relay: VoiceSignaling | undefined,
  browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  http: ReturnType<typeof createServer> | undefined,
  probePage:
    | Awaited<
        ReturnType<Awaited<ReturnType<typeof launchSoftwareBrowser>>["newPage"]>
      >
    | undefined,
  witness: Worker | undefined,
  createdSid: string | undefined,
  creationAttempted = false,
  revision = 0,
  publish = true,
  lifetime = 4000,
  binding = 0,
  latestExpiry = 0,
  latestIdentity = "",
  stage = "prepare";
const privateTokens: string[] = [],
  result: Record<string, any> = {
    result: "INCOMPLETE",
    room,
    schoolDatabaseWrites: 0,
    scope:
      "Actual self-hosted LiveKit, private signaling worker and generated test audio; no school/Auth/UI deployment qualification",
  };
const deadline = setTimeout(() => {
  console.error("Isolated credential escrow probe exceeded 120 seconds");
  void browser?.close();
}, 120000);
const issue = async () => {
  const accepted = revision,
    identity = "voxel-escrow-" + actor + "-" + ++binding,
    token = new AccessToken(key, secret, {
      identity,
      ttl: "2m",
      metadata: JSON.stringify({ actorId: actor, binding }),
    });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: publish,
    canPublishSources: publish ? [TrackSource.MICROPHONE] : [],
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  const value = await token.toJwt();
  privateTokens.push(value);
  latestIdentity = identity;
  return relay!.issue({
    scope,
    token: value,
    publish,
    expiresAt: Date.now() + 4500,
    policy: { room: applicationRoom, actor, revision: accepted },
    revalidate: async () => {
      if (revision !== accepted) return null;
      latestExpiry = Date.now() + lifetime;
      return { expiresAt: latestExpiry };
    },
  });
};
try {
  relay = new VoiceSignaling(endpoint, []);
  await relay.ready;
  writeFileSync(
    join(temp, "index.html"),
    '<!doctype html><html><meta charset="utf-8"><body><button id="start">Start escrow probe</button><output id="status">Waiting</output><script type="module" src="/entry.ts"></script></body></html>',
  );
  writeFileSync(
    join(temp, "entry.ts"),
    `
import {Room,Track} from 'livekit-client';
const direct=${JSON.stringify(endpoint)},options={websocketTimeout:6000,peerConnectionTimeout:7000,maxRetries:0,autoSubscribe:false};
let current,lastTicket;const contexts=[],sources=[];window.probe={phase:'loaded'};
const safe=e=>({name:e?.name??'Error',code:typeof e?.code==='number'?e.code:null,description:String(e?.message??'').replace(/(?:https?|wss?):\\/\\/[^\\s"'<>]+/g,'[endpoint]').replace(/eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/g,'[credential]').slice(0,300)});
window.probe.join=async()=>{window.probe.phase='grant';const response=await fetch('/probe/grant');if(!response.ok)throw new Error('Fixture grant unavailable');
 const grant=await response.json();lastTicket=grant.ticket;current=new Room();window.probe.current=current;
 window.probe.phase='connecting';
 try{await current.connect(location.origin.replace(/^http/,'ws')+'/voxel-media',grant.ticket,options);}
 catch(e){return {connected:false,error:safe(e),expiresAt:grant.expiresAt};}
 window.probe.phase='connected';
 return {connected:current.state==='connected',canPublish:current.localParticipant.permissions?.canPublish,expiresAt:grant.expiresAt,
  serverInfo:{version:current.serverInfo?.version,edition:current.serverInfo?.edition,protocol:current.serverInfo?.protocol}};};
window.probe.publish=async()=>{window.probe.phase='publishing';const context=new AudioContext(),target=context.createMediaStreamDestination(),wave=context.createOscillator(),gain=context.createGain();
 gain.gain.value=0.04;wave.frequency.value=440;wave.connect(gain).connect(target);wave.start();contexts.push(context);sources.push({wave,gain,target});await context.resume();
 try{await current.localParticipant.publishTrack(target.stream.getAudioTracks()[0],{source:Track.Source.Microphone});return {published:true};}
 catch(e){return {published:false,error:safe(e)};}};
document.querySelector('#start').onclick=async()=>{try{window.probe.initial=await window.probe.join();if(window.probe.initial.connected)window.probe.initialAudio=await window.probe.publish();}
 catch(e){window.probe.initial={connected:false,error:safe(e)};}document.querySelector('#status').textContent='Initial observed';};
window.probe.replay=async(useDirect=false)=>{const candidate=new Room();try{await candidate.connect(useDirect?direct:location.origin.replace(/^http/,'ws')+'/voxel-media',lastTicket,options);
 await candidate.disconnect();return {connected:true};}catch(e){await candidate.disconnect();return {connected:false,error:safe(e)};}};
window.probe.opaque=()=>({onlyOpaque:current.engine.token===lastTicket,state:current.state});
window.probe.forgePublish=async()=>{current.localParticipant.permissions.canPublish=true;current.localParticipant.permissions.canPublishSources=[];return window.probe.publish();};
window.probe.close=async()=>{await current?.disconnect();for(const source of sources){source.wave.stop();source.wave.disconnect();source.gain.disconnect();source.target.stream.getTracks().forEach(t=>t.stop());source.target.disconnect();}
 await Promise.all(contexts.map(c=>c.close()));return {contextsClosed:contexts.every(c=>c.state==='closed')};};
`,
  );
  await build({
    configFile: false,
    root: temp,
    logLevel: "warn",
    resolve: {
      alias: {
        "livekit-client": join(
          repo,
          "node_modules/livekit-client/dist/livekit-client.esm.mjs",
        ),
      },
    },
    build: { target: "es2022", outDir: join(temp, "built"), minify: false },
  });
  stage = "create-room";
  assert.equal((await api.listRooms([room])).length, 0);
  creationAttempted = true;
  const created = await api.createRoom({
    name: room,
    emptyTimeout: 60,
    departureTimeout: 60,
  });
  createdSid = created.sid;
  const assets = new Map<string, string>();
  const index = (path: string, prefix = "") => {
    for (const e of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, e.name),
        name = prefix + "/" + e.name;
      if (e.isDirectory()) index(file, name);
      else assets.set(name, file);
    }
  };
  index(join(temp, "built"));
  http = createServer((request, response) => {
    if (relay!.handleHttp(request, response)) return;
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path === "/probe/grant") {
      void issue()
        .then((value) => {
          response.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          response.end(JSON.stringify(value));
        })
        .catch(() => {
          response.writeHead(503);
          response.end();
        });
      return;
    }
    const file = assets.get(path === "/" ? "/index.html" : path);
    if (!file) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": file.endsWith(".js") ? "text/javascript" : "text/html",
    });
    response.end(readFileSync(file));
  });
  http.on("upgrade", (request, socket, head) => {
    const query = new URL(request.url ?? "/", "http://localhost");
    const diagnostic: {
      path: string;
      queryLength: number;
      queryValid: boolean | string;
    } = {
      path: query.pathname,
      queryLength: query.search.length,
      queryValid: true,
    };
    try {
      providerSearch(query.search, publish);
    } catch (error) {
      diagnostic.queryValid = error instanceof Error ? error.message : "Error";
    }
    (result.upgrades ??= []).push(diagnostic);
    if (!relay!.upgrade(request, socket, head)) socket.destroy();
  });
  await new Promise<void>((r) => http!.listen(0, "127.0.0.1", r));
  const address = http.address();
  assert(address && typeof address === "object");
  browser = await launchSoftwareBrowser();
  const page = (probePage = await browser.newPage());
  page.setDefaultTimeout(15000);
  let leaked = false,
    refreshFrames = 0;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      if (typeof frame.payload === "string") return;
      const value = Buffer.from(frame.payload);
      if (privateTokens.some((token) => value.includes(Buffer.from(token))))
        leaked = true;
      try {
        if (SignalResponse.fromBinary(value).message.case === "refreshToken")
          refreshFrames++;
      } catch {}
    }),
  );
  stage = "initial-escrow-media";
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page
    .getByRole("button", { name: "Start escrow probe", exact: true })
    .click();
  await page.getByText("Initial observed", { exact: true }).waitFor();
  result.initial = await page.evaluate(() => (window as any).probe.initial);
  assert(result.initial.connected);
  assert(
    (await page.evaluate(() => (window as any).probe.initialAudio)).published,
  );
  result.initialTrackPublished = (
    await api.getParticipant(room, latestIdentity)
  ).tracks.some((t) => t.source === TrackSource.MICROPHONE);
  assert(result.initialTrackPublished);
  stage = "opaque-replay";
  result.replayBeforeExpiry = Date.now() < result.initial.expiresAt;
  assert(result.replayBeforeExpiry);
  result.cachedTicketReplay = await page.evaluate(() =>
    (window as any).probe.replay(),
  );
  assert.equal(result.cachedTicketReplay.connected, false);
  result.directSfuReplay = await page.evaluate(() =>
    (window as any).probe.replay(true),
  );
  assert.equal(result.directSfuReplay.connected, false);
  stage = "refresh-filter";
  await api.updateParticipant(room, latestIdentity, {
    metadata: JSON.stringify({ actorId: actor, probe: randomUUID() }),
  });
  for (let i = 0; i < 50 && relay.stats.filteredTokens === 0; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert(relay.stats.filteredTokens > 0);
  result.onlyOpaqueInSdk = (
    await page.evaluate(() => (window as any).probe.opaque())
  ).onlyOpaque;
  assert(result.onlyOpaqueInSdk);
  stage = "cohort-mute";
  revision++;
  publish = false;
  relay.revoke(applicationRoom, actor, revision);
  await page.waitForFunction(
    () => (window as any).probe.current.state === "disconnected",
  );
  result.muteDisconnected = true;
  stage = "listen-only-rejoin";
  result.listenOnly = await page.evaluate(() => (window as any).probe.join());
  assert(result.listenOnly.connected);
  assert.equal(result.listenOnly.canPublish, false);
  relay.revoke(applicationRoom, actor, revision);
  assert.equal(relay.stats.sessions, 1);
  result.historicalMutePreservesFreshAdmission =
    (await page.evaluate(() => (window as any).probe.opaque())).state ===
    "connected";
  assert(result.historicalMutePreservesFreshAdmission);
  stage = "noncooperative-publish";
  const before = relay.stats.protocolClosures;
  result.forgedPublish = await page.evaluate(() =>
    (window as any).probe.forgePublish(),
  );
  assert.equal(result.forgedPublish.published, false);
  for (let i = 0; i < 50 && relay.stats.protocolClosures === before; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert(relay.stats.protocolClosures > before);
  result.backendRejectedForgedPublish = true;
  stage = "independent-expiry";
  revision++;
  publish = true;
  lifetime = 3500;
  result.beforeStall = await page.evaluate(() => (window as any).probe.join());
  assert(
    (await page.evaluate(() => (window as any).probe.publish())).published,
  );
  witness = new Worker(
    `const {parentPort,workerData}=require('node:worker_threads');const {RoomServiceClient}=require('livekit-server-sdk');
    const api=new RoomServiceClient(workerData.endpoint,workerData.key,workerData.secret,{requestTimeout:5});parentPort.postMessage({type:'ready'});
    parentPort.on('message',query=>{setTimeout(async()=>{try{const peers=await api.listParticipants(query.room);parentPort.postMessage({type:'observed',at:Date.now(),present:peers.some(p=>p.identity===query.identity)});}
      catch{parentPort.postMessage({type:'failed'});}},Math.max(0,query.at-Date.now()));});`,
    {
      eval: true,
      workerData: {
        endpoint: endpoint.replace(/^wss:/, "https:"),
        key,
        secret,
      },
    },
  );
  await once(witness, "message");
  const observation = new Promise<any>((resolve) =>
      witness!.once("message", resolve),
    ),
    queryAt = latestExpiry + 750;
  witness.postMessage({ room, identity: latestIdentity, at: queryAt });
  const blockedAt = Date.now(),
    end = queryAt + 1000;
  while (Date.now() < end) {}
  const unblockedAt = Date.now();
  const observed = await observation;
  assert.equal(observed.type, "observed");
  assert.equal(observed.present, false);
  assert(observed.at < unblockedAt - 100);
  result.independentExpiry = {
    blockedAt,
    unblockedAt,
    observedAt: observed.at,
    providerParticipantAbsent: true,
  };
  await page.waitForFunction(
    () => (window as any).probe.current.state === "disconnected",
  );
  result.audioCleanup = await page.evaluate(() =>
    (window as any).probe.close(),
  );
  assert(result.audioCleanup.contextsClosed);
  result.signalStats = relay.stats;
  result.backendCredentialSeen = leaked;
  result.browserRefreshFrames = refreshFrames;
  assert(!leaked && refreshFrames === 0);
  result.result = "ESCROW_REPLAY_MUTE_AND_INDEPENDENT_EXPIRY_PASS";
} catch (error) {
  result.result = "INCOMPLETE";
  result.stage = stage;
  result.error = { name: error instanceof Error ? error.name : "Error" };
  if (error instanceof Error) {
    let description = error.message;
    for (const token of privateTokens)
      description = description.replaceAll(token, "[private credential]");
    description = description
      .replace(/https?:\/\/[^\s"'<>]+|wss?:\/\/[^\s"'<>]+/g, "[endpoint]")
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[credential]",
      );
    result.error.description = description.slice(0, 800);
  }
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  result.finalSignalStats = relay?.stats;
  try {
    result.finalBrowserState = await probePage?.evaluate(() => ({
      phase: (window as any).probe?.phase,
      state: (window as any).probe?.current?.state,
      initial: (window as any).probe?.initial,
    }));
  } catch {}
  await witness?.terminate();
  await browser?.close();
  await relay?.close();
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  let cleaned = !creationAttempted;
  if (creationAttempted)
    for (let attempt = 0; attempt < 3 && !cleaned; attempt++)
      try {
        const existing = await api.listRooms([room]);
        assert(existing.every((r) => !createdSid || r.sid === createdSid));
        if (existing.length) await api.deleteRoom(room);
        cleaned = (await api.listRooms([room])).length === 0;
      } catch {}
  result.cleaned = cleaned;
  result.checkedAt = new Date().toISOString();
  if (!cleaned) process.exitCode = 1;
  mkdirSync(join(web, "test-results"), { recursive: true });
  writeFileSync(
    join(web, "test-results/voxel-livekit-escrow.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify(result));
}
