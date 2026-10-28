import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const staging = process.argv.includes('--staging');
const archive = staging ? '/tmp/voxel-input-backlog-archive-stage' : 'games/voxel/evidence/input-backlog';
const pointerPath = staging ? '/tmp/voxel-input-backlog-stage-pointer.json' : 'games/voxel/test-results/input-backlog.json';
const priorArchive = 'games/voxel/evidence/column-drain';
const dryRun = process.argv.includes('--preflight');
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(!fs.existsSync(archive), 'Never overwrite an evidence archive');
const prior = json(priorArchive+'/verification.json');
const priorVerificationSha256 = sha(read(priorArchive+'/verification.json'));
assert.equal(priorVerificationSha256, 'a61d67fbbb1db75cd49926bc885a14c98edb7d881187d52cb190c3f5d3b0d0b2');
for (const f of prior.artifacts) assert.equal(sha(read(priorArchive+'/'+f.path)), f.sha256, f.path);
const build = json('games/voxel/artifacts/build.json'), release = json('games/voxel/artifacts/release.json');
assert.equal(build.buildId, '7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc');
assert.equal(release.buildId, build.buildId);
const runtimeFiles = walk('games/voxel/src');
const hashRuntime = priorFiles => sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(priorFiles.includes(p)?priorArchive+'/sources/'+p:p)])));
assert.equal(hashRuntime([]), build.runtimeHash);
const changedPriorSources = prior.sourceInputs.filter(f=>sha(read(f.path))!==f.sha256).map(f=>f.path).sort();
const changedRuntime = changedPriorSources.filter(p=>p.startsWith('games/voxel/src/'));
assert.deepEqual(changedRuntime, ['games/voxel/src/sim/input-queue.ts']);
assert.equal(hashRuntime(changedRuntime), prior.runtimeHash);
for (const key of ['engineHash','bindingsHash','contentHash','protocol','environmentVersion','columnFormat','regionFormat','editFormat','height']) assert.equal(build[key], json(priorArchive+'/build.json')[key], key);
const additions = ['games/voxel/tools/browser-input-stalls.ts','games/voxel/docs/input-backlog.md'];
const sourcePaths = [...new Set([...prior.sourceInputs.map(f=>f.path),...additions])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.)/.test(p)));
const artifacts = [];
function copy(input, output) {
  const bytes = read(input), target = path.join(archive, output);
  if (!dryRun) { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, bytes); }
  const sha256 = sha(bytes); artifacts.push({path:output,sha256}); return sha256;
}
const sourceInputs = sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)}));
const releaseFiles = [], baselineServerFiles = [], firstCandidateReleaseFiles = [];
for (const [kind, dir] of [['client','dist-client'],['server','dist-server']]) for (const f of release[kind]) {
  const p = 'games/voxel/'+dir+'/'+f.path, sha256 = copy(p,'release/'+dir+'/'+f.path);
  assert.equal(sha256, f.hash); releaseFiles.push({path:p,sha256});
}
for (const f of json(priorArchive+'/release.json').server) {
  const p = 'dist-server/'+f.path, sha256 = copy(priorArchive+'/release/'+p,'baseline-release/'+p);
  assert.equal(sha256, f.hash); baselineServerFiles.push({path:p,sha256});
}
const firstCandidateRoot = '/tmp/voxel-input-backlog-first-release';
for (const [kind,dir] of [['client','dist-client'],['server','dist-server']])
  for (const f of json(firstCandidateRoot+'/artifacts/release.json')[kind]) {
    const p=dir+'/'+f.path, sha256=copy(firstCandidateRoot+'/'+p,'first-candidate/release/'+p);
    assert.equal(sha256,f.hash); firstCandidateReleaseFiles.push({path:p,sha256});
  }
