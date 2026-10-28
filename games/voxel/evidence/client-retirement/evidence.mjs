import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const archive='games/voxel/evidence/client-retirement',base='games/voxel/evidence/pc-school';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const baseDigest='dcd14c1ed0fc4e7f10138176e2d86c022c206c1ecb315bd2b319cd131d9d698c';
function baseline(){
 assert.equal(sha(read(base+'/verification.json')),baseDigest);const p=json(base+'/verification.json');
 for(const f of p.artifacts)assert.equal(sha(read(base+'/'+f.path)),f.sha256,f.path);
 for(const f of p.sourceInputs)assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);
 return p;
}
function reactCheck(r){
 assert.equal(r.result,'PASS');assert.equal(r.buildId,'7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc');
 assert.equal(r.repeatedMounts.cycles,2);assert.equal(r.voice.enabled,false);assert.deepEqual(r.errors,[]);
 for(const key of ['chatFlow','moderationFlow','staffModeAndTeleport','chatPersistedAfterReopen'])assert.equal(r[key],true,key);
 for(const sample of r.repeatedMounts.samples){
  const u=sample.unmounted;assert.deepEqual(u.resources,{geometries:0,textures:0,workers:0});assert.equal(u.audio,'closed');
  assert.equal(u.memory.gpuBuffers.live,0);assert.equal(u.memory.gpuBuffers.bytes,0);assert.equal(u.owners.openedSockets,u.owners.closedSockets);assert.equal(u.owners.createdWorkers,u.owners.closedWorkers);
 }
}
if(!process.argv.includes('--audit')){
 assert(!fs.existsSync(archive),'Never overwrite an archive');const prior=baseline();
 const removed=json('/tmp/voxel-legacy-client-removal-inputs.json'),guides=json('/tmp/voxel-legacy-client-retired-guides.json');
 assert.equal(removed.length,28);assert.equal(removed.reduce((n,r)=>n+r.lines,0),10304);assert.equal(guides.length,3);
 for(const r of [...removed,...guides]){assert(!fs.existsSync(r.path),r.path);assert.equal(sha(read('/tmp/voxel-legacy-client-before/'+r.path)),r.sha256,r.path);}
 const oldLock=json('/tmp/voxel-legacy-client-package-lock-before.json'),lock=json('package-lock.json');
 const removedPackages=Object.keys(oldLock.packages).filter(k=>!lock.packages[k]);assert.equal(removedPackages.length,19);
 for(const k of Object.keys(lock.packages))if(oldLock.packages[k])for(const field of ['version','integrity','resolved'])assert.equal(lock.packages[k][field],oldLock.packages[k][field],k+':'+field);
 for(const key of ['@babylonjs/core','noa-engine','@playground/voxel-content'])assert(!json('apps/web/package.json').dependencies[key]);
 for(const name of ['types','tests','build','content','react','lock'])assert.equal(read('/tmp/voxel-legacy-client-'+name+'.exit').toString().trim(),'0',name);
 assert.equal(read('/tmp/voxel-legacy-client-types.log').length,0);assert.match(read('/tmp/voxel-legacy-client-tests.log').toString(),/160 passed/);
 const boundary=json('apps/web/dist/voxel-browser-boundary.json');assert.equal(boundary.forbiddenModules,0);assert.equal(boundary.gameModules,45);
 reactCheck(json('apps/web/test-results/voxel-react.json'));
 assert.equal(json('games/voxel/artifacts/build.json').buildId,prior.buildId);
 for(const f of prior.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const retired=[...removed,...guides].map(r=>{let gitMatches=false;try{gitMatches=sha(execFileSync('git',['show',head+':'+r.path],{stdio:['ignore','pipe','ignore']}))===r.sha256;}catch{}return {...r,gitCommit:gitMatches?head:null};});
 const extra=['ARCHITECTURE.md','.cursor/rules/playground-architecture.mdc','.cursor/rules/playground-project.mdc','.cursor/skills/playground-add-game/SKILL.md','docs/README.md','docs/voxel_client_optimization_proposal.md','docs/voxel_expansion_specification.md','games/voxel/docs/client-retirement.md'];
 const paths=[...new Set([...prior.sourceInputs.map(f=>f.path),...extra])].filter(p=>fs.existsSync(p)).sort();
 for(const f of prior.sourceInputs)if(!fs.existsSync(f.path))assert(retired.some(r=>r.path===f.path),f.path);
 const copies={
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
  'graph-before.json':'/tmp/voxel-legacy-client-graph.json','removed-inputs.json':'/tmp/voxel-legacy-client-removal-inputs.json','retired-guides.json':'/tmp/voxel-legacy-client-retired-guides.json',
  'lock-before.json':'/tmp/voxel-legacy-client-package-lock-before.json','web-package-before.json':'/tmp/voxel-legacy-client-web-package-before.json',
  'boundary.json':'apps/web/dist/voxel-browser-boundary.json','react.json':'apps/web/test-results/voxel-react.json','postgres-stop.txt':'/tmp/voxel-legacy-client-postgres-stop.log',
  'content.json':'games/voxel/test-results/content-disposition.json',
  'README.md':'games/voxel/docs/client-retirement.md','evidence.mjs':'/tmp/voxel-client-retirement-evidence.mjs',
 };
 for(const name of ['types','tests','build','content','react','lock']){copies[name+'.txt']='/tmp/voxel-legacy-client-'+name+'.log';copies[name+'.exit']='/tmp/voxel-legacy-client-'+name+'.exit';}
 for(const p of [...paths,...Object.values(copies)])assert(fs.statSync(p).isFile(),p);
 const artifacts=[];const copy=(input,out)=>{const bytes=read(input),target=archive+'/'+out;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);const sha256=sha(bytes);artifacts.push({path:out,sha256});return sha256;};
 const sourceInputs=paths.map(p=>{const sha256=sha(read(p)),old=prior.sourceInputs.find(f=>f.path===p);if(old?.sha256===sha256)return{path:p,sha256,snapshotPath:old.snapshotPath,inherited:true};copy(p,'sources/'+p);return{path:p,sha256,snapshotPath:archive+'/sources/'+p,inherited:false};});
 for(const r of retired)if(!r.gitCommit)copy('/tmp/voxel-legacy-client-before/'+r.path,'retired-sources/'+r.path);
 for(const [out,input]of Object.entries(copies))copy(input,out);
 const react=json('apps/web/test-results/voxel-react.json');const fixtureFiles=react.clientArtifacts.map(f=>{const sha256=copy('apps/web/test-results/react-fixture'+f.path,'react-fixture'+f.path);assert.equal(sha256,f.sha256);return{path:f.path,sha256};});
 const web=walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))}));const inventory=JSON.stringify(web,null,2)+'\n';fs.writeFileSync(archive+'/web-inventory.json',inventory);artifacts.push({path:'web-inventory.json',sha256:sha(inventory)});
 const v={result:'UNUSED_LEGACY_VOXEL_CLIENT_RETIRED_AND_REPLACEMENT_APP_VERIFIED',capturedAt:new Date().toISOString(),baseArchive:base,baseVerificationSha256:baseDigest,buildId:prior.buildId,runtimeHash:prior.runtimeHash,sourceInputs,retiredSources:retired,removedPackages,releaseFiles:prior.releaseFiles,fixtureFiles,webInventoryFiles:web.length,artifacts,qualified:{webTests:160,retiredImplementationTests:20,strictWebTypes:true,contentEntries:197,reactMounts:2,forbiddenBundleModules:0},frontendRetired:true,legacyBackendRetired:false,publicAssetsRetired:false,hostedWrites:false,deployed:false,scope:'Remove only proven-unused old NOA/Babylon frontend and direct dependencies, retain shared telemetry/classroom/other-game paths. Unchanged production game runtime; actual replacement React/local-SQL student/teacher journey and tracked teardown pass. Private-school PC scope; legacy backend/assets/operational routing, actual hosted/school-PC workflows and release decisions remain.'};
 const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);fs.writeFileSync('games/voxel/test-results/client-retirement.json',JSON.stringify({result:v.result,archive,buildId:v.buildId,verificationSha256:sha(bytes)},null,2)+'\n');
}
const v=json(archive+'/verification.json'),pointer=json('games/voxel/test-results/client-retirement.json');baseline();
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);}
for(const r of v.retiredSources){assert(!fs.existsSync(r.path),r.path);const b=r.gitCommit?execFileSync('git',['show',r.gitCommit+':'+r.path]):read(archive+'/retired-sources/'+r.path);assert.equal(sha(b),r.sha256,r.path);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
for(const f of v.fixtureFiles){assert.equal(sha(read(archive+'/react-fixture'+f.path)),f.sha256);assert.equal(sha(read('apps/web/test-results/react-fixture'+f.path)),f.sha256);}
const runtime=walk('games/voxel/src');assert.equal(sha(Buffer.concat(runtime.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
reactCheck(json(archive+'/react.json'));assert.equal(json(archive+'/boundary.json').forbiddenModules,0);
const content=json(archive+'/content.json');assert.equal(content.result,'PASS');assert.equal(content.legacyEntries,197);assert.deepEqual(content.pending,[]);
assert(fs.existsSync('apps/web/src/lib/voxelServerUrl.ts'));assert.match(read('apps/web/src/utils/telemetry.ts').toString(),/getVoxelServerUrl/);
for(const key of ['@babylonjs/core','noa-engine','@playground/voxel-content'])assert(!json('apps/web/package.json').dependencies[key]);
for(const name of ['types','tests','build','content','react','lock'])assert.equal(read(archive+'/'+name+'.exit').toString().trim(),'0');
assert.match(read(archive+'/tests.txt').toString(),/160 passed/);assert.equal(read(archive+'/types.txt').length,0);assert.match(read(archive+'/postgres-stop.txt').toString(),/server stopped/);
const web=json(archive+'/web-inventory.json');for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
const result={result:'LEGACY_CLIENT_REMOVAL_SOURCE_GIT_LOCK_BUNDLE_CONTENT_REACT_AND_BASELINE_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,retiredClientFiles:28,retiredGuideFiles:3,removedPackageEntries:v.removedPackages.length,sourceFiles:v.sourceInputs.length,copiedSources:v.sourceInputs.filter(f=>!f.inherited).length,fixtureFiles:v.fixtureFiles.length,webFiles:web.length,artifacts:v.artifacts.length,priorArchiveUnchanged:true,productionGameRuntimeUnchanged:true,legacyBackendRetired:false,publicAssetsRetired:false,hostedWrites:false,deployed:false};
fs.writeFileSync('games/voxel/test-results/client-retirement-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
