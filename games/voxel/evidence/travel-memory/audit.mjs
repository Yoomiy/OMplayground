import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const archive='games/voxel/evidence/travel-memory';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const pointer=json('games/voxel/test-results/travel-memory.json'),v=json(archive+'/verification.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(archive+'/sources/'+f.path)),f.sha256,f.path);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
assert.equal(sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);
const prior=json(v.priorArchive+'/verification.json');assert.equal(sha(read(v.priorArchive+'/verification.json')),v.priorVerificationSha256);
for(const f of prior.artifacts)assert.equal(sha(read(v.priorArchive+'/'+f.path)),f.sha256,f.path);
assert.equal(prior.buildId,v.buildId);assert.equal(prior.runtimeHash,v.runtimeHash);
for(const f of prior.sourceInputs.filter(f=>f.path.startsWith('games/voxel/src/')))assert.equal(sha(read(f.path)),f.sha256,f.path);
for(const f of prior.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
for(const name of ['smoke','full']){
 const r=json(archive+'/'+name+'.json');assert.equal(r.buildId,v.buildId);
 const output=JSON.parse(execFileSync(process.execPath,['games/voxel/tools/check-travel-memory.ts',archive+'/'+name+'.json'],{encoding:'utf8'}));assert.equal(output.result,'BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_PASS');
 assert.equal(output.cycles,name==='full'?6:2);
}
const full=json(archive+'/full.json'),last=full.samples.at(-1);assert.equal(last.memory.gpuBuffers.created,1503);assert.equal(last.createdWorkers,7);assert.equal(last.closedWorkers,7);assert.equal(last.openedSockets,7);assert.equal(last.closedSockets,7);
const probe=json(archive+'/probe.json');assert.equal(probe.result,'BROWSER_MEMORY_PROBE_KNOWN_ALLOCATION_PASS');assert.equal(probe.allocated.gpuBuffers.bytes,64);assert.equal(probe.resized.gpuBuffers.bytes,28);assert.equal(probe.removed.gpuBuffers.live,0);assert.deepEqual(probe.initialWasm.wasm,[65536]);assert.deepEqual(probe.grownWasm.wasm,[131072]);
const corrupt=json(archive+'/report-corruptions.json');assert.equal(corrupt.checks.length,4);assert(corrupt.checks.every(c=>c.rejected));
const web=json(archive+'/web-inventory.json');assert.equal(web.length,v.webInventoryFiles);for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
const yaml=(await import(process.cwd()+'/node_modules/yaml/dist/index.js')).default;
const steps=yaml.parse(read('.github/workflows/voxel.yml').toString()).jobs.runtime.steps;
const step=steps.find(s=>s.run?.includes('run test:memory:browser'));assert.equal(step.env.VOXEL_MEMORY_CYCLES,'2');assert.match(step.run,/check:memory:browser/);assert(steps.some(s=>s.run==='npm --prefix games/voxel run test:memory:probe'));
const result={result:'TRAVEL_MEMORY_ARCHIVE_SOURCE_RELEASE_PROBE_REPORT_AND_PRIOR_IMMUTABILITY_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,releaseFiles:v.releaseFiles.length,artifacts:v.artifacts.length,webFiles:web.length,fullCycles:6,smokeCycles:2,unchangedRuntime:true,unchangedPriorArchive:true,scope:v.scope};
fs.writeFileSync('games/voxel/test-results/travel-memory-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