const react = json('apps/web/test-results/voxel-react.json');
const fixtureFiles = react.clientArtifacts.map(f=>{
  const sha256 = copy('apps/web/test-results/react-fixture'+f.path,'react-fixture'+f.path);
  assert.equal(sha256,f.sha256); return {path:f.path,sha256};
});
const prefix = '/tmp/voxel-input-backlog-';
const copies = {
  'build.json':'games/voxel/artifacts/build.json', 'release.json':'games/voxel/artifacts/release.json',
  'negative/browser.json':prefix+'browser-negative.json', 'negative/browser.txt':prefix+'browser-negative.log',
  'negative/browser-tool.ts':prefix+'negative-tool.ts', 'negative/tcp-gate.ts':prefix+'negative-gate.ts',
  'negative/unit.txt':prefix+'unit-negative.log', 'negative/wasm.txt':prefix+'wasm-negative.log',
  'negative/authority.test.ts':prefix+'old-authority.test.ts',
  'negative/wasm-test.ts':prefix+'old-wasm.test.ts', 'negative/input-queue.ts':prefix+'before.ts',
  'initial-weak-browser.json':'/tmp/voxel-input-stalls-initial-weak.json',
  'initial-weak-browser.txt':'/tmp/voxel-input-stalls-initial-weak.log',
  'observer-failure.json':prefix+'observer-failure.json', 'observer-failure.txt':prefix+'observer-failure.log',
  'observer-tool.ts':prefix+'observer-tool.ts',
  'core.txt':prefix+'core.log', 'core.exit':prefix+'core.exit', 'focused.txt':prefix+'jitter-focused.log',
  'first-candidate/initial-focused.txt':prefix+'focused.log',
  'browser.json':'games/voxel/test-results/browser-input-stalls.json', 'browser.txt':prefix+'browser.log',
  'edited-browser.json':'games/voxel/test-results/browser-edited-join.json', 'edited-browser.txt':prefix+'edited-browser.log',
  'source-columns.json':'games/voxel/test-results/column-drain-source.json',
  'packaged-columns.json':'games/voxel/test-results/column-drain-packaged.json',
  'react.json':'apps/web/test-results/voxel-react.json', 'react.txt':prefix+'react-browser.log',
  'presentation.json':'games/voxel/test-results/browser-presentation.json', 'presentation.txt':prefix+'presentation.log',
  'sockets.json':'games/voxel/test-results/survival-sockets.json', 'sockets.txt':prefix+'sockets.log',
  'initial-sockets.json':prefix+'sockets-initial.json', 'initial-sockets.txt':prefix+'sockets-initial.log',
  'first-candidate/sockets.json':prefix+'sockets-final.json',
  'first-candidate/sockets.txt':prefix+'sockets-first-isolated.log',
  'first-candidate/baseline-comparison.json':prefix+'sockets-baseline.json',
  'first-candidate/baseline-comparison.txt':prefix+'sockets-baseline.log',
  'first-candidate/current-comparison.json':prefix+'sockets-comparison.json',
  'first-candidate/current-comparison.txt':prefix+'sockets-comparison.log',
  'first-candidate/setup-failure.txt':prefix+'baseline-setup-failure.log',
  'first-candidate/jitter-negative.txt':prefix+'jitter-negative.log',
  'first-candidate/jitter-negative-test.ts':prefix+'jitter-negative.test.ts',
  'first-candidate/derived-queue.ts':prefix+'first-queue.ts',
  'first-candidate/input-queue.ts':firstCandidateRoot+'/input-queue.ts',
  'first-candidate/authority.test.ts':firstCandidateRoot+'/authority.test.ts',
  'first-candidate/browser-tool.ts':firstCandidateRoot+'/browser-input-stalls.ts',
  'first-candidate/browser.json':firstCandidateRoot+'/browser-input-stalls.json',
  'first-candidate/browser.txt':firstCandidateRoot+'/browser.log',
  'first-candidate/core.txt':firstCandidateRoot+'/core.log',
  'first-candidate/build.json':firstCandidateRoot+'/artifacts/build.json',
  'first-candidate/release.json':firstCandidateRoot+'/artifacts/release.json',
  'jitter-focused.txt':prefix+'jitter-focused.log',
  'refined-diagnostic.json':prefix+'sockets-refined-diagnostic.json',
  'refined-diagnostic.txt':prefix+'sockets-refined-diagnostic.log',
  'survival.json':'games/voxel/test-results/survival-workers.json', 'survival.txt':prefix+'survival.log',
  'survival-audit.txt':prefix+'survival-audit.log',
  'survival-observation.json':prefix+'survival-observation.json',
  'startup.json':prefix+'startup.json', 'startup.txt':prefix+'startup.log', 'startup.mjs':'/tmp/voxel-snapshot-startup.mjs',
  'postgres-stop.txt':prefix+'postgres-stop.log',
  'producer.mjs':prefix+'capture.mjs', 'audit.mjs':prefix+'audit.mjs',
  'qualification.zsh':prefix+'qualify.zsh', 'qualification-progress.txt':prefix+'qualification-progress.log',
  'README.md':'games/voxel/docs/input-backlog.md',
};
for (const name of ['types','service-types','web-types','service-tests','web-tests','web-build','release-verify']) copies[name+'.txt'] = prefix+name+'.log';
for (const name of ['browser','edited-browser','types','service-types','web-types','service-tests','web-tests','web-build','startup','react-browser','presentation','sockets','survival-audit','release-verify']) {
  assert.equal(read(prefix+name+'.exit').toString().trim(),'0',name);
  copies['exits/'+name+'.exit'] = prefix+name+'.exit';
}
const survivalObservation=json(prefix+'survival-observation.json');
assert.equal(survivalObservation.result,'SURVIVAL_TERMINAL_REPORT_AND_INDEPENDENT_AUDIT_PASS');
assert.equal(survivalObservation.buildId,build.buildId);
assert.equal(survivalObservation.reportSha256,sha(read('games/voxel/test-results/survival-workers.json')));
assert.equal(survivalObservation.originalShellExitStatus,null);
assert.equal(survivalObservation.benchmarkRerun,false);
for (const [out,input] of Object.entries(copies)) copy(input,out);
const web = walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))}));
const bytes = JSON.stringify(web,null,2)+'\n'; if (!dryRun) fs.writeFileSync(archive+'/web-inventory.json',bytes); artifacts.push({path:'web-inventory.json',sha256:sha(bytes)});
const scope = 'Clear persistent server input latency after real inbound TCP suspension without extra movement time or stale transient presses. Actual built client/packaged workers, one/five-second inbound and outbound read holds, full local React/SQL journey and six mounts, six loopback movement layouts, sustained 2x8 survival/autosave/crash recovery. No hosted application writes or deployment; physical device/network, hosted/classroom, product and cutover gates remain.';
const v = {result:'INPUT_BACKLOG_FIXED_AND_MATCHED_RELEASE_QUALIFIED_LOCALLY',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash:build.runtimeHash,scope,priorArchive,priorVerificationSha256,baselineBuildId:prior.buildId,changedPriorSources,changedRuntime,reconstructedPriorRuntimeHash:hashRuntime(changedRuntime),qualified:{domain:107,native:80,nativeIgnored:3,wasm:92,sourceIntegration:45,packagedIntegration:45,service:50,web:180,tcpHoldDurationsMs:[1000,5000],socketProfiles:6,survivalSeconds:180,reactMountCycles:6,statusRpcs:8},sourceInputs,releaseFiles,baselineServerFiles,firstCandidateReleaseFiles,fixtureFiles,webInventoryFiles:web.length,artifacts};
const verification = JSON.stringify(v,null,2)+'\n'; if (!dryRun) fs.writeFileSync(archive+'/verification.json',verification);
const pointer = {result:v.result,archive,buildId:v.buildId,verificationSha256:sha(verification),sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,baselineServerFiles:baselineServerFiles.length,fixtureFiles:fixtureFiles.length,artifacts:artifacts.length,scope};
if (!dryRun) fs.writeFileSync(pointerPath,JSON.stringify(pointer,null,2)+'\n'); console.log(JSON.stringify({...pointer,preflight:dryRun}));
