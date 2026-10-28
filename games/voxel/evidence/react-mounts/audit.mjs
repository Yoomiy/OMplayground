import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const archive='games/voxel/evidence/react-mounts',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const pointer=json('games/voxel/test-results/react-mounts.json'),v=json(archive+'/verification.json');assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(archive+'/sources/'+f.path)),f.sha256,f.path);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
for(const f of v.fixtureFiles){assert.equal(sha(read(archive+'/fixture'+f.path)),f.sha256);assert.equal(sha(read('apps/web/test-results/react-fixture'+f.path)),f.sha256);}
assert.equal(sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);
const prior=json(v.priorArchive+'/verification.json');assert.equal(sha(read(v.priorArchive+'/verification.json')),v.priorVerificationSha256);for(const f of prior.artifacts)assert.equal(sha(read(v.priorArchive+'/'+f.path)),f.sha256,f.path);
assert.equal(prior.buildId,v.buildId);assert.equal(prior.runtimeHash,v.runtimeHash);for(const f of prior.sourceInputs.filter(f=>f.path.startsWith('games/voxel/src/')||f.path.startsWith('apps/web/src/')))assert.equal(sha(read(f.path)),f.sha256,f.path);for(const f of prior.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const r=json(archive+'/react.json');assert.equal(r.result,'PASS');assert.equal(r.buildId,v.buildId);assert.equal(r.mouseClickAcknowledged,true);assert.deepEqual(r.errors,[]);assert.equal(r.voice.enabled,false);assert.equal(r.cleanup.length,3);for(const c of r.cleanup){assert.deepEqual(c.resources,{geometries:0,textures:0,workers:0});assert.equal(c.audio,'closed');}
assert.equal(r.rosterReceipt.left,true);assert.equal(r.rosterReceipt.ended,true);assert.equal(r.repeatedMounts.cycles,6);assert.equal(r.repeatedMounts.samples.length,6);
const first=r.repeatedMounts.samples[0];for(const [i,s]of r.repeatedMounts.samples.entries()){
 assert.equal(s.cycle,i);assert.equal(s.actorId,first.actorId);assert.equal(s.worldId,first.worldId);assert.equal(s.epoch,3+6*i);
 assert.deepEqual(s.mounted.resources,{geometries:21,textures:5,workers:1});assert.equal(s.mounted.collisionColumns,49);assert.equal(s.mounted.memory.gpuBuffers.live,57);assert.equal(s.mounted.memory.gpuBuffers.bytes,556804);assert.equal(s.mounted.memory.gpuBuffers.peakBytes,557740);assert.deepEqual(s.mounted.memory.wasm,[5636096]);
 assert.deepEqual(s.unmounted.resources,{geometries:0,textures:0,workers:0});assert.equal(s.unmounted.audio,'closed');assert.equal(s.unmounted.memory.gpuBuffers.live,0);assert.equal(s.unmounted.memory.gpuBuffers.bytes,0);assert.equal(s.unmounted.memory.gpuBuffers.created,s.unmounted.memory.gpuBuffers.deleted);
 const o=s.unmounted.owners;assert.equal(o.liveWorkers,0);assert.equal(o.createdWorkers,i+1);assert.equal(o.closedWorkers,i+1);assert.equal(o.openedSockets,i+1);assert.equal(o.closedSockets,i+1);
}assert.equal(r.repeatedMounts.samples.at(-1).unmounted.memory.gpuBuffers.created,372);
const initial=json(archive+'/initial-react.json');assert.equal(initial.result,'PASS');assert.equal(initial.repeatedMounts.samples.at(-1).unmounted.memory.gpuBuffers.peakBytes,3346440);
assert.match(read(archive+'/old-probe-failure.txt').toString(),/sequential context peaks must not be added/);
const p=json(archive+'/probe.json');assert.equal(p.result,'BROWSER_MEMORY_PROBE_KNOWN_ALLOCATION_PASS');assert.equal(p.sequentialContexts.gpuBuffers.peakBytes,64);assert.equal(p.overlappingContexts.gpuBuffers.peakBytes,80);assert.equal(p.contextsRemoved.gpuBuffers.bytes,0);
const t=json(archive+'/travel.json');assert.equal(t.buildId,v.buildId);assert.equal(t.configuration.cycles,2);assert.equal(JSON.parse(execFileSync(process.execPath,['games/voxel/tools/check-travel-memory.ts',archive+'/travel.json'],{encoding:'utf8'})).result,'BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_PASS');
const web=json(archive+'/web-inventory.json');for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
const result={result:'REACT_MOUNT_ARCHIVE_CURRENT_SOURCE_RELEASE_FIXTURE_PROBE_AND_PRIOR_IMMUTABILITY_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,releaseFiles:v.releaseFiles.length,fixtureFiles:v.fixtureFiles.length,artifacts:v.artifacts.length,webFiles:web.length,reactCycles:6,travelCycles:2,oldProbeFailurePreserved:true,unchangedRuntimeAndProductSources:true,unchangedPriorArchive:true,scope:v.scope};fs.writeFileSync('games/voxel/test-results/react-mounts-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
