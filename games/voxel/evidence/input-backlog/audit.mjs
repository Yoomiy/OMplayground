import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const staging = process.argv.includes('--staging');
const archive = staging ? '/tmp/voxel-input-backlog-archive-stage' : 'games/voxel/evidence/input-backlog';
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const v=json(archive+'/verification.json'), pointer=json(staging?'/tmp/voxel-input-backlog-stage-pointer.json':'games/voxel/test-results/input-backlog.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);
assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts) assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs) {
  assert.equal(sha(read(f.path)),f.sha256,f.path);
  assert.equal(sha(read(archive+'/sources/'+f.path)),f.sha256,f.path);
}
for(const f of v.releaseFiles) assert.equal(sha(read(f.path)),f.sha256,f.path);
for(const f of v.baselineServerFiles) assert.equal(sha(read(archive+'/baseline-release/'+f.path)),f.sha256,f.path);
for(const f of v.firstCandidateReleaseFiles) assert.equal(sha(read(archive+'/first-candidate/release/'+f.path)),f.sha256,f.path);
for(const f of v.fixtureFiles) {
  assert.equal(sha(read(archive+'/react-fixture'+f.path)),f.sha256,f.path);
  assert.equal(sha(read('apps/web/test-results/react-fixture'+f.path)),f.sha256,f.path);
}
const prior=json(v.priorArchive+'/verification.json');
assert.equal(sha(read(v.priorArchive+'/verification.json')),v.priorVerificationSha256);
for(const f of prior.artifacts) assert.equal(sha(read(v.priorArchive+'/'+f.path)),f.sha256,f.path);
assert.equal(prior.buildId,v.baselineBuildId);
assert.deepEqual(v.changedRuntime,['games/voxel/src/sim/input-queue.ts']);
const runtimeFiles=walk('games/voxel/src');
const hashRuntime=old=>sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(old&&v.changedRuntime.includes(p)?v.priorArchive+'/sources/'+p:p)])));
assert.equal(hashRuntime(false),v.runtimeHash);
assert.equal(hashRuntime(true),prior.runtimeHash);
assert.equal(v.reconstructedPriorRuntimeHash,prior.runtimeHash);
assert.equal(sha(read(archive+'/negative/input-queue.ts')),sha(read(v.priorArchive+'/sources/games/voxel/src/sim/input-queue.ts')));
const first=json(archive+'/first-candidate/build.json');
assert.equal(first.buildId,'5fec9a3ff7782d641836a4dc8c8c162463af5f18e8b5e3f72f643c311dd5e1e9');
assert.equal(sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(v.changedRuntime.includes(p)?archive+'/first-candidate/input-queue.ts':p)]))),first.runtimeHash);
const firstRelease=json(archive+'/first-candidate/release.json');
assert.equal(firstRelease.buildId,first.buildId);
for(const [kind,dir] of [['client','dist-client'],['server','dist-server']]) for(const f of firstRelease[kind]) assert.equal(sha(read(archive+'/first-candidate/release/'+dir+'/'+f.path)),f.hash);
assert.match(read(archive+'/first-candidate/jitter-negative.txt').toString(),/brief packet jitter/);
assert.match(read(archive+'/first-candidate/jitter-negative.txt').toString(),/ℹ fail 1\n/);
const firstComparison=json(archive+'/first-candidate/current-comparison.json');
assert.equal(firstComparison.buildId,first.buildId); assert.equal(firstComparison.profiles[0].resyncs,135);
const comparisonBaseline=json(archive+'/first-candidate/baseline-comparison.json');
assert.equal(comparisonBaseline.buildId,prior.buildId); assert.equal(comparisonBaseline.profiles[0].resyncs,0);
const refined=json(archive+'/refined-diagnostic.json'); assert.equal(refined.buildId,v.buildId);
assert.equal(refined.profiles[0].resyncs,0); assert.equal(refined.profiles[0].steadyResyncs,0);
assert.equal(refined.profiles[0].skippedInputBatches,0);
const build=json(archive+'/build.json');
assert.equal(build.buildId,v.buildId);
assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);
assert.equal(json(archive+'/release.json').buildId,v.buildId);
for(const key of ['engineHash','bindingsHash','contentHash','protocol','environmentVersion','columnFormat','regionFormat','editFormat','height']) assert.equal(build[key],json(v.priorArchive+'/build.json')[key],key);
const core=read(archive+'/core.txt').toString();
assert.equal(read(archive+'/core.exit').toString().trim(),'0');
for(const n of [107,92]) assert.match(core,new RegExp(`ℹ pass ${n}\\n`));
assert.equal((core.match(/ℹ pass 45\n/g)||[]).length,2);
assert.match(core,/80 passed; 0 failed; 3 ignored/);
assert.match(read(archive+'/service-tests.txt').toString(),/ℹ pass 50\n/);
assert.match(read(archive+'/web-tests.txt').toString(),/180 passed/);
assert.match(read(archive+'/web-build.txt').toString(),/built in/);
for(const name of ['types','service-types','web-types']) assert.equal(read(archive+'/'+name+'.txt').length,0);
for(const f of v.artifacts.filter(f=>f.path.startsWith('exits/'))) assert.equal(read(archive+'/'+f.path).toString().trim(),'0',f.path);
assert.match(read(archive+'/negative/unit.txt').toString(),/a restored link must not retain old input latency indefinitely/);
assert.match(read(archive+'/negative/unit.txt').toString(),/ℹ fail 3\n/);
assert.match(read(archive+'/negative/wasm.txt').toString(),/recovered server input latency is bounded by one packet/);
const p90=a=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.9)-1];
const old=json(archive+'/negative/browser.json');
assert.equal(old.buildId,prior.buildId); assert.equal(old.result,'FAIL');
assert.equal(old.failure.phase,'one-second-input-stall');
assert.match(old.failure.message,/persistent acknowledgement backlog/);
assert(p90(old.short.recoveredLagSamples)>Math.max(...old.referenceLag)+4);
assert.equal(json(archive+'/observer-failure.json').failure.phase,'five-second-input-stall');
const b=json(archive+'/browser.json'), distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
assert.equal(b.result,'BROWSER_REAL_TCP_INPUT_STALL_AUTHORITY_ACK_BOUND_AND_EXPLICIT_RECOVERY_PASS');
assert.equal(b.buildId,v.buildId); assert.equal(b.referenceLag.length,8);
assert.equal(b.short.recoveredLagSamples.length,12);
assert(p90(b.short.recoveredLagSamples)<=Math.max(...b.referenceLag)+4);
for(const s of [b.short,b.long]) {
  assert(s.elapsedHeldMs>=s.requestedHeldMs);
  assert(s.serverWhileHeld.tick>s.serverBefore.tick);
  assert(distance(s.serverBefore.position,s.serverWhileHeld.position)<.05);
  assert(s.serverTraceAfterRelease.length>5);
  assert(s.serverTraceAfterRelease.every(r=>r.state.epoch>=s.serverWhileHeld.epoch));
}
assert(b.short.clientFramesBuffered>=40);
assert(b.short.clientWhileHeld.inputLag<=120); assert.equal(b.short.clientWhileHeld.status,'playing');
assert(b.short.clientWhileHeld.lastReceivedAgoMs<1000);
assert(b.long.bufferedFrames<=120); assert(b.long.bufferedFrames>=100);
assert(b.long.observedFramesAfterFailure<=4);
assert.equal(b.long.clientAtFailure.inputLag,b.long.clientLate.inputLag);
assert.equal(b.long.clientLate.focused,false); assert.equal(b.long.clientLate.status,'recovering');
assert(b.long.clientLate.lastReceivedAgoMs<1000);
assert(b.reconnect.newEpoch>b.reconnect.oldEpoch);
assert.equal(b.reconnect.admissions,b.long.admissionsBeforeReconnect+1);
assert.deepEqual(b.cleanup.resources,{geometries:0,textures:0,workers:0});
assert.equal(b.cleanup.audio,'closed'); assert.equal(b.cleanup.owners.liveWorkers,0);
assert.equal(b.cleanup.owners.openedSockets,b.cleanup.owners.closedSockets);
assert.equal(b.cleanup.owners.createdWorkers,b.cleanup.owners.closedWorkers);
assert.equal(b.remainingRooms,0); assert.deepEqual(b.errors,[]);
for(const kind of ['source','packaged']) {
  const c=json(archive+'/'+kind+'-columns.json');
  assert.equal(c.buildId,v.buildId); assert.equal(c.result,'REAL_TCP_EDITED_BASELINE_DRAIN_AND_RECONNECT_PASS');
  assert.deepEqual(c.holds.map(h=>h.holdMs),[1000,5000]);
  for(const h of c.holds) assert.equal(h.frames,49);
  assert(c.maxBufferedBytes<=1024*1024); assert.equal(c.remainingRooms,0); assert.deepEqual(c.events,[]);
}
const edited=json(archive+'/edited-browser.json');
assert.equal(edited.buildId,v.buildId); assert.equal(edited.result,'BROWSER_EDITED_WORLD_TCP_STALL_AND_RECONNECT_PASS');
assert.equal(edited.cold.columns,49); assert.deepEqual(edited.stall.stalePosition,edited.stall.latePosition);
assert.equal(edited.stall.inputLagWhenStalled,edited.stall.inputLagLate);
assert(edited.stall.heldMs>=5000); assert(edited.reconnect.newEpoch>edited.reconnect.oldEpoch);
assert.equal(edited.remainingRooms,0); assert.deepEqual(edited.errors,[]);
const react=json(archive+'/react.json'); assert.equal(react.buildId,v.buildId); assert.equal(react.result,'PASS');
assert.equal(react.repeatedMounts.cycles,6); assert.equal(react.voice.enabled,false); assert.deepEqual(react.errors,[]);
for(const s of react.repeatedMounts.samples) {
  assert.deepEqual(s.unmounted.resources,{geometries:0,textures:0,workers:0});
  assert.equal(s.unmounted.audio,'closed'); assert.equal(s.unmounted.memory.gpuBuffers.live,0);
  assert.equal(s.unmounted.memory.gpuBuffers.bytes,0);
  assert.equal(s.unmounted.owners.createdWorkers,s.unmounted.owners.closedWorkers);
  assert.equal(s.unmounted.owners.openedSockets,s.unmounted.owners.closedSockets);
}
for(const key of ['chatFlow','moderationFlow','staffModeAndTeleport','chatPersistedAfterReopen']) assert.equal(react[key],true,key);
const presentation=json(archive+'/presentation.json'); assert.equal(presentation.buildId,v.buildId);
assert.equal(presentation.result,'PASS'); assert.deepEqual(presentation.errors,[]);
for(const c of presentation.cleanup) {
  for(const key of ['geometries','textures','workers']) assert.equal(c[key],0);
  assert.equal(c.audio.state,'closed');
}
const sockets=json(archive+'/sockets.json'); assert.equal(sockets.buildId,v.buildId); assert.equal(sockets.profiles.length,6);
let containedSocketWindows=0, startupResyncs=0;
for(const p of sockets.profiles) {
  assert.equal(p.steadyWindowCoverage,'complete'); assert.equal(p.skippedInputBatches,0); assert.equal(p.steadyResyncs,0);
  assert.equal(p.resyncs,p.resyncTraces.reduce((n,t)=>n+t.count,0));
  for(const t of p.resyncTraces) {
    assert.equal(t.count,1,'one initial correction per affected actor, never recurring');
    assert.equal(t.steadyCount,0);
    assert.equal(t.samples.length,1);
    assert.equal(t.samples[0].sampling,false);
    assert(t.samples[0].atMs<p.samplingStartedAtMs);
  }
  startupResyncs+=p.resyncs;
  assert.equal(p.cleanup.rooms,0); assert.equal(p.cleanup.closedClients,p.totalPlayers);
  assert.deepEqual(p.steadyRoomMetrics,p.roomMetrics.filter(m=>m.windowStartedAtMs>=p.samplingStartedAtMs&&m.windowEndedAtMs<=p.samplingEndedAtMs));
  assert.equal(new Set(p.steadyRoomMetrics.map(m=>m.worldId)).size,p.rooms);
  for(const m of p.roomMetrics) {assert.equal(m.overrunMs,0);assert.equal(m.worldStep_samples,m.ticks);}
  containedSocketWindows+=p.steadyRoomMetrics.length;
}
assert.equal(startupResyncs,149,'retain the observed startup corrections explicitly');
const survival=json(archive+'/survival.json'); assert.equal(survival.buildId,v.buildId);
assert.equal(JSON.parse(execFileSync(process.execPath,['games/voxel/tools/check-survival-workers.ts',archive+'/survival.json'],{encoding:'utf8'})).result,'SURVIVAL_WORKER_REPORT_AUDIT_PASS');
const observed=json(archive+'/survival-observation.json'); assert.equal(observed.buildId,v.buildId);
assert.equal(observed.result,'SURVIVAL_TERMINAL_REPORT_AND_INDEPENDENT_AUDIT_PASS');
assert.equal(observed.reportSha256,sha(read(archive+'/survival.json')));
assert.equal(observed.auditSha256,sha(read(archive+'/survival-audit.txt')));
assert.equal(observed.originalShellExitStatus,null); assert.equal(observed.benchmarkRerun,false);
const startup=json(archive+'/startup.json'); assert.equal(startup.buildId,v.buildId);
assert.equal(startup.statusRpcs.length,8); assert.equal(startup.remoteApplicationWrites,false); assert.equal(startup.rooms,0);
assert.equal(startup.health,200); assert.equal(startup.ready,200);
const web=json(archive+'/web-inventory.json'); assert.equal(web.length,v.webInventoryFiles);
for(const f of web) assert.equal(sha(read(f.path)),f.sha256,f.path);
const proposedTickTargetExceededLayouts=sockets.profiles.filter(p=>p.steadyRoomMetrics.some(m=>m.worldStep_p95UpperMs>10||m.worldStep_p99UpperMs>20)).map(p=>`${p.rooms}x${p.playersPerRoom}`);
const result={result:'INPUT_BACKLOG_SOURCE_RELEASE_NEGATIVE_TCP_BROWSER_WORKLOAD_AND_PRIOR_IMMUTABILITY_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,releaseFiles:v.releaseFiles.length,baselineServerFiles:v.baselineServerFiles.length,firstCandidateReleaseFiles:v.firstCandidateReleaseFiles.length,fixtureFiles:v.fixtureFiles.length,artifacts:v.artifacts.length,webFiles:web.length,changedRuntimeFiles:1,reconstructedPriorRuntime:true,priorArchiveUnchanged:true,containedSocketWindows,startupResyncs,steadyResyncs:0,proposedTickTargetExceededLayouts,schoolCapacityQualified:false,survivalContainedWindows:survival.steadyRoomMetrics.length,scope:v.scope};
fs.writeFileSync(staging?'/tmp/voxel-input-backlog-stage-audit.json':'games/voxel/test-results/input-backlog-audit.json',JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result));
