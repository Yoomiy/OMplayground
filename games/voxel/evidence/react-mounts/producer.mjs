import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const archive='games/voxel/evidence/react-mounts',priorDir='games/voxel/evidence/travel-memory';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(!fs.existsSync(archive),'Never overwrite an archive');
const prior=json(priorDir+'/verification.json');assert.equal(sha(read(priorDir+'/verification.json')),'407936d3488122e96f2ad8f3c71f8c7296fef8b119452f58cc104c8007334def');
for(const f of prior.artifacts)assert.equal(sha(read(priorDir+'/'+f.path)),f.sha256,f.path);
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json');assert.equal(build.buildId,prior.buildId);assert.equal(release.buildId,build.buildId);
const runtimeHash=sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));assert.equal(runtimeHash,prior.runtimeHash);
const changedPriorSources=prior.sourceInputs.filter(f=>sha(read(f.path))!==f.sha256).map(f=>f.path).sort();
assert.deepEqual(changedPriorSources,['apps/web/tools/voxel-react-browser.ts','docs/voxel-runtime-rewrite-progress.md','games/voxel/README.md','games/voxel/tools/browser-memory-probe.ts','games/voxel/tools/check-browser-memory-probe.ts']);
const final=json('/tmp/voxel-react-mount-final-pass.json'),initial=json('/tmp/voxel-react-mount-initial-pass.json'),probe=json('/tmp/voxel-react-mount-final-probe.json'),travel=json('/tmp/voxel-react-mount-travel-pass.json');
for(const r of [final,initial]){assert.equal(r.result,'PASS');assert.equal(r.buildId,build.buildId);assert.deepEqual(r.errors,[]);assert.equal(r.repeatedMounts.cycles,6);}
assert.equal(travel.buildId,build.buildId);assert.equal(travel.configuration.cycles,2);
assert.equal(probe.sequentialContexts.gpuBuffers.peakBytes,64);assert.equal(probe.overlappingContexts.gpuBuffers.peakBytes,80);
assert.match(read('/tmp/voxel-react-mount-probe-negative.log').toString(),/sequential context peaks must not be added/);
assert.equal(read('/tmp/voxel-react-mount-game-types.log').length,0);assert.equal(read('/tmp/voxel-react-mount-web-types.log').length,0);
assert.match(read('/tmp/voxel-react-mount-travel-audit.log').toString(),/BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_PASS/);
assert.match(read('/tmp/voxel-react-mount-release-verify.log').toString(),/Verified current source\/content and 12 release files/);
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),'games/voxel/tools/surface-mount-cycles.ts','games/voxel/docs/react-mounts.md'])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.)/.test(p)));
const artifacts=[];function copy(input,output){const b=read(input),p=path.join(archive,output);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);const h=sha(b);artifacts.push({path:output,sha256:h});return h;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)})),releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){const p='games/voxel/'+dir+'/'+f.path,h=copy(p,'release/'+dir+'/'+f.path);assert.equal(h,f.hash);releaseFiles.push({path:p,sha256:h});}
const fixtureFiles=final.clientArtifacts.map(f=>{const h=copy('apps/web/test-results/react-fixture'+f.path,'fixture'+f.path);assert.equal(h,f.sha256);return{path:f.path,sha256:h};});
for(const [out,input]of Object.entries({
 'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
 'react.json':'/tmp/voxel-react-mount-final-pass.json','react.txt':'/tmp/voxel-react-mount-final-pass.log',
 'initial-react.json':'/tmp/voxel-react-mount-initial-pass.json','initial-react.txt':'/tmp/voxel-react-mount-initial-pass.log',
 'probe.json':'/tmp/voxel-react-mount-final-probe.json','probe.txt':'/tmp/voxel-react-mount-probe.log',
 'old-probe-failure.txt':'/tmp/voxel-react-mount-probe-negative.log','old-probe-check.ts':'/tmp/voxel-react-mount-old-probe-check.ts',
 'travel.json':'/tmp/voxel-react-mount-travel-pass.json','travel.txt':'/tmp/voxel-react-mount-travel-regression.log','travel-audit.txt':'/tmp/voxel-react-mount-travel-audit.log',
 'game-types.txt':'/tmp/voxel-react-mount-game-types.log','web-types.txt':'/tmp/voxel-react-mount-web-types.log',
 'release-verify.txt':'/tmp/voxel-react-mount-release-verify.log','boundaries.txt':'/tmp/voxel-react-mount-boundaries.log',
 'producer.mjs':'/tmp/voxel-react-mount-capture.mjs','audit.mjs':'/tmp/voxel-react-mount-audit.mjs',
}))copy(input,out);
const web=json(priorDir+'/web-inventory.json');for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);copy(priorDir+'/web-inventory.json','web-inventory.json');
const scope='Tooling/CI increment: actual StrictMode VoxelSurface exit/re-entry in one page, six cycles in the complete local SDK/SQL browser journey; fixture Auth/PostgREST/Storage, live media disabled. Concurrent GL peak-accounting correction with failing-old/passing-new browser regression and standalone two-cycle travel rerun. No runtime/release/migration changes or hosted writes/deployment; no full-shell/physical hardware/general heap/SFU composition qualification.';
const note=`# Repeated actual React surface mounts\n\n${scope}\n\nMatched release: ${build.buildId}.\n\n[Final React report](react.json): PASS, empty errors, acknowledged desktop mouse\nflow, existing save-retry/chat/moderation/teacher/end/roster checks and all three\nclients cleaned up. Six mobile surface mounts repeat the same world/actor under\nepochs 3/9/15/21/27/33, each with 49 collision columns, 21 geometries, five textures,\none worker, 57 GL buffers and 556,804 live bytes. Each unmount reaches zero owned\nbuffers/bytes/workers/sockets/controls and closed game audio. All 372 buffers and\nsix actual workers/sockets close. Main Wasm high-water is fixed at 5,636,096 bytes.\n\nThe [initial run](initial-react.json) passed ownership checks but used the old\nprobe's sum of historical per-context peaks. Its final 3,346,440-byte peak is not\nconcurrent allocation. The old probe fails the new cross-context regression; the\ncorrected probe gives 64 bytes for sequential 64/32-byte contexts and 80 bytes\nfor overlapping 48/32-byte contexts. Final actual mounts retain a stable\n557,740-byte concurrent peak. Only final fixture assets are copied; the initial\nfixture bundle is not reconstructed or relabeled.\n\nThe corrected standalone two-cycle travel regression and independent checker pass\nwith unchanged settled buffer counts/bytes and 599 buffers plus three workers/\nsockets fully released. Strict game/web types, boundaries and current source/\nrelease verification pass. Runtime and web product sources and release bytes\nmatch prior qualification; earlier broad core/unit/build checks were not rerun.\n\nSources, matching game release, final fixture assets, raw reports/logs and the\nold-probe failure are copied. The unchanged production web build is inventoried,\nnot copied as a deployment bundle. Prior archives remain immutable; their one-\nallocating-context measurements are unaffected by the peak accounting correction.\nLocal SQL test database/gateway close and the cluster is stopped. Full hosted\njourneys, real SFU composition with repeated mounts, full-shell navigation, longer/\nricher memory/capacity work, physical devices/networks, product decisions and\ncutover/legacy retirement remain. Rejected hosted-write run still awaits approval.\n`;
fs.writeFileSync(archive+'/README.md',note);artifacts.push({path:'README.md',sha256:sha(note)});
const v={result:'REACT_SURFACE_REPEAT_LIFECYCLE_AND_CONCURRENT_BUFFER_PROBE_QUALIFIED_LOCALLY',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash,scope,priorArchive:priorDir,priorVerificationSha256:sha(read(priorDir+'/verification.json')),changedPriorSources,
 qualified:{reactCycles:6,cleanupClients:3,createdDeletedBuffers:372,closedWorkers:6,closedSockets:6,travelCycles:2,oldProbeRegressionReproduced:true},sourceInputs,releaseFiles,fixtureFiles,webInventoryFiles:web.length,artifacts};
const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);
const pointer={result:v.result,archive,verificationSha256:sha(bytes),buildId:v.buildId,sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,fixtureFiles:fixtureFiles.length,artifacts:artifacts.length,scope};
fs.writeFileSync('games/voxel/test-results/react-mounts.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
