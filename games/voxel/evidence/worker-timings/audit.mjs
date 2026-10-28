import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const archive='games/voxel/evidence/worker-timings',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const v=json(archive+'/verification.json'),pointer=json('games/voxel/test-results/worker-timings.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(archive+'/sources/'+f.path)),f.sha256);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const current=json('games/voxel/artifacts/build.json');assert.equal(current.buildId,v.buildId);
const runtime=sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));assert.equal(runtime,current.runtimeHash);
const prior=json(v.priorArchive+'/verification.json');assert.equal(sha(read(v.priorArchive+'/verification.json')),v.priorVerificationSha256);
for(const f of prior.artifacts)assert.equal(sha(read(v.priorArchive+'/'+f.path)),f.sha256,f.path);
const diagnostic=json(archive+'/diagnostic/benchmark.json');assert.equal(diagnostic.buildId,prior.buildId);assert.equal(diagnostic.results.length,4);
assert.equal(diagnostic.sourceSha256.current,sha(read(v.priorArchive+'/sources/games/voxel/src/sim/game-room.ts')));
assert.equal(diagnostic.sourceSha256.encoder,sha(read(v.priorArchive+'/sources/games/voxel/src/server/snapshot-encoder.ts')));
for(const scene of ['dense-motion','craft-drops-tnt']){const pair=diagnostic.results.filter(r=>r.scene===scene);assert.equal(pair.length,2);assert.notEqual(pair[0].optimized,pair[1].optimized);for(const k of ['wireBytes','messages','transcriptSha256'])assert.equal(pair[0][k],pair[1][k]);}
const summary=json(archive+'/diagnostic/summary.json');assert.equal(summary.profileSha256,sha(read(archive+'/diagnostic/profile.cpuprofile')));
const sockets=json(archive+'/sockets.json');assert.equal(sockets.buildId,v.buildId);assert.equal(sockets.profiles.length,6);
for(const p of sockets.profiles){assert.equal(p.cleanup.rooms,0);assert.equal(p.cleanup.closedClients,p.totalPlayers);assert.equal(p.resyncs,0);assert.equal(p.skippedInputBatches,0);assert(p.inputBatchHz>29);assert(p.roomMetrics.length>=p.rooms);
for(const m of p.roomMetrics){assert.equal(m.ticks,m.worldStep_samples);assert(m.ticks>0);assert.equal(m.overrunMs,0);for(const kind of ['worldStep','observerStep','workerTurn','generationJob','command']){assert(m[`${kind}_samples`]>=0);assert(m[`${kind}_meanMs`]<=m[`${kind}_maxMs`]);assert(m[`${kind}_p95UpperMs`]<=m[`${kind}_p99UpperMs`]);assert(m[`${kind}_p99UpperMs`]<=m[`${kind}_maxMs`]);}}}
const browser=json(archive+'/browser.json');assert.equal(browser.result,'PASS');assert.equal(browser.buildId,v.buildId);assert.deepEqual(browser.errors,[]);
for(const c of browser.cleanup){for(const k of ['geometries','textures','workers'])assert.equal(c[k],0);assert.equal(c.audio.state,'closed');assert.equal(c.audio.contexts,0);}
const startup=json(archive+'/startup.json');assert.equal(startup.buildId,v.buildId);assert.equal(startup.statusRpcs.length,8);assert.equal(startup.remoteApplicationWrites,false);assert.equal(startup.rooms,0);assert.equal(startup.health,200);assert.equal(startup.ready,200);
const web=json(archive+'/web-inventory.json');assert.equal(web.length,v.webInventoryFiles);for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
const result={result:'WORKER_TIMING_ARCHIVE_CURRENT_SOURCE_RELEASE_AND_BEHAVIOR_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,releaseFiles:v.releaseFiles.length,artifacts:v.artifacts.length,webFiles:web.length,socketProfiles:sockets.profiles.length,priorArchiveUnchanged:true,diagnosticBuildId:diagnostic.buildId,scope:v.scope};
fs.writeFileSync('games/voxel/test-results/worker-timings-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
