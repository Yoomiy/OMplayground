import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const archive='games/voxel/evidence/travel-memory',priorDir='games/voxel/evidence/sustained-survival';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(!fs.existsSync(archive),'Never overwrite an archive');
const prior=json(priorDir+'/verification.json');assert.equal(sha(read(priorDir+'/verification.json')),'60413f5aa5854e1f8bcf7ea0fe891247ef6c8d8fde65ba6e889b52632b7c4dd3');
for(const f of prior.artifacts)assert.equal(sha(read(priorDir+'/'+f.path)),f.sha256,f.path);
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json');
assert.equal(build.buildId,prior.buildId);assert.equal(release.buildId,build.buildId);
const runtimeHash=sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));assert.equal(runtimeHash,prior.runtimeHash);
const changedPriorSources=prior.sourceInputs.filter(f=>sha(read(f.path))!==f.sha256).map(f=>f.path).sort();
assert.deepEqual(changedPriorSources,['.github/workflows/voxel.yml','docs/voxel-runtime-rewrite-progress.md','games/voxel/README.md','games/voxel/package.json']);
assert.equal(read('/tmp/voxel-travel-memory-types.log').length,0);
assert.match(read('/tmp/voxel-travel-memory-release-verify.log').toString(),/Verified current source\/content and 12 release files/);
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),
  'games/voxel/tools/browser-memory-probe.ts','games/voxel/tools/browser-travel-memory.ts',
  'games/voxel/tools/check-browser-memory-probe.ts','games/voxel/tools/check-travel-memory.ts','games/voxel/docs/travel-memory.md'])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.)/.test(p)));
const artifacts=[];function copy(input,output){const b=read(input),p=path.join(archive,output);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);const h=sha(b);artifacts.push({path:output,sha256:h});return h;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)})),releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){const p='games/voxel/'+dir+'/'+f.path,h=copy(p,'release/'+dir+'/'+f.path);assert.equal(h,f.hash);releaseFiles.push({path:p,sha256:h});}
for(const name of ['smoke','full']){
  const r=json('/tmp/voxel-travel-memory-'+name+'-pass.json');assert.equal(r.buildId,build.buildId);assert.equal(r.result,'BROWSER_TRAVEL_RECONNECT_RESOURCE_MEASUREMENTS_COMPLETE');
  assert.match(read('/tmp/voxel-travel-memory-'+name+'-audit.log').toString(),/BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_PASS/);
  for(const [out,input]of [[name+'.json','/tmp/voxel-travel-memory-'+name+'-pass.json'],[name+'.txt','/tmp/voxel-travel-memory-'+name+'-pass.log'],[name+'-audit.txt','/tmp/voxel-travel-memory-'+name+'-audit.log']])copy(input,out);
}
const full=json('/tmp/voxel-travel-memory-full-pass.json');assert.equal(full.configuration.cycles,6);assert.equal(full.samples.length,14);assert.equal(full.samples.at(-1).memory.gpuBuffers.created,1503);
assert.equal(json('games/voxel/test-results/browser-memory-probe.json').result,'BROWSER_MEMORY_PROBE_KNOWN_ALLOCATION_PASS');
for(const [out,input]of Object.entries({
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
  'probe.json':'games/voxel/test-results/browser-memory-probe.json','probe.txt':'/tmp/voxel-travel-memory-probe.log',
  'types.txt':'/tmp/voxel-travel-memory-types.log','release-verify.txt':'/tmp/voxel-travel-memory-release-verify.log',
  'initial-under-rendered.json':'/tmp/voxel-travel-memory-unrendered.json','initial-under-rendered.txt':'/tmp/voxel-travel-memory-unrendered.log',
  'initial-types-negative.txt':'/tmp/voxel-travel-memory-types-negative.log','report-corruptions.json':'/tmp/voxel-travel-memory-report-negatives.json',
  'producer.mjs':'/tmp/voxel-travel-memory-capture.mjs','audit.mjs':'/tmp/voxel-travel-memory-audit.mjs',
}))copy(input,out);
const web=json(priorDir+'/web-inventory.json');for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);copy(priorDir+'/web-inventory.json','web-inventory.json');
const scope='Tooling/CI only; six settled creative-flight/reconnect cycles in software Chromium. Exact GL-owned-buffer/resource/column plateaus, main Wasm high-water and actual worker/socket teardown. Forced-GC main-isolate heap observations are not a heap-leak verdict; excludes physical GPU residency, worker/live-allocator/whole-process budgets, school device/network/capacity or hosted service qualification. Runtime/release unchanged; prior full qualification reused, not rerun.';
const note=`# Browser travel/reconnect owned resources\n\n${scope}\n\nRelease: ${build.buildId}.\n\nThe [full report](full.json) records six cycles and fourteen settled samples over\n176.37 seconds. Each travel/reconnect pair has 49 collision columns, 34/25 mesh\ncolumns, 72/61 geometries, five textures, 163/141 tracked GL buffers and\n2,429,812/1,843,268 buffer bytes. Main Wasm grows once to 6,094,848 bytes then\nstays fixed. Final teardown deletes all 1,503 buffers and closes all seven actual\nworkers/sockets, with zero remaining rooms. No browser errors.\n\nThe [two-cycle smoke](smoke.json), [known-allocation probe](probe.json), strict\ntypes and unchanged release verification pass. Independent report checks require\nactual drawn terrain/new uploads, exact per-phase ownership plateaus, new epochs\nand complete teardown. Four corrupted ownership/rendering reports are rejected.\nThe initial under-rendered measurement and type failure are kept separately.\n\nPost-GC reconnect heap ranges from 6,244,924 to 6,592,092 bytes with slowing\ngrowth; this is not asserted to prove heap plateau or causation. Final heap is\n5,661,628 bytes. Main Wasm reservation remains cached after freeing the world.\nGL buffer bytes are requested live ownership, not physical VRAM accounting.\n\nSources and matching game release bytes are copied. The unchanged production web\nbundle is inventoried, not copied as a deployable artifact. Prior archives remain\nimmutable. No runtime/migration changes, hosted writes or deployment. Full hosted\njourneys, physical devices/networks, longer/richer scenes, repeated app mounts,\nworker/live-allocator/whole-process memory, product decisions and cutover/legacy\nretirement remain. The separately rejected hosted-write test awaits approval.\n`;
fs.writeFileSync(archive+'/README.md',note);artifacts.push({path:'README.md',sha256:sha(note)});
const v={result:'BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_QUALIFIED_LOCALLY',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash,scope,
  priorArchive:priorDir,priorVerificationSha256:sha(read(priorDir+'/verification.json')),changedPriorSources,
  qualified:{smokeCycles:2,fullCycles:6,samples:14,createdDeletedBuffers:1503,closedWorkers:7,closedSockets:7},
  sourceInputs,releaseFiles,webInventoryFiles:web.length,artifacts};
const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);
const pointer={result:v.result,archive,verificationSha256:sha(bytes),buildId:v.buildId,sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,artifacts:artifacts.length,scope};
fs.writeFileSync('games/voxel/test-results/travel-memory.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
