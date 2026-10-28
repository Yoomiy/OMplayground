import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),destination='games/voxel/evidence/snapshot-scaling';
assert(!fs.existsSync(destination),'Never overwrite an evidence archive');
const read=p=>fs.readFileSync(path.resolve(root,p)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json'),comparison=json('games/voxel/test-results/survival-benchmark.json'),sockets=json('games/voxel/test-results/survival-sockets.json'),browser=json('games/voxel/test-results/browser-presentation.json'),startup=json('/tmp/voxel-snapshot-startup.json');
const earlier='/tmp/voxel-snapshot-pre-pressure',oldBuild=json(earlier+'/build.json'),oldRelease=json(earlier+'/release.json');
assert.equal(comparison.result,'WIRE_EQUIVALENT_SURVIVAL_COMPARISON_PASS');assert.equal(comparison.results.length,48);assert.equal(comparison.buildId,oldBuild.buildId);
for(const r of [release,sockets,browser,startup])assert.equal(r.buildId,build.buildId);
assert.equal(sockets.result,'LOOPBACK_SURVIVAL_LOAD_COMPLETED');assert.equal(sockets.profiles.length,6);
for(const p of sockets.profiles){assert.equal(p.resyncs,0);assert.equal(p.cleanup.rooms,0);assert.equal(p.cleanup.closedClients,p.totalPlayers);assert(p.ackMs.samples>0);assert(p.roomMetrics.length>=p.rooms);assert(p.roomMetrics.every(m=>m.overrunMs===0));}
for(const p of comparison.profiles)for(const scene of ['dense-motion','craft-drops-tnt'])for(let repeat=0;repeat<3;repeat++){
  const pair=comparison.results.filter(r=>r.players===p&&r.scene===scene&&r.repeat===repeat);assert.equal(pair.length,2);assert.notEqual(pair[0].optimized,pair[1].optimized);assert.equal(pair[0].transcriptSha256,pair[1].transcriptSha256);assert.equal(pair[0].wireBytes,pair[1].wireBytes);assert.equal(pair[0].messages,pair[1].messages);
}
assert.equal(sha(read('games/voxel/src/sim/game-room.ts')),comparison.sourceSha256.current);
assert.equal(sha(read('games/voxel/src/server/snapshot-encoder.ts')),comparison.sourceSha256.encoder);
assert.equal(comparison.engineHash,build.engineHash);assert.equal(comparison.contentHash,build.contentHash);
const walk=dir=>fs.readdirSync(path.resolve(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const runtimeBefore=sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),p==='games/voxel/src/server/gateway.ts'?read(earlier+'/gateway-before.ts'):read(p)])));
assert.equal(runtimeBefore,oldBuild.runtimeHash,'the gateway is the only runtime change after the comparison');
assert.equal(browser.result,'PASS');assert.deepEqual(browser.errors,[]);assert.equal(browser.cleanup.length,2);
for(const c of browser.cleanup){for(const k of ['geometries','textures','workers'])assert.equal(c[k],0);assert.equal(c.audio.state,'closed');assert.equal(c.audio.contexts,0);}
assert.equal(startup.statusRpcs.length,8);assert.equal(startup.rooms,0);assert.equal(startup.health,200);assert.equal(startup.ready,200);assert.equal(startup.remoteApplicationWrites,false);
assert.equal(read('/tmp/voxel-snapshot-final-core.exit').toString().trim(),'0');
const core=read('/tmp/voxel-snapshot-final-core.log').toString();
assert.match(core,/ℹ pass 94\n/);assert.match(core,/ℹ pass 86\n/);assert.equal((core.match(/ℹ pass 43\n/g)||[]).length,2);assert.match(core,/80 passed; 0 failed; 3 ignored/);
assert.match(read('/tmp/voxel-snapshot-service-tests.log').toString(),/pass 50/);assert.match(read('/tmp/voxel-snapshot-web-tests.log').toString(),/180 passed/);assert.match(read('/tmp/voxel-snapshot-web-build.log').toString(),/built in/);
for(const name of ['service-types','web-types'])assert.equal(read('/tmp/voxel-snapshot-'+name+'.log').length,0);
assert.match(read('/tmp/voxel-snapshot-pressure-before.log').toString(),/socket event timeout/);assert.match(read('/tmp/voxel-snapshot-hard-pressure-before.log').toString(),/ABORT_ERR/);assert.match(read('/tmp/voxel-snapshot-pressure-after.log').toString(),/pass 2/);
const priorPath='games/voxel/evidence/held-bucket/verification.json',prior=json(priorPath);
assert.equal(sha(read(priorPath)),'ba8ebc37f85b351300a7e0a83e4f82ebcd17e34f9942fdb75feec1d084bccd80');
const additions=['games/voxel/src/server/snapshot-encoder.ts','games/voxel/tools/benchmark-survival.ts','games/voxel/tools/benchmark-sockets.mjs','games/voxel/tests/snapshot-encoder.test.ts','games/voxel/tests/wasm/snapshot-sharing.test.ts','games/voxel/tests/integration/backpressure.test.ts','games/voxel/docs/server-scaling.md'];
const hostedInputs=json('apps/voxel-server/test-results/hosted-school-preflight/verification.json').inputs.map(f=>f.path);
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),...prior.additionalSources.map(f=>f.path),...additions,...hostedInputs])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.local$)/.test(p)));
const artifacts=[];
function copy(input,output){const bytes=read(input),p=path.join(destination,output);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);const h=sha(bytes);artifacts.push({path:output,sha256:h});return h;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)}));
const releaseFiles=[],comparisonReleaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']]){
  for(const f of release[kind]){const p='games/voxel/'+dir+'/'+f.path,h=copy(p,'release/'+dir+'/'+f.path);assert.equal(h,f.hash);releaseFiles.push({path:p,sha256:h});}
  for(const f of oldRelease[kind]){const h=copy(earlier+'/'+dir+'/'+f.path,'comparison-release/'+dir+'/'+f.path);assert.equal(h,f.hash);comparisonReleaseFiles.push({path:dir+'/'+f.path,sha256:h});}
}
const copies={
 'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json','core.txt':'/tmp/voxel-snapshot-final-core.log','core.exit':'/tmp/voxel-snapshot-final-core.exit',
 'comparison/build.json':earlier+'/build.json','comparison/release.json':earlier+'/release.json','comparison/benchmark.json':'games/voxel/test-results/survival-benchmark.json','comparison/benchmark.txt':'/tmp/voxel-survival-comparison.log','comparison/gateway-before.ts':earlier+'/gateway-before.ts',
 'sockets.json':'games/voxel/test-results/survival-sockets.json','sockets.txt':'/tmp/voxel-snapshot-final-sockets.log','browser.json':'games/voxel/test-results/browser-presentation.json','browser.txt':'/tmp/voxel-snapshot-final-browser.log',
 'service.txt':'/tmp/voxel-snapshot-service-tests.log','service-types.txt':'/tmp/voxel-snapshot-service-types.log','web-types.txt':'/tmp/voxel-snapshot-web-types.log','web-tests.txt':'/tmp/voxel-snapshot-web-tests.log','web-build.txt':'/tmp/voxel-snapshot-web-build.log','release-verify.txt':'/tmp/voxel-snapshot-release-verify.log',
 'startup.json':'/tmp/voxel-snapshot-startup.json','startup.mjs':'/tmp/voxel-snapshot-startup.mjs','startup.txt':'/tmp/voxel-snapshot-startup.log','focused.txt':'/tmp/voxel-snapshot-focused.log','pressure-after.txt':'/tmp/voxel-snapshot-pressure-after.log',
 'negative/pressure-before.txt':'/tmp/voxel-snapshot-pressure-before.log','negative/hard-pressure-before.txt':'/tmp/voxel-snapshot-hard-pressure-before.log','negative/pressure-setup.txt':'/tmp/voxel-snapshot-pressure-setup-negative.log',
 'history/sockets-original.mjs':'/tmp/voxel-survival-sockets.mjs','history/sockets-original.json':'/tmp/voxel-survival-sockets.json','history/sockets-original.txt':'/tmp/voxel-survival-sockets.log',
 'history/sockets-before-pressure.json':earlier+'/sockets.json','history/sockets-before-pressure.txt':'/tmp/voxel-survival-sockets-final.log','history/comparison-smoke.json':'/tmp/voxel-survival-comparison-smoke.json','history/comparison-smoke.txt':'/tmp/voxel-survival-comparison-smoke.log',
 'diagnostic/encoded.mjs':'/tmp/voxel-survival-probe.mjs','diagnostic/encoded.json':'/tmp/voxel-survival-probe.json','diagnostic/encoded.txt':'/tmp/voxel-survival-probe.log','diagnostic/no-encoding.mjs':'/tmp/voxel-survival-probe-no-encoding.mjs','diagnostic/no-encoding.json':'/tmp/voxel-survival-probe-no-encoding.json','diagnostic/no-encoding.txt':'/tmp/voxel-survival-probe-no-encoding.log',
 'producer.mjs':'/tmp/voxel-snapshot-capture.mjs'
};
for(const [output,input]of Object.entries(copies))copy(input,output);
const webInventory=walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))}));
const webBytes=JSON.stringify(webInventory,null,2)+'\n';fs.writeFileSync(path.join(destination,'web-inventory.json'),webBytes);artifacts.push({path:'web-inventory.json',sha256:sha(webBytes)});
const scope='Snapshot computation/JSON reuse plus ordered-delta backpressure correction; direct source comparison with explicit original build, final packaged loopback workers/sockets and software peer browser. Fixture identities and activity; no hosted Auth/SQL/Storage writes, physical network/device qualification, SFU recomposition, deployment or standalone web bundle.';
const note=`# Snapshot scaling and backpressure qualification

${scope}

Final matched release: ${build.buildId}. Its full core gate passes 94 domain,
80 native Rust (3 ignored), 86 Wasm and 43 source plus 43 packaged integration
cases. All 50 service and 180 web tests, strict types, production web build,
release verification and eight-read-only-status/zero-room startup pass.

The comparative direct survival run remains build ${comparison.buildId}.
Its 24 alternating pairs/48 runs have identical recipient-ordered message hashes,
wire bytes and counts. Three-repeat median p95 at 128 actors improves from
31.44 to 14.10 ms for dense motion and 48.79 to 35.25 ms for equipped
crafting/drops/TNT. The latter still misses proposed timing targets, as does
64-actor activity. This is synthetic-time compute/input/encoding, not final
capacity signoff. Both old and final published release bytes are copied.

The measured room/encoder/engine/content hashes match the final release. A full
runtime reconstruction using the saved old gateway reproduces the comparison
build's runtime hash, establishing that only gateway code changed afterward.
The original comparison identity is preserved rather than relabeled.

The final packaged loopback profiles 1×16, 1×32, 1×64, 1×128, 2×32 and 4×16
complete near 30 Hz with no resync or reported dropped simulation time. All
clients and rooms close. These ten-second co-located samples include client-loop
cost and timer-phase effects; the 128-player input-ack p99 is about 156 ms and
its driver misses one batch. They do not establish school-network latency or
limits on admissible participants/rooms. The actual two-client browser checks
peer presentation, origin shifts, held shapes and zero-resource/audio teardown.

Original pressure regressions are retained: the slow viewer loses a final yaw
delta at the old 64 KB drop branch, and snapshot-only pressure bypasses the
existing hard budget. Initial unsupported-query setup and the earlier hard-case
logging-only failure are also retained, distinct from the refined timeout proof.
Both final cases pass in source and packaged gateways: preserve ordered deltas
within the existing 1 MB budget, otherwise emit a bounded recovery event and
close only that peer for fresh admission. Pressure is injected deterministically;
physical TCP stalls remain a separate gate. No admission headcount caps.

Current sources, exact releases, logs and benchmark drivers are copied. The
production web inventory is hashed rather than copied. Earlier immutable
archives remain unchanged. Remaining work includes richer sustained worker/IO
loads, production timing distributions, device/network/memory qualification,
actual school Auth/recovery and classroom rollout, product ratification and
cutover/legacy removal. Hosted-write approval remains pending after automatic
approval review rejected the separate temporary Auth/database/Storage run.
`;
fs.writeFileSync(path.join(destination,'README.md'),note);artifacts.push({path:'README.md',sha256:sha(note)});
const verification={result:'SNAPSHOT_REUSE_AND_PRESSURE_CORRECTION_PASS',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash:build.runtimeHash,scope,qualified:{domain:94,native:80,nativeIgnored:3,wasm:86,sourceIntegration:43,packagedIntegration:43,service:50,web:180,socketProfiles:6,browserClients:2,statusRpcs:8},comparison:{buildId:comparison.buildId,runtimeHash:oldBuild.runtimeHash,sourceMatchesCurrent:true,runtimeReconstructionSha256:runtimeBefore,runs:48,wireEquivalentPairs:24},priorArchive:'games/voxel/evidence/held-bucket',priorVerificationSha256:sha(read(priorPath)),baselineArchive:'games/voxel/evidence/media-composition',baselineVerificationSha256:sha(read('games/voxel/evidence/media-composition/verification.json')),sourceInputs,releaseFiles,comparisonReleaseFiles,webInventoryFiles:webInventory.length,artifacts};
const bytes=JSON.stringify(verification,null,2)+'\n';fs.writeFileSync(path.join(destination,'verification.json'),bytes);
const pointer={result:verification.result,buildId:build.buildId,archive:destination,verificationSha256:sha(bytes),sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,comparisonReleaseFiles:comparisonReleaseFiles.length,artifacts:artifacts.length,scope};
fs.writeFileSync('games/voxel/test-results/snapshot-scaling.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
