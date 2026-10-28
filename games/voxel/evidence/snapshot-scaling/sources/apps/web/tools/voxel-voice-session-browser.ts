/** Actual product voice UI/coordinator and SFU; school policy is an explicit fixture. */
import assert from "node:assert/strict";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { VoiceSignaling } from "../../voxel-server/src/voice-signaling.ts";
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
  throw new Error("Set VOXEL_TEST_LIVEKIT=1 for an isolated media room");
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
  room = "voxel-ui-qualification-" + randomUUID(),
  applicationRoom = randomUUID(),
  actors = [randomUUID(), randomUUID(), randomUUID()],
  web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-voice-session-"));
let relay: VoiceSignaling | undefined,
  browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  http: ReturnType<typeof createServer> | undefined,
  createdSid: string | undefined,
  creationAttempted = false,
  revision = 0,
  allMuted = false,
  loseReply = true,
  stage = "prepare";
const latest = new Map<string, string>(),
  issued = new Map<string, number>(),
  commands = new Map<string, Record<string, any>>(),
  bodies: unknown[] = [],
  privateTokens: string[] = [],
  result: Record<string, any> = {
    result: "INCOMPLETE",
    room,
    schoolDatabaseWrites: 0,
    scope:
      "Actual React voice panel/coordinator, generated browser audio and configured SFU; school/Auth/SQL and game poses are fixtures, not deployment or physical-device qualification",
  };
