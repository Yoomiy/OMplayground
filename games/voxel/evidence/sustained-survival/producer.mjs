import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const destination='games/voxel/evidence/sustained-survival';
const priorDir='games/voxel/evidence/visibility-reuse';
const read=p=>fs.readFileSync(p), json=p=>JSON.parse(read(p)), sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
assert(!fs.existsSync(destination),'Never overwrite an evidence archive');
const prior=json(priorDir+'/verification.json');
assert.equal(sha(read(priorDir+'/verification.json')),'3d77ddf5aead00ee210cc9ff6c64b9611fc0adc4c6ff9e0bb8475251a2b948d5');
for(const f of prior.artifacts)assert.equal(sha(read(priorDir+'/'+f.path)),f.sha256,f.path);
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json');
assert.equal(build.buildId,prior.buildId);assert.equal(release.buildId,build.buildId);
const runtimeHash=sha(Buffer.concat(walk('games/voxel/src').flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));
assert.equal(runtimeHash,prior.runtimeHash);assert.equal(build.runtimeHash,runtimeHash);
const changedPriorSources=prior.sourceInputs.filter(f=>sha(read(f.path))!==f.sha256).map(f=>f.path).sort();
assert.deepEqual(changedPriorSources,['.github/workflows/voxel.yml','docs/voxel-runtime-rewrite-progress.md','games/voxel/package.json']);
assert.equal(read('/tmp/voxel-survival-workers-types.log').length,0);
assert.match(read('/tmp/voxel-survival-workers-release-verify.log').toString(),/Verified current source\/content and 12 release files/);
const profiles=['smoke','full','ci'].map(name=>({name,report:json('/tmp/voxel-survival-workers-'+name+'-pass.json')}));
for(const {name,report:r}of profiles){assert.equal(r.buildId,build.buildId);assert.equal(r.result,'PACKAGED_SUSTAINED_SURVIVAL_AND_COMMITTED_CRASH_RECOVERY_PASS');assert.match(read('/tmp/voxel-survival-workers-'+name+'-audit.log').toString(),/SURVIVAL_WORKER_REPORT_AUDIT_PASS/);}
const full=profiles.find(p=>p.name==='full').report;
assert.deepEqual(full.configuration,{seconds:180,roomCount:2,playerCount:8,ioMs:5});assert.equal(full.counts.rounds,53);assert.equal(full.counts.mined,848);assert.equal(full.steadyRoomMetrics.length,34);
const sourcePaths=[...new Set([...prior.sourceInputs.map(f=>f.path),
  'games/voxel/tools/survival-peer.ts','games/voxel/tools/benchmark-survival-workers.ts','games/voxel/tools/check-survival-workers.ts',
  'games/voxel/docs/sustained-survival.md','games/voxel/README.md'])].sort();
assert(sourcePaths.every(p=>!p.includes('/node_modules/')&&!/\.env(?:$|\.)/.test(p)));
const artifacts=[];
function copy(input,output){const bytes=read(input),p=path.join(destination,output);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);const h=sha(bytes);artifacts.push({path:output,sha256:h});return h;}
const sourceInputs=sourcePaths.map(p=>({path:p,sha256:copy(p,'sources/'+p)}));
const releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){const p='games/voxel/'+dir+'/'+f.path,h=copy(p,'release/'+dir+'/'+f.path);assert.equal(h,f.hash);releaseFiles.push({path:p,sha256:h});}
for(const {name}of profiles){copy('/tmp/voxel-survival-workers-'+name+'-pass.json',name+'.json');copy('/tmp/voxel-survival-workers-'+name+'-pass.log',name+'.txt');copy('/tmp/voxel-survival-workers-'+name+'-audit.log',name+'-audit.txt');}
for(const name of ['strip','ready','material','place','restored-view','welcome','resume'])for(const ext of ['log','json']){const p='/tmp/voxel-survival-workers-'+name+'-negative.'+ext;if(fs.existsSync(p))copy(p,'initial-failures/'+name+'.'+ext);}
for(const [out,input]of Object.entries({
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
  'types.txt':'/tmp/voxel-survival-workers-types.log','release-verify.txt':'/tmp/voxel-survival-workers-release-verify.log',
  'report-corruption-checks.json':'/tmp/voxel-survival-workers-report-negatives.json',
  'producer.mjs':'/tmp/voxel-sustained-survival-capture.mjs','audit.mjs':'/tmp/voxel-sustained-survival-audit.mjs',
  'README.md':'games/voxel/docs/sustained-survival.md',
}))copy(input,out);
const webInventory=json(priorDir+'/web-inventory.json');
for(const f of webInventory)assert.equal(sha(read(f.path)),f.sha256,f.path);
copy(priorDir+'/web-inventory.json','web-inventory.json');
const v={result:'SUSTAINED_PACKAGED_SURVIVAL_AUTOSAVE_AND_COMMITTED_WORKER_RECOVERY_PASS',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash,
  scope:'Tooling and CI increment; three-minute 2x8 UUID ordinary survival workload on prepared platforms with owned kits. In-memory metadata and delayed in-memory object contracts, no actual hosted Auth/SQL/Storage/SFU, rendering, physical device/network, travel-memory or school capacity signoff. Runtime and release unchanged; prior core/service/web/browser qualification is reused, not rerun.',
  priorArchive:priorDir,priorVerificationSha256:sha(read(priorDir+'/verification.json')),changedPriorSources,
  profileConfigurations:profiles.map(p=>({name:p.name,configuration:p.report.configuration})),
  sourceInputs,releaseFiles,webInventoryFiles:webInventory.length,artifacts};
const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(destination+'/verification.json',bytes);
const pointer={result:v.result,archive:destination,verificationSha256:sha(bytes),buildId:v.buildId,sourceFiles:sourceInputs.length,releaseFiles:releaseFiles.length,artifacts:artifacts.length,scope:v.scope};
fs.writeFileSync('games/voxel/test-results/sustained-survival.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
