import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const destination = 'games/voxel/evidence/worker-timings';
assert(!fs.existsSync(destination), 'Never overwrite an evidence archive');
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const priorPath = 'games/voxel/evidence/snapshot-scaling/verification.json';
assert.equal(sha(read(priorPath)), 'b3b78a41d2bf9ef9a160d514878b56a1faf7ef676cbfc85894c298056f35a588');
const prior = json(priorPath), build = json('games/voxel/artifacts/build.json'), release = json('games/voxel/artifacts/release.json');
const sockets = json('games/voxel/test-results/survival-sockets.json'), browser = json('games/voxel/test-results/browser-presentation.json'), startup = json('/tmp/voxel-worker-timing-startup.json');
for (const r of [release,sockets,browser,startup]) assert.equal(r.buildId,build.buildId);
assert.equal(sockets.result,'LOOPBACK_SURVIVAL_LOAD_COMPLETED'); assert.equal(sockets.profiles.length,6);
for (const p of sockets.profiles) {
  assert.equal(p.cleanup.rooms,0);assert.equal(p.cleanup.closedClients,p.totalPlayers);
  assert.equal(p.resyncs,0);assert.equal(p.skippedInputBatches,0);assert(p.inputBatchHz>29);
  assert(p.roomMetrics.length>=p.rooms);
  for (const m of p.roomMetrics) {
    assert.equal(m.worldStep_samples,m.ticks);assert(m.worldStep_samples>0);assert(m.windowMs>9900);assert.equal(m.overrunMs,0);
    for (const kind of ['worldStep','observerStep','workerTurn','generationJob','command']) {
      for (const k of ['samples','meanMs','p95UpperMs','p99UpperMs','maxMs']) assert(Number.isFinite(m[`${kind}_${k}`])&&m[`${kind}_${k}`]>=0);
      assert(m[`${kind}_meanMs`]<=m[`${kind}_maxMs`]);assert(m[`${kind}_p95UpperMs`]<=m[`${kind}_p99UpperMs`]);assert(m[`${kind}_p99UpperMs`]<=m[`${kind}_maxMs`]);
    }
  }
}
assert.equal(browser.result,'PASS');assert.deepEqual(browser.errors,[]);assert.equal(browser.cleanup.length,2);
for (const c of browser.cleanup) {for (const k of ['workers','geometries','textures']) assert.equal(c[k],0);assert.equal(c.audio.state,'closed');assert.equal(c.audio.contexts,0);}
assert.equal(startup.statusRpcs.length,8);assert.equal(startup.health,200);assert.equal(startup.ready,200);assert.equal(startup.rooms,0);assert.equal(startup.remoteApplicationWrites,false);
assert.equal(read('/tmp/voxel-worker-timing-core.exit').toString().trim(),'0');
const core=read('/tmp/voxel-worker-timing-core.log').toString();
assert.match(core,/ℹ pass 97\n/);assert.match(core,/ℹ pass 87\n/);assert.equal((core.match(/ℹ pass 44\n/g)||[]).length,2);assert.match(core,/80 passed; 0 failed; 3 ignored/);
assert.match(read('/tmp/voxel-worker-timing-service-tests.log').toString(),/pass 50/);assert.match(read('/tmp/voxel-worker-timing-web-tests.log').toString(),/180 passed/);assert.match(read('/tmp/voxel-worker-timing-web-build.log').toString(),/built in/);
for (const p of ['types','service-types','web-types']) assert.equal(read(`/tmp/voxel-worker-timing-${p}.log`).length,0);
const profileDir='/tmp/voxel-survival-cpu-profile',profileSummary=json(profileDir+'/summary.json'),profileBenchmark=json(profileDir+'/benchmark.json');
assert.equal(profileSummary.buildId,prior.buildId);assert.equal(profileBenchmark.buildId,prior.buildId);assert.equal(profileBenchmark.results.length,4);assert.equal(profileBenchmark.repeats,1);
assert.equal(profileBenchmark.sourceSha256.current,sha(read('games/voxel/evidence/snapshot-scaling/sources/games/voxel/src/sim/game-room.ts')));
assert.equal(profileBenchmark.sourceSha256.encoder,sha(read('games/voxel/evidence/snapshot-scaling/sources/games/voxel/src/server/snapshot-encoder.ts')));
assert.equal(profileSummary.profileSha256,sha(read(profileDir+'/'+profileSummary.profile)));
const additions=['games/voxel/src/server/timing-histogram.ts','games/voxel/tests/timing-histogram.test.ts','games/voxel/tests/wasm/step-timings.test.ts','games/voxel/docs/worker-timings.md'];
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),...additions])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.local$)/.test(p)));
const artifacts=[];
function copy(input,output){const bytes=read(input),target=path.join(destination,output);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);const hash=sha(bytes);artifacts.push({path:output,sha256:hash});return hash;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)})),releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){const p='games/voxel/'+dir+'/'+f.path;const hash=copy(p,'release/'+dir+'/'+f.path);assert.equal(hash,f.hash);releaseFiles.push({path:p,sha256:hash});}
const copies={
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
  'core.txt':'/tmp/voxel-worker-timing-core.log','core.exit':'/tmp/voxel-worker-timing-core.exit',
  'service-tests.txt':'/tmp/voxel-worker-timing-service-tests.log','web-tests.txt':'/tmp/voxel-worker-timing-web-tests.log','web-build.txt':'/tmp/voxel-worker-timing-web-build.log',
  'types.txt':'/tmp/voxel-worker-timing-types.log','service-types.txt':'/tmp/voxel-worker-timing-service-types.log','web-types.txt':'/tmp/voxel-worker-timing-web-types.log',
  'sockets.json':'games/voxel/test-results/survival-sockets.json','sockets.txt':'/tmp/voxel-worker-timing-sockets.log',
  'browser.json':'games/voxel/test-results/browser-presentation.json','browser.txt':'/tmp/voxel-worker-timing-browser.log',
  'startup.json':'/tmp/voxel-worker-timing-startup.json','startup.txt':'/tmp/voxel-worker-timing-startup.log','startup.mjs':'/tmp/voxel-snapshot-startup.mjs',
  'release-verify.txt':'/tmp/voxel-worker-timing-release-verify.log',
  'focused.txt':'/tmp/voxel-worker-timing-focused.log','live-focused.txt':'/tmp/voxel-worker-timing-live.log',
  'diagnostic/summary.json':profileDir+'/summary.json','diagnostic/benchmark.json':profileDir+'/benchmark.json','diagnostic/benchmark.txt':'/tmp/voxel-survival-cpu-profile.log','diagnostic/profile.cpuprofile':profileDir+'/'+profileSummary.profile,
  'producer.mjs':'/tmp/voxel-worker-timing-capture.mjs','audit.mjs':'/tmp/voxel-worker-timing-audit.mjs',
};
for(const [output,input] of Object.entries(copies))copy(input,output);
const webInventory=walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))}));
const webBytes=JSON.stringify(webInventory,null,2)+'\n';fs.writeFileSync(path.join(destination,'web-inventory.json'),webBytes);artifacts.push({path:'web-inventory.json',sha256:sha(webBytes)});
const scope='Bounded actual-worker timing distributions, six packaged loopback movement workloads and two software-rendered browser clients; fixture identities, no hosted Auth/SQL/Storage writes, device/network/capacity qualification, deployment or standalone web bundle. Diagnostic CPU profile retains previous release identity.';
const note=`# Worker timing qualification\n\n${scope}\n\nMatched release: ${build.buildId}. Full checks pass 97 domain, 80 native Rust\n(3 ignored), 87 Wasm, 44 source and 44 packaged integration cases. All 50 service\nand 180 web tests, strict game/service/web types, production web build, release\nverification and guarded eight-read-only-status/zero-room startup pass.\n\nWorld steps, paused observer-clock steps, worker turns, successful generation\njobs and supervisor commands have separate fixed-storage ten-second histograms.\nQuantiles use 0.05 ms buckets through 200 ms and conservative overflow maxima.\nActual-Wasm catch-up and three real worker reporting windows verify counting,\npaused semantics and reset. Metrics forward as flat numeric log context.\n\nAll six socket profiles run near 30 Hz without skipped input batches, resyncs\nor reported dropped time; all clients/rooms close. Maximum room world-step p95\nupper bounds are 2.25/4.10/9.75/20.50 ms at 16/32/64/128 players, 5.20 ms for\n2x32 and 2.60 ms for 4x16. The 128-player maximum is 104.99 ms, with 72.77 ms\nendpoint input-ack p99. Windows include startup/warmup; these are single short\nco-located samples, not overhead comparisons or school-capacity qualification.\nTwo actual browser clients pass presentation and zero-resource/audio teardown.\n\nThe diagnostic profile is build ${profileSummary.buildId}, before instrumentation,\nwith one 128-actor pair per activity scene and four wire-equivalent runs. CPU\nsamples include harness/startup/generation/hashing outside measured ticks. Its\nroom and encoder inputs match the preceding snapshot-scaling archive. The\ncurrent release does not inherit that profile's timing claims.\n\nCurrent sources and exact release bytes are copied. Web outputs are inventoried\nrather than copied as a final deployment bundle. The preceding snapshot-scaling\narchive is immutable. Heavy survival and sustained IO/load/memory/network/device\ngates, actual school Auth/recovery/classroom rollout, product decisions and\ncutover/legacy removal remain. The separately rejected hosted-write run still\nawaits explicit approval. No migrations were changed or applied.\n`;
fs.writeFileSync(path.join(destination,'README.md'),note);artifacts.push({path:'README.md',sha256:sha(note)});
const verification={result:'BOUNDED_WORKER_TIMING_AND_LOCAL_LOAD_PASS',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash:build.runtimeHash,scope,qualified:{domain:97,native:80,nativeIgnored:3,wasm:87,sourceIntegration:44,packagedIntegration:44,service:50,web:180,socketProfiles:6,browserClients:2,statusRpcs:8},priorArchive:'games/voxel/evidence/snapshot-scaling',priorVerificationSha256:sha(read(priorPath)),diagnosticBuildId:profileSummary.buildId,sourceInputs,releaseFiles,webInventoryFiles:webInventory.length,artifacts};
const bytes=JSON.stringify(verification,null,2)+'\n';fs.writeFileSync(path.join(destination,'verification.json'),bytes);
const pointer={result:verification.result,buildId:build.buildId,archive:destination,verificationSha256:sha(bytes),sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,artifacts:artifacts.length,scope};
fs.writeFileSync('games/voxel/test-results/worker-timings.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
