import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const archive='games/voxel/evidence/backend-retirement',base='games/voxel/evidence/client-retirement';
const baseDigest='ce19e1004ef031aa00dec08c312f335557a5c12f93c0b275896bcfbbcf132a0d';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function baseline(){
 assert.equal(sha(read(base+'/verification.json')),baseDigest);
 const v=json(base+'/verification.json');
 for(const f of v.artifacts)assert.equal(sha(read(base+'/'+f.path)),f.sha256,f.path);
 for(const f of v.sourceInputs)assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);
 return v;
}
function routingAudit(){
 const ts=createRequire(process.cwd()+'/package.json')('typescript');
 const files=execFileSync('rg',['--files','apps','packages','scripts','games/voxel/src','-g','*.ts','-g','*.tsx','-g','*.mjs','-g','*.cjs'],{encoding:'utf8'}).trim().split('\n');
 let imports=0;
 for(const file of files){
  for(const entry of ts.preProcessFile(read(file).toString(),true,true).importedFiles){
   const specifier=entry.fileName;imports++;
   assert(!specifier.includes('minecraft-server'),file+':'+specifier);
   assert(!specifier.includes('voxelServerUrl'),file+':'+specifier);
   if(!file.startsWith('packages/voxel-content/'))assert(!specifier.startsWith('@playground/voxel-content'),file+':'+specifier);
   if(specifier.startsWith('.'))assert(!path.resolve(path.dirname(file),specifier).startsWith(path.resolve('apps/minecraft-server')+'/'),file+':'+specifier);
  }
  if(file.startsWith('apps/web/src/')&&!file.endsWith('.test.ts'))assert(!read(file).toString().includes('VITE_VOXEL_SERVER_URL'),file);
 }
 assert(!json('package.json').scripts['dev:minecraft']);
 assert(!json('package-lock.json').packages['apps/minecraft-server']);
 assert(!json('apps/web/tsconfig.json').compilerOptions.paths['@playground/voxel-content']);
 return {result:'NO_LEGACY_BACKEND_CONTENT_OR_URL_IMPORTS',files:files.length,imports};
}
function reactCheck(r){
 assert.equal(r.result,'PASS');assert.equal(r.buildId,'7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc');
 assert.equal(r.repeatedMounts.cycles,2);assert.equal(r.voice.enabled,false);assert.deepEqual(r.errors,[]);
 for(const key of ['chatFlow','moderationFlow','staffModeAndTeleport','chatPersistedAfterReopen','failedSaveNotConfirmed','sameRequestRetry','terminalGameOwnersReleased'])assert.equal(r[key],true,key);
 for(const {unmounted:u} of r.repeatedMounts.samples){
  assert.deepEqual(u.resources,{geometries:0,textures:0,workers:0});assert.equal(u.audio,'closed');
  assert.equal(u.memory.gpuBuffers.live,0);assert.equal(u.memory.gpuBuffers.bytes,0);
  assert.equal(u.owners.openedSockets,u.owners.closedSockets);assert.equal(u.owners.createdWorkers,u.owners.closedWorkers);
 }
}
if(!process.argv.includes('--audit')){
 assert(!fs.existsSync(archive),'Never overwrite completed evidence');const prior=baseline();
 const removal=json('/tmp/voxel-legacy-backend-removal-inputs.json');
 assert.equal(removal.files.length,44);assert.equal(removal.files.reduce((n,r)=>n+r.lines,0),10081);
 const helper='apps/web/src/lib/voxelServerUrl.ts';
 const retired=[...removal.files,{path:helper,sha256:sha(read('/tmp/voxel-operations-legacy-before/'+helper)),bytes:read('/tmp/voxel-operations-legacy-before/'+helper).length,lines:read('/tmp/voxel-operations-legacy-before/'+helper).toString().trimEnd().split('\n').length}].map(r=>{
  assert(!fs.existsSync(r.path),r.path);
  const backup=r.path===helper?'/tmp/voxel-operations-legacy-before/'+r.path:removal.backup+'/'+r.path;
  assert.equal(sha(read(backup)),r.sha256,r.path);
  let gitCommit=null;try{if(sha(execFileSync('git',['show',removal.head+':'+r.path],{stdio:['ignore','pipe','ignore']}))===r.sha256)gitCommit=removal.head;}catch{}
  return {...r,gitCommit,backup};
 });
 const before=json('/tmp/voxel-legacy-backend-package-lock.json-before'),lock=json('package-lock.json');
 const removedPackages=Object.keys(before.packages).filter(k=>!lock.packages[k]);
 assert.deepEqual(removedPackages.sort(),['apps/minecraft-server','node_modules/@playground/minecraft-server']);
 for(const p of Object.keys(lock.packages))if(before.packages[p])for(const field of ['version','resolved','integrity'])assert.equal(lock.packages[p][field],before.packages[p][field],p+':'+field);
 const checks=json('/tmp/voxel-legacy-backend-checks.json');
 for(const c of checks.checks){assert.equal(c.observedExitCode,0);assert.equal(sha(read(c.log)),c.sha256,c.name);}
 const extra=['apps/voxel-server/src/school-operations.ts','apps/voxel-server/tests/school-operations.test.ts','apps/voxel-server/docs/operations.md','apps/web/src/lib/adminStats.ts','apps/web/src/lib/adminStats.test.ts','apps/web/src/components/AdminStatsSection.tsx','apps/web/src/components/ClassroomPresentationPublisher.tsx','apps/web/src/utils/telemetry.ts','apps/web/src/utils/telemetry.test.ts','apps/web/src/pages/ClassroomPage.tsx','apps/web/src/lib/classroomServerUrl.ts','apps/web/src/lib/classroomServerUrl.test.ts','packages/observability/src/logger.ts','packages/observability/src/socketLifecycle.ts','packages/observability/src/__tests__/classroomWebhook.test.ts','packages/observability/src/__tests__/observability.test.ts','packages/observability/package.json','packages/observability/jest.config.cjs','apps/classroom-server/tools/verify-boundary.cjs','apps/classroom-server/docs/route-contract.json','.github/workflows/classroom.yml','games/voxel/docs/backend-retirement.md'];
 const paths=[...new Set([...prior.sourceInputs.map(f=>f.path),...extra])].filter(p=>fs.existsSync(p)).sort();
 for(const f of prior.sourceInputs)if(!fs.existsSync(f.path))assert(retired.some(r=>r.path===f.path),f.path);
 const copies={'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json','README.md':'games/voxel/docs/backend-retirement.md','evidence.mjs':'/tmp/voxel-backend-retirement-evidence.mjs','removal-inputs.json':'/tmp/voxel-legacy-backend-removal-inputs.json','lock-before.json':'/tmp/voxel-legacy-backend-package-lock.json-before','root-package-before.json':'/tmp/voxel-legacy-backend-package.json-before','checks.json':'/tmp/voxel-legacy-backend-checks.json','boundary.json':'apps/web/dist/voxel-browser-boundary.json','react.json':'apps/web/test-results/voxel-react.json','content.json':'games/voxel/test-results/content-disposition.json','postgres-stop.txt':'/tmp/voxel-legacy-backend-postgres-stop.log','local-launcher.zsh':'/tmp/voxel-legacy-backend-local.zsh','negative-initial-route.txt':'/tmp/voxel-operations-service-tests.log'};
 for(const c of checks.checks)copies['checks/'+c.name+'.txt']=c.log;
 for(const p of [...paths,...Object.values(copies)])assert(fs.statSync(p).isFile(),p);
 const routing=routingAudit();reactCheck(json(copies['react.json']));
 const artifacts=[];
 const copy=(input,out)=>{const bytes=read(input),target=archive+'/'+out;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);const sha256=sha(bytes);artifacts.push({path:out,sha256});return sha256;};
 const sourceInputs=paths.map(p=>{const sha256=sha(read(p)),old=prior.sourceInputs.find(f=>f.path===p);if(old?.sha256===sha256)return{path:p,sha256,snapshotPath:old.snapshotPath,inherited:true};copy(p,'sources/'+p);return{path:p,sha256,snapshotPath:archive+'/sources/'+p,inherited:false};});
 for(const r of retired)if(!r.gitCommit)copy(r.backup,'retired-sources/'+r.path);
 for(const [out,input]of Object.entries(copies))copy(input,out);
 const react=json(copies['react.json']);
 const fixtureFiles=react.clientArtifacts.map(f=>{const sha256=copy('apps/web/test-results/react-fixture'+f.path,'react-fixture'+f.path);assert.equal(sha256,f.sha256);return{path:f.path,sha256};});
 const inventory=JSON.stringify(walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))})),null,2)+'\n';
 fs.writeFileSync(archive+'/web-inventory.json',inventory);artifacts.push({path:'web-inventory.json',sha256:sha(inventory)});
 const v={result:'LEGACY_BACKEND_RETIRED_AND_INDEPENDENT_SCHOOL_OPERATIONS_VERIFIED',capturedAt:new Date().toISOString(),baseArchive:base,baseVerificationSha256:baseDigest,buildId:prior.buildId,runtimeHash:prior.runtimeHash,sourceInputs,retiredSources:retired.map(({backup,...r})=>r),removedPackages,releaseFiles:prior.releaseFiles,fixtureFiles,webInventoryFiles:JSON.parse(inventory).length,routing,artifacts,qualified:{webTests:165,voxelServiceTests:51,classroomTests:69,observabilityTests:32,classroomRoutes:20,classroomGameImports:0,strictWebAndServiceTypes:true,localPostgresComposition:true,reactMounts:2,contentEntries:197},legacyBackendRetired:true,publicAssetsRetired:false,legacyContentReferenceRetired:false,hostedWrites:false,deployed:false,scope:'Source/workspace retirement only; independent classroom telemetry and administrator-only local voxel stats; unchanged game runtime. Private-school PC target, optional mobile/tablet, no synthetic-scale gate or new headcount caps. Actual hosted/school-PC journeys and routing/deployment remain open.'};
 const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);
 fs.writeFileSync('games/voxel/test-results/backend-retirement.json',JSON.stringify({result:v.result,archive,buildId:v.buildId,verificationSha256:sha(bytes)},null,2)+'\n');
}
const prior=baseline(),v=json(archive+'/verification.json'),pointer=json('games/voxel/test-results/backend-retirement.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);}
for(const r of v.retiredSources){assert(!fs.existsSync(r.path),r.path);const bytes=r.gitCommit?execFileSync('git',['show',r.gitCommit+':'+r.path]):read(archive+'/retired-sources/'+r.path);assert.equal(sha(bytes),r.sha256,r.path);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const runtime=walk('games/voxel/src');assert.equal(sha(Buffer.concat(runtime.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
assert.equal(v.buildId,prior.buildId);assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);
for(const f of v.fixtureFiles){assert.equal(sha(read(archive+'/react-fixture'+f.path)),f.sha256);assert.equal(sha(read('apps/web/test-results/react-fixture'+f.path)),f.sha256);}
reactCheck(json(archive+'/react.json'));assert.deepEqual(routingAudit(),v.routing);
for(const f of json(archive+'/web-inventory.json'))assert.equal(sha(read(f.path)),f.sha256,f.path);
const boundary=json(archive+'/boundary.json');assert.equal(boundary.gameModules,45);assert.equal(boundary.forbiddenModules,0);
const content=json(archive+'/content.json');assert.equal(content.result,'PASS');assert.equal(content.legacyEntries,197);assert.deepEqual(content.pending,[]);
for(const name of ['web-types','service-types'])assert.equal(read(archive+'/checks/'+name+'.txt').length,0);
for(const [name,count]of [['web-tests',165],['voxel-service-tests',51],['classroom-tests',69],['observability-tests',32]])assert.match(read(archive+'/checks/'+name+'.txt').toString(),new RegExp(name.includes('web')?count+' passed':name.includes('voxel')?'pass '+count:'Tests:\\s+'+count+' passed'));
assert.match(read(archive+'/checks/postgres-service.txt').toString(),/pass 1/);assert.match(read(archive+'/postgres-stop.txt').toString(),/server stopped/);
const bc=read(archive+'/checks/classroom-boundary.txt').toString();assert.match(bc,/"classroomRoutes":20/);assert.match(bc,/"gameImports":0/);
const before=json(archive+'/lock-before.json'),lock=json('package-lock.json');assert.deepEqual(Object.keys(before.packages).filter(p=>!lock.packages[p]).sort(),v.removedPackages);
for(const p of Object.keys(lock.packages))if(before.packages[p])for(const field of ['version','resolved','integrity'])assert.equal(lock.packages[p][field],before.packages[p][field],p+':'+field);
const result={result:'BACKEND_REMOVAL_PREIMAGE_SOURCE_LOCK_ROUTING_PACKAGED_AUTH_CONTENT_LOCAL_SQL_REACT_AND_BASELINE_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,copiedSources:v.sourceInputs.filter(f=>!f.inherited).length,retiredBackendFiles:44,retiredSharedUrlHelpers:1,removedPackageEntries:v.removedPackages.length,fixtureFiles:v.fixtureFiles.length,webFiles:v.webInventoryFiles,artifacts:v.artifacts.length,priorArchiveUnchanged:true,productionGameRuntimeUnchanged:true,hostedWrites:false,deployed:false};
fs.writeFileSync('games/voxel/test-results/backend-retirement-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
