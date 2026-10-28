import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const staging=process.argv.includes('--staging');
const archive=staging?'/tmp/voxel-shaped-tcp-archive-stage':'games/voxel/evidence/shaped-network';
const pointerPath=staging?'/tmp/voxel-shaped-tcp-stage-pointer.json':'games/voxel/test-results/shaped-network.json';
const priorArchive='games/voxel/evidence/input-backlog';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(!fs.existsSync(archive),'Never overwrite an evidence archive');
const prior=json(priorArchive+'/verification.json');
const priorVerificationSha256=sha(read(priorArchive+'/verification.json'));
assert.equal(priorVerificationSha256,'9f6df4eb4b2585be93786ddbd7d53e6fb7759248d15448601aaf3dadae3cb6e4');
for(const f of prior.artifacts)assert.equal(sha(read(priorArchive+'/'+f.path)),f.sha256,f.path);
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json');
assert.equal(build.buildId,prior.buildId);assert.equal(release.buildId,build.buildId);
const runtimeFiles=walk('games/voxel/src');
const runtimeHash=sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));
assert.equal(runtimeHash,prior.runtimeHash);assert.equal(runtimeHash,build.runtimeHash);
const changedPriorSources=prior.sourceInputs.filter(f=>sha(read(f.path))!==f.sha256).map(f=>f.path).sort();
assert.deepEqual(changedPriorSources,['.github/workflows/voxel.yml','docs/voxel-runtime-rewrite-progress.md','games/voxel/README.md','games/voxel/package.json']);
const additions=['games/voxel/tests/fixtures/tcp-shaper.ts','games/voxel/tests/tcp-shaper.test.ts','games/voxel/tools/browser-network.ts','games/voxel/docs/shaped-network.md'];
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),...additions])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.)/.test(p)));
const prefix='/tmp/voxel-shaped-tcp-';
const copies={
 'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
 'baseline-verification.json':priorArchive+'/verification.json',
 'web-inventory.json':priorArchive+'/web-inventory.json',
 'browser.json':'games/voxel/test-results/browser-network.json','browser.txt':prefix+'browser.log',
 'calibration.json':'games/voxel/test-results/tcp-shaper.json','fixture.txt':prefix+'fixture.log','fixture.exit':prefix+'fixture.exit',
 'negative/unpaced.ts':prefix+'unpaced.ts','negative/unpaced.test.ts':prefix+'unpaced.test.ts',
 'negative/unpaced.json':prefix+'unpaced.json','negative/unpaced.txt':prefix+'unpaced.log',
 'initial-strip-failure.txt':prefix+'strip-negative.log','initial-half-close-failure.txt':prefix+'half-close-negative.log',
 'README.md':'games/voxel/docs/shaped-network.md','producer.mjs':prefix+'capture.mjs','audit.mjs':prefix+'audit.mjs',
};
for(const name of ['browser','domain','types','release']){
 assert.equal(read(prefix+name+'.exit').toString().trim(),'0',name);
 copies[name+'.txt']=prefix+name+'.log';copies[name+'.exit']=prefix+name+'.exit';
}
for(const p of [...sourcePaths,...Object.values(copies)])assert(fs.statSync(p).isFile(),p);
const artifacts=[];
function copy(input,output){const bytes=read(input),target=path.join(archive,output);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);const sha256=sha(bytes);artifacts.push({path:output,sha256});return sha256;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)})),releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){
 const p='games/voxel/'+dir+'/'+f.path,sha256=copy(p,'release/'+dir+'/'+f.path);
 assert.equal(sha256,f.hash);assert.equal(sha256,prior.releaseFiles.find(r=>r.path===p).sha256);releaseFiles.push({path:p,sha256});
}
for(const [out,input]of Object.entries(copies))copy(input,out);
const scope='Unchanged production runtime/release. Local FIFO TCP byte-data shaping of all browser HTTP/assets/admission/gameplay traffic: 50/100-with-jitter/150 ms data RTT and aggregate 10 Mbps cap per direction. Actual two-stream calibration and unpaced negative control, creative movement, safe readiness, explicit reconnect and tracked teardown in fresh software-browser processes. OS handshake/congestion/retransmission/loss, physical devices/networks, SFU and richer survival/hosted/capacity/cutover gates remain.';
const v={result:'SHAPED_TCP_BUILT_BROWSER_MATRIX_AND_MODEL_VERIFIED_LOCALLY',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash,scope,priorArchive,priorVerificationSha256,changedPriorSources,changedRuntime:[],productionRuntimeChanged:false,qualified:{domain:109,shaperTests:2,browserProfiles:3,strictGameTypes:true,currentReleaseFiles:12},retainedPriorQualification:prior.qualified,retainedPriorChecksRerun:false,physicalDeviceNetworkQualified:false,sourceInputs,releaseFiles,artifacts};
const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);
const pointer={result:v.result,archive,buildId:v.buildId,verificationSha256:sha(bytes),sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,artifacts:artifacts.length,scope};
fs.writeFileSync(pointerPath,JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
