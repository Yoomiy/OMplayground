/** Product voice UI -> direct LiveKit, using an isolated room and generated audio. */
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
  throw new Error("Set VOXEL_TEST_LIVEKIT=1 for an isolated media room");
const endpoint = process.env.LIVEKIT_URL ?? "",
  key = process.env.LIVEKIT_API_KEY,
  secret = process.env.LIVEKIT_API_SECRET;
if (!endpoint || !key || !secret)
  throw new Error("LiveKit configuration required");
const provider = new RoomServiceClient(
    endpoint.replace(/^ws/, "http"),
    key,
    secret,
    { requestTimeout: 5 },
  ),
  room = "voxel-direct-voice-" + randomUUID(),
  applicationRoom = randomUUID(),
  actors = [randomUUID(), randomUUID(), randomUUID()],
  web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-direct-voice-")),
  issued = new Map<string, number>();
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  http: ReturnType<typeof createServer> | undefined,
  createdSid: string | undefined;
const result: Record<string, unknown> = {
  result: "INCOMPLETE",
  schoolDatabaseWrites: 0,
  scope:
    "Actual product UI and direct SFU; school admission and game poses are fixtures",
};
const deadline = setTimeout(() => void browser?.close(), 120000);
try {
  assert.equal((await provider.listRooms([room])).length, 0);
  createdSid = (
    await provider.createRoom({
      name: room,
      emptyTimeout: 60,
      departureTimeout: 60,
    })
  ).sid;
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
const probe=window.voiceProbe={mode:'deny',gumCalls:0,generators:[],far:false,reconnects:0};
const start=VoiceSession.prototype.start;VoiceSession.prototype.start=function(...args){probe.session=this;return start.apply(this,args);};
navigator.mediaDevices.getUserMedia=async constraints=>{probe.gumCalls++;if(constraints.video)throw new Error('Camera forbidden');if(probe.mode==='deny')throw new DOMException('Fixture denial','NotAllowedError');const context=new AudioContext(),wave=context.createOscillator(),gain=context.createGain(),target=context.createMediaStreamDestination();wave.frequency.value=440;gain.gain.value=.07;wave.connect(gain).connect(target);wave.start();await context.resume();probe.generators.push({context,wave,gain,target});return target.stream;};
const api=createVoxelApi({room:${JSON.stringify(applicationRoom)},serverUrl:location.origin,getToken:async()=>actor});
const scene=()=>voiceScene([probe.far?100:index*2,60,0],0,0,actors.slice(0,2).filter(id=>id!==actor).map(id=>({id,position:[actors.indexOf(id)*2,60,0]})),()=>true);
root.render(<main className="voxel-session" dir="rtl"><VoxelVoice api={api} ready={true} manualJoin={true} scene={scene} onOpen={()=>{}}/></main>);
probe.rms=async()=>{const output=host.querySelector('audio[data-voxel-voice-output]');if(!output?.srcObject)return 0;if(!probe.measuring){const context=new AudioContext(),source=context.createMediaStreamSource(output.srcObject),analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);await context.resume();probe.measuring={context,source,analyser};}await new Promise(r=>setTimeout(r,300));const data=new Float32Array(probe.measuring.analyser.fftSize);probe.measuring.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);};
probe.cleanup=async()=>{root.unmount();await probe.session.close();for(const g of probe.generators){g.wave.stop();g.target.stream.getTracks().forEach(t=>t.stop());await g.context.close();}if(probe.measuring)await probe.measuring.context.close();return probe.session.stats;};
`,
  );
  result.stage = "build";
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
  const assets = new Map<string, string>();
  function index(path: string, prefix = "") {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, item.name),
        name = prefix + "/" + item.name;
      if (item.isDirectory()) index(file, name);
      else assets.set(name, file);
    }
  }
  index(join(temp, "built"));
  http = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (path === "/api/voxel/voice-token") {
        const actor = req.headers.authorization?.slice(7),
          actorIndex = actors.indexOf(actor ?? "");
        assert(actor && actorIndex >= 0);
        let source = "";
        for await (const chunk of req) source += chunk;
        assert.deepEqual(JSON.parse(source), { room: applicationRoom });
        const hidden = actorIndex === 2,
          token = new AccessToken(key, secret, { identity: actor, ttl: "5s" });
        token.addGrant({
          roomJoin: true,
          room,
          canPublish: !hidden,
          canPublishSources: hidden ? [] : [TrackSource.MICROPHONE],
          canSubscribe: true,
          canPublishData: false,
          hidden,
        });
        issued.set(actor, (issued.get(actor) ?? 0) + 1);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(
          JSON.stringify({
            token: await token.toJwt(),
            serverUrl: endpoint,
            publish: !hidden,
            hidden,
          }),
        );
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
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => http!.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  assert(address && typeof address === "object");
  result.stage = "browser";
  browser = await launchSoftwareBrowser();
  const pages = [];
  for (const actor of actors) {
    const context = await browser.newContext(),
      page = await context.newPage();
    pages.push(page);
    await page.goto(`http://127.0.0.1:${address.port}/?actor=${actor}`);
    await page
      .getByRole("button", { name: "כניסה לשיחה", exact: true })
      .click();
    await page.waitForFunction(
      () => (window as any).voiceProbe.session?.state.phase === "connected",
    );
  }
  result.stage = "joined";
  const [speaker, listener, observer] = pages;
  assert.equal(
    (await provider.getParticipant(room, actors[2])).permission?.hidden,
    true,
  );
  assert.equal(
    await observer
      .getByRole("button", { name: "מיקרופון מושתק (M)", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await observer.getByText("כלי מורה", { exact: true }).count(),
    0,
  );
  await speaker
    .getByRole("button", { name: "מיקרופון מושתק (M)", exact: true })
    .click();
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "denied",
  );
  await speaker.evaluate(() => {
    (window as any).voiceProbe.mode = "generated";
  });
  await speaker
    .getByRole("button", { name: "מיקרופון מושתק (M)", exact: true })
    .click();
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.session.state.microphone === "on",
  );
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 1,
  );
  result.stage = "audio";
  const rms = await listener.evaluate(() => (window as any).voiceProbe.rms());
  assert(rms > 0.001);
  await listener.evaluate(() => {
    (window as any).voiceProbe.far = true;
  });
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 0,
  );
  await listener.evaluate(() => {
    (window as any).voiceProbe.far = false;
  });
  await listener.waitForFunction(
    () => (window as any).voiceProbe.session.stats.audio.tracks === 1,
  );
  // Let the original join JWT expire. The ongoing call and SDK reconnect use LiveKit's lifecycle.
  result.stage = "sdk-reconnect";
  await speaker.waitForTimeout(6000);
  await speaker.evaluate(() => {
    const probe = (window as any).voiceProbe;
    probe.session.room.once("reconnected", () => probe.reconnects++);
    probe.session.room.simulateScenario("signal-reconnect");
  });
  await speaker.waitForFunction(
    () => (window as any).voiceProbe.reconnects === 1,
  );
  assert.equal(
    await speaker.evaluate(
      () => (window as any).voiceProbe.session.state.microphone,
    ),
    "on",
  );
  assert.deepEqual(
    actors.map((actor) => issued.get(actor)),
    [1, 1, 1],
  );
  result.directLiveKit = true;
  result.sdkReconnectAfterJoinTokenExpiry = true;
  result.microphonePreserved = true;
  result.nearRms = rms;
  result.proximitySubscriptions = true;
  result.hiddenStaff = true;
  result.stage = "cleanup";
  const cleanup = [];
  for (const page of pages)
    cleanup.push(
      await page.evaluate(() => (window as any).voiceProbe.cleanup()),
    );
  for (const stats of cleanup) {
    assert.equal(stats.timers, 0);
    assert.equal(stats.microphoneTracks, 0);
    assert.equal(stats.audio.context, "closed");
    assert.equal(stats.pendingDisconnects, 0);
  }
  result.cleanup = cleanup;
  result.result = "PASS";
} catch (error) {
  result.error = error instanceof Error ? error.name : "Error";
  result.description =
    error instanceof Error
      ? error.message
          .replace(/(?:https?|wss?):\/\/[^\s"'<>]+/g, "[endpoint]")
          .replace(
            /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
            "[token]",
          )
          .slice(0, 700)
      : "Unknown failure";
  // Do not include SDK exceptions or request URLs containing LiveKit tokens.
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await browser?.close();
  if (http) {
    http.closeAllConnections();
    await new Promise<void>((resolve) => http!.close(() => resolve()));
  }
  if (createdSid) {
    const existing = await provider.listRooms([room]);
    assert(existing.every((item) => item.sid === createdSid));
    if (existing.length) await provider.deleteRoom(room);
    assert.equal((await provider.listRooms([room])).length, 0);
  }
  mkdirSync(join(web, "test-results"), { recursive: true });
  writeFileSync(
    join(web, "test-results/voxel-voice-session.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify(result));
}
