/** Opt-in isolated provider capability check; no school DB or real-user media. */
import assert from "node:assert/strict";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
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
const url = new URL(process.env.LIVEKIT_URL ?? ""),
  key = process.env.LIVEKIT_API_KEY,
  secret = process.env.LIVEKIT_API_SECRET;
if (
  !["https:", "wss:"].includes(url.protocol) ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !key ||
  !secret
)
  throw new Error("Secure LiveKit configuration required");
const socketUrl = url.href.replace(/^https:/, "wss:"),
  apiUrl = url.href.replace(/^wss:/, "https:"),
  api = new RoomServiceClient(apiUrl, key, secret, { requestTimeout: 5 }),
  room = "voxel-qualification-" + randomUUID(),
  actor = "voxel-probe-" + randomUUID(),
  web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-livekit-probe-"));
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  http: ReturnType<typeof createServer> | undefined,
  createdSid: string | undefined,
  creationAttempted = false,
  stage = "prepare-fixture";
const result: Record<string, unknown> = {
  result: "INCOMPLETE",
  scope:
    "Isolated LiveKit room and generated test identity; no school DB, user microphone, recording or deployment",
  room,
  actor,
  schoolDatabaseWrites: 0,
};
const deadline = setTimeout(() => {
  console.error("Isolated LiveKit probe exceeded 90 seconds");
  void browser?.close();
}, 90000);
try {
  const token = new AccessToken(key, secret, { identity: actor, ttl: "2m" });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  const original = await token.toJwt();
  writeFileSync(
    join(temp, "index.html"),
    '<!doctype html><html><meta charset="utf-8"><body><button id="start">Start isolated media probe</button><output id="status">Waiting</output><script type="module" src="/entry.ts"></script></body></html>',
  );
  writeFileSync(
    join(temp, "entry.ts"),
    `
import {Room,Track} from 'livekit-client';
const config=${JSON.stringify({ url: socketUrl, original })};let current,generated,oscillator,generator,beforeToken=config.original;
window.probe={};const options={autoSubscribe:false,websocketTimeout:6000,peerConnectionTimeout:7000,maxRetries:0};
const serverInfo=r=>({version:r.serverInfo?.version,edition:r.serverInfo?.edition,protocol:r.serverInfo?.protocol});
const errorCode=e=>({name:e?.name??'Error',code:typeof e?.code==='number'?e.code:null});
document.querySelector('#start').onclick=async()=>{
 current=new Room();window.probe.current=current;
 try{await current.connect(config.url,config.original,options);
  generator=new AudioContext();generated=generator.createMediaStreamDestination();oscillator=generator.createOscillator();oscillator.frequency.value=440;
  const gain=generator.createGain();gain.gain.value=0.04;oscillator.connect(gain).connect(generated);oscillator.start();await generator.resume();
  await current.localParticipant.publishTrack(generated.stream.getAudioTracks()[0],{source:Track.Source.Microphone});
  window.probe.initial={connected:true,serverInfo:serverInfo(current),canPublish:current.localParticipant.permissions?.canPublish};
 }catch(e){window.probe.initial={connected:false,serverInfo:serverInfo(current),error:errorCode(e)};}
 document.querySelector('#status').textContent='Initial observed';
};
window.probe.cache=()=>{beforeToken=current.engine.token??config.original;return {refreshed:beforeToken!==config.original};};
window.probe.permission=()=>({canPublish:current.localParticipant.permissions?.canPublish,tracks:current.localParticipant.audioTrackPublications.size});
window.probe.disconnect=async()=>{await current.disconnect();};
window.probe.rejoin=async(which)=>{
 const candidate=new Room();window.probe.current=candidate;
 try{await candidate.connect(config.url,which==='original'?config.original:which==='refreshed'?beforeToken:which,options);current=candidate;
  return {connected:true,canPublish:candidate.localParticipant.permissions?.canPublish};
 }catch(e){await candidate.disconnect();return {connected:false,error:errorCode(e)};}
};
window.probe.close=async()=>{await window.probe.current?.disconnect();await current?.disconnect();
 if(oscillator){oscillator.stop();oscillator.disconnect();}generated?.stream.getTracks().forEach(t=>t.stop());await generator?.close();};
`,
  );
  stage = "build-fixture";
  await build({
    configFile: false,
    root: temp,
    logLevel: "warn",
    build: { target: "es2022", outDir: join(temp, "built"), minify: false },
    resolve: {
      alias: {
        "livekit-client": join(
          repo,
          "node_modules/livekit-client/dist/livekit-client.esm.mjs",
        ),
      },
    },
  });
  stage = "create-room";
  assert.equal((await api.listRooms([room])).length, 0);
  creationAttempted = true;
  const created = await api.createRoom({
    name: room,
    emptyTimeout: 60,
    departureTimeout: 60,
  });
  assert.equal(created.name, room);
  createdSid = created.sid;
  result.temporaryMediaRoomCreated = true;
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
  http = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname,
      file = assets.get(path === "/" ? "/index.html" : path);
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.endsWith(".js") ? "text/javascript" : "text/html",
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => http!.listen(0, "127.0.0.1", r));
  const address = http.address();
  assert(address && typeof address === "object");
  browser = await launchSoftwareBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  stage = "initial-media";
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page
    .getByRole("button", { name: "Start isolated media probe", exact: true })
    .click();
  await page.getByText("Initial observed", { exact: true }).waitFor();
  const initial = await page.evaluate(() => (window as any).probe.initial);
  result.initial = initial;
  assert(initial.connected, "Initial provider connection failed");
  const participant = await api.getParticipant(room, actor);
  assert.equal(participant.permission?.canPublish, true);
  assert(participant.tracks.some((t) => t.source === TrackSource.MICROPHONE));
  result.generatedMicrophoneTrackPublished = true;
  stage = "refresh-token";
  await api.updateParticipant(room, actor, {
    metadata: JSON.stringify({ qualification: randomUUID() }),
  });
  await page.waitForTimeout(500);
  result.cachedToken = await page.evaluate(() => (window as any).probe.cache());
  stage = "server-mute";
  await api.updateParticipant(room, actor, {
    permission: {
      canPublish: false,
      canPublishSources: [],
      canSubscribe: true,
      canPublishData: false,
      canUpdateMetadata: false,
    },
  });
  await page.waitForFunction(
    () => (window as any).probe.permission().canPublish === false,
  );
  const muted = await api.getParticipant(room, actor);
  assert.equal(muted.permission?.canPublish, false);
  assert.equal(muted.tracks.length, 0);
  result.serverMuteVerified = true;
  await page.evaluate(() => (window as any).probe.disconnect());
  stage = "cached-token-after-mute";
  result.cachedAfterMute = await page.evaluate(() =>
    (window as any).probe.rejoin("original"),
  );
  await page.evaluate(() => (window as any).probe.disconnect());
  stage = "explicit-revocation";
  const cutoff = Math.floor(Date.now() / 1000) + 1;
  try {
    await api.removeParticipant(room, actor, { revokeTokenTs: BigInt(cutoff) });
    result.removalAcknowledged = true;
  } catch (error) {
    const code = (error as any)?.code;
    if (code !== "not_found") throw error;
    result.removalAcknowledged = false;
    result.removalCode = code;
  }
  result.originalAfterRemoval = await page.evaluate(() =>
    (window as any).probe.rejoin("original"),
  );
  await page.evaluate(() => (window as any).probe.disconnect());
  result.refreshedAfterRemoval = await page.evaluate(() =>
    (window as any).probe.rejoin("refreshed"),
  );
  await page.evaluate(() => (window as any).probe.disconnect());
  await new Promise((r) =>
    setTimeout(r, Math.max(0, (cutoff + 1) * 1000 - Date.now())),
  );
  const fresh = new AccessToken(key, secret, { identity: actor, ttl: "2m" });
  fresh.addGrant({
    roomJoin: true,
    room,
    canPublish: false,
    canPublishSources: [],
    canSubscribe: true,
    canPublishData: false,
  });
  const freshToken = await fresh.toJwt();
  result.freshAfterRemoval = await page.evaluate(
    (t) => (window as any).probe.rejoin(t),
    freshToken,
  );
  assert(
    (result.freshAfterRemoval as any).connected,
    "Fresh control connection failed",
  );
  assert.equal((result.freshAfterRemoval as any).canPublish,false);
  await page.evaluate(() => (window as any).probe.close());
  result.result =
    (result.originalAfterRemoval as any).connected ||
    (result.refreshedAfterRemoval as any).connected
      ? "SERVER_MUTE_VERIFIED_TOKEN_REVOCATION_UNAVAILABLE"
      : "SERVER_MUTE_AND_CACHED_TOKEN_REVOCATION_VERIFIED";
} catch (error) {
  result.result = "PROBE_INCOMPLETE";
  result.stage = stage;
  result.error = {
    name: error instanceof Error ? error.name : "Error",
    code: typeof (error as any)?.code === "number" ? (error as any).code : null,
  };
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await browser?.close();
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  let cleaned = !creationAttempted;
  if (creationAttempted)
    for (let attempt = 0; attempt < 3 && !cleaned; attempt++)
      try {
        const existing = await api.listRooms([room]);
        assert(
          existing.every((r) => !createdSid || r.sid === createdSid),
          "Provider room ownership changed",
        );
        if (existing.length) await api.deleteRoom(room);
        cleaned = (await api.listRooms([room])).length === 0;
      } catch {}
  result.cleaned = cleaned;
  result.checkedAt = new Date().toISOString();
  if (creationAttempted && !cleaned) process.exitCode = 1;
  mkdirSync(join(web, "test-results"), { recursive: true });
  writeFileSync(
    join(web, "test-results/voxel-livekit-probe.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify(result));
}