const deadline = setTimeout(() => {
  console.error("Voice session browser exceeded 120 seconds");
  void browser?.close();
}, 120000);
try {
  relay = new VoiceSignaling(endpoint, []);
  await relay.ready;
  writeFileSync(
    join(temp, "index.html"),
    '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>',
  );
  writeFileSync(
    join(temp, "entry.tsx"),
    `
import React from 'react';import {createRoot} from 'react-dom/client';
import {VoxelVoice} from '${join(web, "src/game/voxel/VoxelVoice.tsx")}';
import {VoiceSession} from '${join(web, "src/game/voxel/voice-session.ts")}';
import {createVoxelApi} from '${join(web, "src/game/voxel/session-api.ts")}';
import {voiceScene} from '${join(repo, "games/voxel/src/client/voice-scene.ts")}';
import '${join(web, "src/game/voxel/voxel-session.css")}';
const actors=${JSON.stringify(actors)},actor=new URLSearchParams(location.search).get('actor'),index=actors.indexOf(actor),host=document.querySelector('#root'),root=createRoot(host);
const probe=window.voiceProbe={mode:'deny',gumCalls:0,closed:[],generators:[],far:false,blocked:false,sceneAvailable:true};
const start=VoiceSession.prototype.start,close=VoiceSession.prototype.close;
VoiceSession.prototype.start=function(...args){probe.session=this;return start.apply(this,args);};
VoiceSession.prototype.close=function(...args){probe.closed.push(this);return close.apply(this,args);};
const tone=async()=>{const context=new AudioContext(),wave=context.createOscillator(),gain=context.createGain(),target=context.createMediaStreamDestination();wave.frequency.value=440;gain.gain.value=.07;wave.connect(gain).connect(target);wave.start();await context.resume();probe.generators.push({context,wave,gain,target});probe.lastCaptured=target.stream.getAudioTracks()[0];return target.stream;};
navigator.mediaDevices.getUserMedia=async constraints=>{probe.gumCalls++;if(constraints.video)throw new Error('Camera forbidden in probe');if(probe.mode==='deny')throw new DOMException('Fixture denial','NotAllowedError');if(probe.mode==='pending')return new Promise(resolve=>{probe.resolveCapture=async()=>resolve(await tone());});return tone();};
const api=createVoxelApi({room:${JSON.stringify(applicationRoom)},serverUrl:location.origin,getToken:async()=>actor});
const scene=()=>probe.sceneAvailable?voiceScene([probe.far?100:index*2,60,0],0,0,actors.slice(0,2).filter(id=>id!==actor).map(id=>({id,position:[actors.indexOf(id)*2,60,0]})),()=>!probe.blocked):null;
root.render(<main className="voxel-session" dir="rtl"><header className="voxel-session__header"><VoxelVoice api={api} ready={true} isStaff={index===2} scene={scene} onOpen={()=>{}}/></header></main>);
probe.rms=async()=>{const output=host.querySelector('audio');if(!output?.srcObject)return 0;
 if(!probe.measuring){const context=new AudioContext(),source=context.createMediaStreamSource(output.srcObject),analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);await context.resume();probe.measuring={context,source,analyser};}
 await new Promise(r=>setTimeout(r,400));const data=new Float32Array(probe.measuring.analyser.fftSize);probe.measuring.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);};
probe.unmount=()=>root.unmount();
probe.cleanup=async()=>{root.unmount();for(const g of probe.generators){g.wave.stop();g.wave.disconnect();g.gain.disconnect();g.target.stream.getTracks().forEach(t=>t.stop());g.target.disconnect();await g.context.close();}
 if(probe.measuring){probe.measuring.source.disconnect();probe.measuring.analyser.disconnect();await probe.measuring.context.close();}return probe.closed.map(v=>v.stats);};
probe.lateActivation=async()=>{let release;const original=AudioContext.prototype.resume;AudioContext.prototype.resume=function(){const running=original.call(this);return new Promise(resolve=>{release=async()=>{await running;resolve();};});};
 const element=document.createElement('div');document.body.appendChild(element);let calls=0;
 const candidate=new VoiceSession({api:{...api,voiceTicket:async()=>{calls++;throw new Error('Unexpected late admission');}},host:element,scene,onState:()=>{}}),pending=candidate.start();candidate.stop();AudioContext.prototype.resume=original;await release();await pending;await candidate.close();element.remove();return {calls,stats:candidate.stats};};
`,
  );
  await build({
    configFile: false,
    root: temp,
    logLevel: "warn",
    esbuild: { jsx: "automatic" },
    resolve: {
      alias: {
        react: join(repo, "node_modules/react"),
        "react-dom": join(repo, "node_modules/react-dom"),
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
  createdSid = (
    await api.createRoom({ name: room, emptyTimeout: 60, departureTimeout: 60 })
  ).sid;
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
  const reply = (
    res: import("node:http").ServerResponse,
    value: unknown,
    status = 200,
  ) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  http = createServer((req, res) => {
    void (async () => {
      if (relay!.handleHttp(req, res)) return;
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (path.startsWith("/api/voxel/")) {
        const actor = req.headers.authorization?.slice(7),
          actorIndex = actors.indexOf(actor ?? "");
        if (actorIndex < 0) {
          reply(res, { error: "UNAUTHORIZED" }, 401);
          return;
        }
        let source = "";
        for await (const chunk of req) {
          source += chunk;
          if (source.length > 8192) throw new Error("Fixture body too large");
        }
        const body = JSON.parse(source);
        assert.equal(body.room, applicationRoom);
        if (path === "/api/voxel/voice-ticket") {
          const accepted = revision,
            hidden = actorIndex === 2,
            publish = !hidden && !allMuted,
            bindingId = randomUUID(),
            identity = actor + ":" + bindingId,
            token = new AccessToken(key, secret, {
              identity,
              ttl: "2m",
              metadata: JSON.stringify({ actorId: actor, bindingId }),
            });
          token.addGrant({
            roomJoin: true,
            room,
            hidden,
            canPublish: publish,
            canPublishSources: publish ? [TrackSource.MICROPHONE] : [],
            canSubscribe: true,
            canPublishData: false,
            canUpdateOwnMetadata: false,
          });
          const value = await token.toJwt();
          privateTokens.push(value);
          latest.set(actor!, identity);
          issued.set(actor!, (issued.get(actor!) ?? 0) + 1);
          const ticket = relay!.issue({
            scope: applicationRoom + ":" + actor,
            token: value,
            publish,
            expiresAt: Date.now() + 4500,
            ...(!hidden
              ? {
                  policy: {
                    room: applicationRoom,
                    actor: actor!,
                    revision: accepted,
                  },
                }
              : {}),
            revalidate: async () =>
              !hidden && revision !== accepted
                ? null
                : { expiresAt: Date.now() + 4000 },
          });
          reply(res, { ...ticket, publish, hidden, actorId: actor, bindingId });
          return;
        }
        if (actorIndex !== 2) {
          reply(res, { error: "FORBIDDEN" }, 403);
          return;
        }
        if (path === "/api/voxel/media-state") {
          reply(res, {
            revision,
            allMuted,
            targets: actors.slice(0, 2).map((id, i) => ({
              id,
              name: i ? "משתתף ב" : "<img src=x onerror=alert(1)>",
              muted: false,
              effectiveMuted: allMuted,
            })),
          });
          return;
        }
        if (path === "/api/voxel/media-moderate") {
          bodies.push(body);
          assert.equal(body.target, null);
          assert(["mute", "unmute"].includes(body.action));
          let receipt = commands.get(body.requestId);
          if (!receipt) {
            allMuted = body.action === "mute";
            revision++;
            receipt = {
              requestId: body.requestId,
              action: body.action,
              target: null,
              revision,
              muted: allMuted,
              current: true,
              applied: true,
              persisted: true,
              saved: false,
              revocationRequested: true,
            };
            commands.set(body.requestId, receipt);
          }
          assert.equal(receipt.action, body.action);
          relay!.revoke(applicationRoom, null, receipt.revision);
          if (loseReply) {
            loseReply = false;
            // Production returns this when its committed SQL reply is lost.
            reply(res, { error: "MEDIA_UNCONFIRMED" }, 503);
            return;
          }
          reply(res, {
            ...receipt,
            current: receipt.revision === revision,
            revocationRequested: receipt.revision === revision,
          });
          return;
        }
        reply(res, { error: "INVALID" }, 400);
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
            : "text/html",
      });
      res.end(readFileSync(file));
    })().catch(() => {
      if (!res.headersSent) reply(res, { error: "FIXTURE_UNAVAILABLE" }, 503);
      else res.end();
    });
  });
  http.on("upgrade", (req, socket, head) => {
    if (!relay!.upgrade(req, socket, head)) socket.destroy();
  });
  await new Promise<void>((r) => http!.listen(0, "127.0.0.1", r));
  const address = http.address();
  assert(address && typeof address === "object");
  browser = await launchSoftwareBrowser();
  const pages = [];
  let credentialLeaked = false;
  for (const actor of actors) {
    const context = await browser.newContext(),
      page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("websocket", (socket) =>
      socket.on("framereceived", (frame) => {
        const payload =
          typeof frame.payload === "string"
            ? Buffer.from(frame.payload)
            : frame.payload;
        if (privateTokens.some((t) => payload.includes(Buffer.from(t))))
          credentialLeaked = true;
      }),
    );
    pages.push(page);
    await page.goto(`http://127.0.0.1:${address.port}/?actor=${actor}`);
    await page.getByRole("button", { name: "שיחה קולית", exact: true }).click();
  }
  const [speaker, listener, observer] = pages;
  const state = (page: typeof speaker) =>
    page.evaluate(() => (window as any).voiceProbe.session?.state);
  const joined = (page: typeof speaker) =>
    page.waitForFunction(
      () => (window as any).voiceProbe.session?.state.phase === "connected",
    );
  stage = "explicit-listening";
  for (const page of pages) {
    await page
      .getByRole("button", { name: "הצטרפות לשמע", exact: true })
      .click();
    await joined(page);
    assert.equal(
      await page.evaluate(() => (window as any).voiceProbe.gumCalls),
      0,
    );
  }
  result.noAutomaticMicrophone = true;
  assert.equal(
    await observer
      .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
      .isDisabled(),
    true,
  );
  stage = "permission-denial";
  await speaker
    .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
    .click();
  await speaker
    .getByText("לא ניתנה הרשאת מיקרופון.", { exact: false })
    .waitFor();
  assert.equal((await state(speaker)).microphone, "denied");
  result.permissionDenial = true;
  stage = "generated-media";
  await speaker.evaluate(() => ((window as any).voiceProbe.mode = "generated"));
  await speaker
    .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
    .click();
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "on",
  );
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 1,
  );
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    samples.push(
      await listener.evaluate(() => (window as any).voiceProbe.rms()),
    );
    if (samples.at(-1)! > 0.002) break;
  }
  const near = Math.max(...samples);
  assert.equal((await state(listener)).audioLocked, false);
  result.initialAudioSamples = samples;
  result.speakerAudio = await speaker.evaluate(() => ({
    stats: (window as any).voiceProbe.session.stats,
    generators: (window as any).voiceProbe.generators.map((g) => ({
      state: g.context.state,
      track: g.target.stream.getAudioTracks()[0].readyState,
    })),
  }));
  result.listenerAudio = await listener.evaluate(() => ({
    stats: (window as any).voiceProbe.session.stats,
    measuring: (window as any).voiceProbe.measuring?.context.state,
  }));
  result.receiver = await listener.evaluate(async () => {
    const session = (window as any).voiceProbe.session,
      rows = [];
    for (const participant of session.room.remoteParticipants.values())
      for (const publication of participant.trackPublications.values()) {
        const track = publication.track;
        if (!track) continue;
        const stats = await track.getReceiverStats();
        rows.push({
          enabled: track.mediaStreamTrack.enabled,
          muted: track.mediaStreamTrack.muted,
          readyState: track.mediaStreamTrack.readyState,
          bytesReceived: stats?.bytesReceived,
          totalAudioEnergy: stats?.totalAudioEnergy,
          totalSamplesDuration: stats?.totalSamplesDuration,
          packetsReceived: stats?.packetsReceived,
        });
      }
    return {
      visibility: document.visibilityState,
      contextTime: session.audio.context.currentTime,
      tracks: rows,
      gains: [...session.audio.peers.values()].map((p) => ({
        gain: p.gain.gain.value,
        position: [
          p.panner.positionX.value,
          p.panner.positionY.value,
          p.panner.positionZ.value,
        ],
      })),
    };
  });
  if (near <= 0.002) {
    result.driver = await listener.evaluate(async () => {
      const probe = (window as any).voiceProbe;
      let remote;
      for (const p of probe.session.room.remoteParticipants.values())
        for (const publication of p.trackPublications.values())
          if (publication.track) remote = publication.track;
      const element = remote.attach();
      element.volume = 0;
      document.body.appendChild(element);
      await element.play();
      const after = await probe.rms();
      remote.detach(element);
      element.remove();
      return { after };
    });
  }
  assert(near > 0.002);
  await listener.evaluate(() => ((window as any).voiceProbe.blocked = true));
  const occluded = await listener.evaluate(() =>
    (window as any).voiceProbe.rms(),
  );
  assert(occluded < near * 0.5 && occluded > 0);
  await listener.evaluate(() => ((window as any).voiceProbe.far = true));
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 0,
  );
  const far = await listener.evaluate(() => (window as any).voiceProbe.rms());
  assert(far < 0.001);
  await listener.evaluate(() => {
    (window as any).voiceProbe.far = false;
    (window as any).voiceProbe.blocked = false;
  });
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 1,
  );
  result.audio = { near, occluded, far };
  await listener
    .getByRole("button", { name: "השתקת ההשמעה", exact: true })
    .click();
  result.audio.muted = await listener.evaluate(() =>
    (window as any).voiceProbe.rms(),
  );
  assert(result.audio.muted < 0.001);
  assert.equal(
    await listener.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLAudioElement>(
          "audio[data-voxel-voice-input]",
        ),
      ].every((e) => e.volume === 0),
    ),
    true,
  );
  await listener
    .getByRole("button", { name: "ביטול השתקת ההשמעה", exact: true })
    .click();
  result.audio.restored = await listener.evaluate(() =>
    (window as any).voiceProbe.rms(),
  );
  assert(result.audio.restored > 0.002);
  stage = "background-microphone";
  const captureCalls = await speaker.evaluate(
    () => (window as any).voiceProbe.gumCalls,
  );
  await speaker.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await state(speaker)).microphone, "off");
  await speaker.evaluate(() => {
    delete (document as any).visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await speaker.evaluate(() => (window as any).voiceProbe.gumCalls),
    captureCalls,
  );
  await speaker
    .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
    .click();
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "on",
  );
  result.simulatedBackgroundStopsCaptureWithoutAutomaticResume = true;
  stage = "game-scene-recovery";
  const beforeRecovery = await speaker.evaluate(
    () => (window as any).voiceProbe.gumCalls,
  );
  await speaker.evaluate(
    () => ((window as any).voiceProbe.sceneAvailable = false),
  );
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "off",
  );
  await speaker.evaluate(
    () => ((window as any).voiceProbe.sceneAvailable = true),
  );
  assert.equal(
    await speaker.evaluate(() => (window as any).voiceProbe.gumCalls),
    beforeRecovery,
  );
  await speaker
    .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
    .click();
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "on",
  );
  result.unavailableGameSceneStopsCapture = true;
  stage = "hidden-staff";
  for (const page of [speaker, listener])
    assert.equal(
      await page.evaluate(
        () => (window as any).voiceProbe.session.stats.remoteParticipants,
      ),
      1,
    );
  const hidden = await api.getParticipant(room, latest.get(actors[2])!);
  assert.equal(hidden.permission?.hidden, true);
  result.hiddenStaffAbsentFromPeerLists = true;
  stage = "output-selection";
  await listener.evaluate(async () => {
    try {
      await (window as any).voiceProbe.session.selectOutput(
        "missing-voxel-output",
      );
      (window as any).voiceProbe.badSink = false;
    } catch {
      (window as any).voiceProbe.badSink = true;
    }
  });
  assert.equal(
    await listener.evaluate(() => (window as any).voiceProbe.badSink),
    true,
  );
  result.invalidOutputRejected = true;
  stage = "fresh-reconnect";
  const before = issued.get(actors[0])!;
  await api.removeParticipant(room, latest.get(actors[0])!);
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "off",
  );
  await joined(speaker);
  assert(issued.get(actors[0])! > before);
  assert.equal((await state(speaker)).microphone, "off");
  assert.equal(
    (await api.getParticipant(room, latest.get(actors[0])!)).tracks.length,
    0,
  );
  result.reconnectRequiresExplicitMicrophone = true;
  stage = "audited-ui-retry";
  await observer
    .getByRole("button", { name: "השתקת כל התלמידים", exact: true })
    .click();
  await observer
    .getByRole("button", { name: "אישור מדיניות שמע", exact: true })
    .click();
  await observer
    .getByRole("button", { name: "בדיקה חוזרת של בקשת השמע", exact: true })
    .waitFor();
  await joined(speaker);
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.publishAllowed === false,
  );
  await joined(listener);
  await observer
    .getByRole("button", { name: "בדיקה חוזרת של בקשת השמע", exact: true })
    .click();
  await observer.getByText("מדיניות השמע נשמרה.", { exact: false }).waitFor();
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(commands.size, 1);
  assert.equal((await state(observer)).phase, "connected");
  assert.equal(await observer.locator("img").count(), 0);
  result.sameUuidMuteRetry = true;
  stage = "unmute-and-late-capture";
  await observer
    .getByRole("button", { name: "ביטול השתקה כללית", exact: true })
    .click();
  await observer
    .getByRole("button", { name: "אישור מדיניות שמע", exact: true })
    .click();
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.state.publishAllowed === true,
  );
  await listener.evaluate(() => ((window as any).voiceProbe.mode = "pending"));
  await listener
    .getByRole("button", { name: "הפעלת מיקרופון", exact: true })
    .click();
  await listener.waitForFunction(
    () => !!(window as any).voiceProbe.resolveCapture,
  );
  await listener.evaluate(() => (window as any).voiceProbe.unmount());
  await listener.evaluate(() => (window as any).voiceProbe.resolveCapture());
  await listener.waitForFunction(
    () =>
      (window as any).voiceProbe.lastCaptured?.readyState === "ended" &&
      !(window as any).voiceProbe.session.stats.capturePending,
  );
  result.lateCaptureStopped = true;
  stage = "late-activation";
  result.lateActivation = await speaker.evaluate(() =>
    (window as any).voiceProbe.lateActivation(),
  );
  assert.equal(result.lateActivation.calls, 0);
  assert.equal(result.lateActivation.stats.audio.context, "closed");
  await observer.screenshot({
    path: join(web, "test-results/voxel-voice-panel.png"),
  });
  stage = "teardown";
  const cleanup = [];
  for (const page of pages) {
    await page.evaluate(() => (window as any).voiceProbe.cleanup());
    await page.waitForFunction(() =>
      (window as any).voiceProbe.closed.every(
        (v) =>
          v.stats.disposed &&
          v.stats.audio.context === "closed" &&
          v.stats.pendingDisconnects === 0,
      ),
    );
    cleanup.push(
      await page.evaluate(() =>
        (window as any).voiceProbe.closed.map((v) => v.stats),
      ),
    );
  }
  for (const rows of cleanup)
    for (const row of rows) {
      assert.equal(row.microphoneTracks, 0);
      assert.equal(row.timers, 0);
      assert.equal(row.audio.outputs, 0);
      assert.equal(row.audio.nodes, 0);
    }
  result.cleanup = cleanup;
  result.backendCredentialSeen = credentialLeaked;
  assert(!credentialLeaked);
  result.signalStats = relay.stats;
  result.result = "PRODUCT_VOICE_UI_AND_SFU_PASS";
} catch (error) {
  result.stage = stage;
  result.error = { name: error instanceof Error ? error.name : "Error" };
  if (error instanceof Error) {
    let description = error.message;
    for (const token of privateTokens)
      description = description.replaceAll(token, "[credential]");
    result.error.description = description
      .replace(/(?:https?|wss?):\/\/[^\s"'<>]+/g, "[endpoint]")
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[credential]",
      )
      .slice(0, 700);
  }
  process.exitCode = 1;
} finally {
  result.moderationRequests = bodies;
  result.commands = commands.size;
  clearTimeout(deadline);
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
    join(web, "test-results/voxel-voice-session.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify(result));
}
