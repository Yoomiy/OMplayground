/** Real WebAudio graph verification; generated tones, no SFU/microphone/device claims. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { launchSoftwareBrowser } from "../../../games/voxel/tools/browser-harness.ts";
const web = fileURLToPath(new URL("../", import.meta.url)),
  repo = fileURLToPath(new URL("../../../", import.meta.url)),
  temp = mkdtempSync(join(tmpdir(), "voxel-voice-audio-"));
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined,
  http: ReturnType<typeof createServer> | undefined;
const deadline=setTimeout(()=>{console.error('Voice audio browser exceeded 60 seconds');void browser?.close();},60000);
try {
  writeFileSync(
    join(temp, "index.html"),
    '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>Voice audio verification</title><body><main id="owner"><h1>בדיקת מיקס קולי</h1><button id="activate">הפעלת שמע</button><button id="late">ביטול הפעלה מאוחרת</button><output id="status">ממתינים</output></main><script type="module" src="/entry.ts"></script></body></html>',
  );
  writeFileSync(
    join(temp, "entry.ts"),
    `
import {VoiceAudio} from '${join(web, "src/game/voxel/voice-audio.ts")}';
import {voiceScene} from '${join(repo, "games/voxel/src/client/voice-scene.ts")}';
const owner=document.querySelector('#owner');let mix;
window.audioProbe={};
document.querySelector('#activate').onclick=async()=>{
  mix=new VoiceAudio(owner);window.audioProbe.mix=mix;
  const active=await mix.activate();document.querySelector('#status').textContent=active?'פעיל':'נדרשת הפעלה';
};
document.querySelector('#late').onclick=async()=>{
  const candidate=new VoiceAudio(owner),pending=candidate.activate(),closing=candidate.close();
  await closing;window.audioProbe.late={activated:await pending,stats:candidate.stats};
};
window.audioProbe.run=async()=>{
 const generator=new AudioContext(),wave=generator.createOscillator(),level=generator.createGain(),generated=generator.createMediaStreamDestination();
 wave.frequency.value=440;level.gain.value=0.08;wave.connect(level).connect(generated);wave.start();await generator.resume();
 const remote=generated.stream.getAudioTracks()[0];mix.add('speaker',remote);
 const element=owner.querySelector('audio'),stream=element.srcObject,measuring=new AudioContext(),source=measuring.createMediaStreamSource(stream),analyser=measuring.createAnalyser();
 analyser.fftSize=2048;analyser.smoothingTimeConstant=0;source.connect(analyser);await measuring.resume();
 const rms=async()=>{await new Promise(r=>setTimeout(r,450));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);};
 const scene=(x=10000,blocked=false,distance=2)=>voiceScene([x,60,-x],0,0,[{id:'speaker',position:[x+distance,60,-x-2]}],()=>!blocked);
 mix.scene(scene());const near=await rms();
 mix.scene(scene(10000,true));const occluded=await rms();
 mix.scene(scene(10000,false,40));const distant=await rms();
 mix.scene(scene(100000000));const shifted=await rms();
 mix.mute(true);const muted=await rms();mix.mute(false);const restored=await rms();
 mix.scene(null);const unavailable=await rms();
 mix.scene(scene());mix.add('speaker',remote);mix.scene(scene());const replaced=await rms(),before=mix.stats;
 let invalidOutputRejected=false;try{await mix.selectOutput('voxel-fixture-missing-output-device');}catch{invalidOutputRejected=true;}
 mix.remove('speaker');const removed=mix.stats,inputPreserved=remote.readyState==='live';
 const close=mix.close(),sameClose=close===mix.close();await close;
 const closed=mix.stats,outputs=owner.querySelectorAll('audio').length,outputStopped=stream.getAudioTracks().every(t=>t.readyState==='ended');
 source.disconnect();analyser.disconnect();wave.stop();wave.disconnect();level.disconnect();generated.stream.getTracks().forEach(t=>t.stop());generated.disconnect();
 await Promise.all([generator.close(),measuring.close()]);
 document.querySelector('#status').textContent='הושלם';
 return {near,occluded,distant,shifted,muted,restored,unavailable,replaced,before,removed,closed,inputPreserved,sameClose,outputs,outputStopped,invalidOutputRejected,generator:generator.state,measuring:measuring.state};
};`,
  );
  await build({
    configFile: false,
    root: temp,
    logLevel: "warn",
    build: { target: "es2022", outDir: join(temp, "built"), minify: false },
  });
  const assets = new Map<string, string>();
  const index = (path: string, prefix = "") => {
    for (const e of readdirSync(path, { withFileTypes: true })) {
      const name = prefix + "/" + e.name,
        file = join(path, e.name);
      if (e.isDirectory()) index(file, name);
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
  const page = await browser.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto(`http://127.0.0.1:${address.port}`);
  const cycles = [];
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "הפעלת שמע", exact: true }).click();
    await page.getByText("פעיל", { exact: true }).waitFor();
    const value = await page.evaluate(() => (window as any).audioProbe.run());
    assert(value.near > 0.005, JSON.stringify(value));
    assert(
      value.occluded > value.near * 0.025 && value.occluded < value.near * 0.4,
      JSON.stringify(value),
    );
    for (const key of ["distant", "muted", "unavailable"])
      assert(value[key] < value.near * 0.02, JSON.stringify(value));
    for (const key of ["shifted", "restored", "replaced"])
      assert(
        value[key] > value.near * 0.7 && value[key] < value.near * 1.3,
        JSON.stringify(value),
      );
    assert.equal(value.before.tracks, 1);
    assert.equal(value.before.outputs, 1);
    assert.equal(value.removed.tracks, 0);
    assert(
      value.inputPreserved &&
        value.sameClose &&
        value.outputStopped &&
        value.invalidOutputRejected,
    );
    assert.equal(value.outputs, 0);
    assert.equal(value.closed.nodes, 0);
    assert.equal(value.closed.context, "closed");
    assert.equal(value.generator, "closed");
    assert.equal(value.measuring, "closed");
    cycles.push(value);
  }
  await page
    .getByRole("button", { name: "ביטול הפעלה מאוחרת", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).audioProbe.late);
  const late = await page.evaluate(() => (window as any).audioProbe.late);
  assert.equal(late.activated, false);
  assert.equal(late.stats.outputs, 0);
  assert.equal(late.stats.nodes, 0);
  assert.equal(late.stats.context, "closed");
  assert.deepEqual(errors, []);
  mkdirSync(join(web, "test-results"), { recursive: true });
  await page.screenshot({
    path: join(web, "test-results/voxel-voice-audio.png"),
  });
  const result = {
    result: "PASS",
    scope:
      "Real software-Chromium WebAudio mixing with generated MediaStream tones; no SFU, microphone, physical output or device performance qualification",
    browser: browser.version(),
    cycles,
    late,
    errors,
  };
  writeFileSync(
    join(web, "test-results/voxel-voice-audio.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      result: result.result,
      cycles: cycles.length,
      near: cycles.map((v) => v.near),
      occluded: cycles.map((v) => v.occluded),
      closed: true,
    }),
  );
} finally {
  clearTimeout(deadline);
  await browser?.close();
  await new Promise<void>((resolve) =>
    http ? http.close(() => resolve()) : resolve(),
  );
  rmSync(temp, { recursive: true, force: true });
}
