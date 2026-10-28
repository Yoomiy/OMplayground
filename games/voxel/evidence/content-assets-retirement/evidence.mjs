import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const archive='games/voxel/evidence/content-assets-retirement',base='games/voxel/evidence/backend-retirement';
const baseDigest='8b5df984057255793acf3952f6594a8a75c674f0a467d4a29ba0c8c29d7ad518';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function baseline(){
 assert.equal(sha(read(base+'/verification.json')),baseDigest);const v=json(base+'/verification.json');
 for(const f of v.artifacts)assert.equal(sha(read(base+'/'+f.path)),f.sha256,f.path);
 for(const f of v.sourceInputs)assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);
 return v;
}
function preimages(rows){
 for(const r of rows){assert(r.gitCommit,r.path);assert(!/[\r\n]/.test(r.path));assert(!fs.existsSync(r.path),r.path);}
 const bytes=execFileSync('git',['cat-file','--batch'],{input:rows.map(r=>r.gitCommit+':'+r.path).join('\n')+'\n',maxBuffer:64*1024*1024});
 let at=0;
 for(const r of rows){const end=bytes.indexOf(10,at);assert(end>=at);const [,type,size]=bytes.subarray(at,end).toString().split(' ');assert.equal(type,'blob',r.path);const n=Number(size);assert(Number.isSafeInteger(n)&&n>=0);const content=bytes.subarray(end+1,end+1+n);assert.equal(content.length,n);assert.equal(sha(content),r.sha256,r.path);assert.equal(bytes[end+1+n],10);at=end+n+2;}
 assert.equal(at,bytes.length);
}
function routing(){
 const ts=createRequire(process.cwd()+'/package.json')('typescript');
 const files=execFileSync('rg',['--files','apps','packages','scripts','research','games/voxel/src','-g','*.ts','-g','*.tsx','-g','*.mjs','-g','*.cjs'],{encoding:'utf8'}).trim().split('\n');
 let imports=0;
 for(const p of files){for(const entry of ts.preProcessFile(read(p).toString(),true,true).importedFiles){imports++;assert(!/minecraft-server|voxel-content|voxelServerUrl|noa-engine|@babylonjs/.test(entry.fileName),p+':'+entry.fileName);}
 if(p.startsWith('apps/web/src/')&&!p.endsWith('.test.ts'))assert(!read(p).toString().includes('VITE_VOXEL_SERVER_URL'),p);}
 const pkg=json('package.json'),lock=json('package-lock.json');
 for(const key of ['dev:minecraft','borrow-voxel-audio','borrow-voxel-textures'])assert(!pkg.scripts[key]);
 for(const key of ['apps/minecraft-server','packages/voxel-content'])assert(!lock.packages[key]);
 assert.equal(pkg.scripts['dev:app'],'node scripts/dev-app.mjs');assert.equal(pkg.scripts['dev:voxel-server'],'node scripts/dev-service-start.mjs voxel');
 return {result:'NO_ACTIVE_LEGACY_ENGINE_CONTENT_OR_URL_IMPORTS',files:files.length,imports};
}
function references(root){
 const provenance=json(root+'/sources/games/voxel/docs/legacy-content-reference/provenance.json');
 const oldInventory=json(root+'/inventory-before.json'),oldDecisions=json(root+'/disposition-before.json');
 for(const [name,before]of [['legacy-inventory',oldInventory],['disposition',oldDecisions]]){
  const next=json('games/voxel/content/'+name+'.json');before.sources=before.sources.map(s=>({...s,path:provenance.files.find(f=>f.originalPath===s.path).frozenPath}));assert.deepEqual(next,before);
 }
 assert.equal(provenance.files.length,3);
 for(const f of provenance.files){assert.equal(sha(read(f.frozenPath)),f.sha256);assert.equal(sha(execFileSync('git',['show',provenance.sourceCommit+':'+f.originalPath])),f.sha256);}
 const negative=json(root+'/negative.json');assert.equal(negative.result,'FROZEN_SOURCE_REGENERATION_AND_AUDIT_REJECT_CORRUPTION');assert.equal(negative.liveSourceUnchanged,true);assert.deepEqual(negative.runs.map(r=>r.exitCode),[0,0,1,1]);
}
function reactCheck(r){
 assert.equal(r.result,'PASS');assert.equal(r.repeatedMounts.cycles,2);assert.equal(r.voice.enabled,false);assert.deepEqual(r.errors,[]);
 for(const key of ['chatFlow','moderationFlow','staffModeAndTeleport','chatPersistedAfterReopen','failedSaveNotConfirmed','sameRequestRetry','terminalGameOwnersReleased'])assert.equal(r[key],true,key);
 for(const {unmounted:u}of r.repeatedMounts.samples){assert.deepEqual(u.resources,{geometries:0,textures:0,workers:0});assert.equal(u.audio,'closed');assert.equal(u.memory.gpuBuffers.live,0);assert.equal(u.memory.gpuBuffers.bytes,0);assert.equal(u.owners.openedSockets,u.owners.closedSockets);assert.equal(u.owners.createdWorkers,u.owners.closedWorkers);}
}
if(!process.argv.includes('--audit')){
 assert(!fs.existsSync(archive),'Never overwrite completed evidence');const prior=baseline();
 const content=json('/tmp/voxel-legacy-content-removal-inputs.json'),assets=json('/tmp/voxel-legacy-assets-removal-inputs.json'),research=json('/tmp/voxel-legacy-content-research-retirement.json');
 assert.equal(content.files.length,26);assert.equal(content.files.reduce((n,f)=>n+f.lines,0),5290);assert.equal(content.files.filter(f=>f.path.endsWith('.test.ts')).length,9);
 assert.equal(assets.assetFiles,1946);assert.equal(assets.assetBytes,9154674);assert.equal(assets.unrelatedPublicFiles,574);
 const retired=[...content.files.map(f=>({...f,kind:'legacy-content-workspace'})),...assets.files,{...research,kind:'obsolete-generator-probe'}];assert.equal(retired.length,1975);preimages(retired);
 assert.equal(sha(read(research.snapshotPath)),research.sha256);
 const checks=json('/tmp/voxel-legacy-content-checks.json');assert.equal(checks.result,'FROZEN_REFERENCE_CONTENT_TYPES_DOMAIN_WASM_AND_APP_PASS');assert.equal(checks.checks.length,10);
 for(const c of checks.checks){assert.equal(c.exitCode,0,c.name);assert.equal(sha(read(c.log)),c.sha256,c.name);}
 for(const name of ['postgres-service','react'])assert.equal(read('/tmp/voxel-legacy-assets-'+name+'.exit').toString().trim(),'0');
 const extra=['games/voxel/docs/content-retirement.md','games/voxel/docs/asset-retirement.md','games/voxel/docs/legacy-content-reference/README.md','games/voxel/docs/legacy-content-reference/provenance.json','games/voxel/docs/legacy-content-reference/blocks.ts.txt','games/voxel/docs/legacy-content-reference/items.ts.txt','games/voxel/docs/legacy-content-reference/recipes.ts.txt','.cursor/skills/playground-backend-qa/SKILL.md','.cursor/skills/playground-backend-qa/reference.md','research/voxel-runtime/RESULTS.md',research.snapshotPath,'docs/adr/001-websocket-socket-io.md','docs/local-development.md','scripts/dev-app.mjs','scripts/dev-app.test.mjs','scripts/dev-service-plan.mjs','scripts/dev-service-start.mjs','scripts/dev-service.mjs','apps/voxel-server/.env.example'];
 const paths=[...new Set([...prior.sourceInputs.map(f=>f.path),...extra])].filter(p=>fs.existsSync(p)).sort();
 for(const f of prior.sourceInputs)if(!fs.existsSync(f.path))assert(retired.some(r=>r.path===f.path),f.path);
 const copies={
  'README.md':'games/voxel/docs/content-retirement.md','asset-retirement.md':'games/voxel/docs/asset-retirement.md','evidence.mjs':'/tmp/voxel-content-assets-evidence.mjs','checks.json':'/tmp/voxel-legacy-content-checks.json','check-runner.mjs':'/tmp/voxel-content-retirement-checks.mjs',
  'content-removal.json':'/tmp/voxel-legacy-content-removal-inputs.json','asset-removal.json':'/tmp/voxel-legacy-assets-removal-inputs.json','research-retirement.json':'/tmp/voxel-legacy-content-research-retirement.json','asset-removal-runner.mjs':'/tmp/voxel-retire-legacy-assets.mjs',
  'inventory-before.json':'/tmp/voxel-legacy-content-before/games/voxel/content/legacy-inventory.json','disposition-before.json':'/tmp/voxel-legacy-content-before/games/voxel/content/disposition.json','lock-before.json':'/tmp/voxel-legacy-content-before/package-lock.json','root-package-before-assets.json':'/tmp/voxel-legacy-assets-package.json-before',
  'public-before.json':'/tmp/voxel-legacy-assets-public-before.json','asset-reference-search-before.txt':'/tmp/voxel-legacy-assets-reference-search-before.txt',
  'negative.json':'/tmp/voxel-legacy-content-negative.json','negative-runner.mjs':'/tmp/voxel-legacy-reference-negative.mjs',
  'hosted-read.json':'/tmp/voxel-legacy-assets-hosted-read.json','hosted-read.ts':'/tmp/voxel-legacy-assets-hosted-read.ts','hosted-read.txt':'/tmp/voxel-legacy-assets-hosted-read.log',
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json','release-check.json':'games/voxel/test-results/release-verification.json','content.json':'games/voxel/test-results/content-disposition.json','boundary.json':'apps/web/dist/voxel-browser-boundary.json','react.json':'apps/web/test-results/voxel-react.json',
  'asset-web-build.txt':'/tmp/voxel-legacy-assets-web-build.log','postgres-service.txt':'/tmp/voxel-legacy-assets-postgres-service.log','react.txt':'/tmp/voxel-legacy-assets-react.log','postgres-stop.txt':'/tmp/voxel-legacy-assets-postgres-stop.log','local-launcher.zsh':'/tmp/voxel-legacy-assets-local.zsh','release-final.txt':'/tmp/voxel-legacy-assets-release.log',
  'dev-supervisor.txt':'/tmp/voxel-dev-app-supervisor-final.log','dev-preflight.txt':'/tmp/voxel-dev-app-preflight.log',
 };
 for(const c of checks.checks)copies['checks/'+c.name+'.txt']=c.log;
 for(const r of json('/tmp/voxel-legacy-content-negative.json').runs)copies['negative/'+r.name+'.txt']=r.log;
 for(const p of [...paths,...Object.values(copies)])assert(fs.statSync(p).isFile(),p);
 const graph=routing(),artifacts=[];
 const copy=(input,out)=>{const bytes=read(input),target=archive+'/'+out;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);const sha256=sha(bytes);artifacts.push({path:out,sha256});return sha256;};
 const sourceInputs=paths.map(p=>{const sha256=sha(read(p)),old=prior.sourceInputs.find(f=>f.path===p);if(old?.sha256===sha256)return{path:p,sha256,snapshotPath:old.snapshotPath,inherited:true};copy(p,'sources/'+p);return{path:p,sha256,snapshotPath:archive+'/sources/'+p,inherited:false};});
 for(const[out,input]of Object.entries(copies))copy(input,out);
 const react=json('apps/web/test-results/voxel-react.json');reactCheck(react);
 const fixtureFiles=react.clientArtifacts.map(f=>{const sha256=copy('apps/web/test-results/react-fixture'+f.path,'react-fixture'+f.path);assert.equal(sha256,f.sha256);return{path:f.path,sha256};});
 const web=walk('apps/web/dist').map(p=>({path:p,sha256:sha(read(p))}));
 assert.deepEqual(web,json(base+'/web-inventory.json').filter(f=>!f.path.startsWith('apps/web/dist/minecraft-assets/')));assert.equal(web.length,750);
 const inventory=JSON.stringify(web,null,2)+'\n';fs.writeFileSync(archive+'/web-inventory.json',inventory);artifacts.push({path:'web-inventory.json',sha256:sha(inventory)});
 const v={result:'LEGACY_CONTENT_ASSETS_RETIRED_AND_LOCAL_APP_DEVELOPMENT_VERIFIED',capturedAt:new Date().toISOString(),baseArchive:base,baseVerificationSha256:baseDigest,buildId:prior.buildId,runtimeHash:prior.runtimeHash,sourceInputs,retiredSources:retired,releaseFiles:prior.releaseFiles,fixtureFiles,routing:graph,webInventoryFiles:web.length,artifacts,qualified:{domainTests:109,actualWasmTests:92,strictGameWebServiceTypes:true,contentEntries:197,corruptionRejectedByBothTools:true,retiredContentFiles:26,retiredLegacyTestFiles:9,retiredAssetFiles:1946,retiredImportTools:2,unchangedOtherPublicFiles:574,localPostgresComposition:true,reactMounts:2,devSupervisorTests:2,devConfigurationPreflight:true},legacyBackendRetired:true,legacyContentWorkspaceRetired:true,publicLegacyAssetsRetired:true,hostedReadOnlyQueries:3,hostedWrites:false,deployed:false,scope:'Retire unused old content/workspace/media/tooling while freezing exact offline inventory provenance and preserving all 197 decisions and unrelated public files. Add user-requested combined local dev command. Matched production game runtime and nonlegacy production files unchanged. Actual hosted school/recovery, physical school-PC, feature/balance review and routing/release work remain.'};
 const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',bytes);
 fs.writeFileSync('games/voxel/test-results/content-assets-retirement.json',JSON.stringify({result:v.result,archive,buildId:v.buildId,verificationSha256:sha(bytes)},null,2)+'\n');
}
const prior=baseline(),v=json(archive+'/verification.json'),pointer=json('games/voxel/test-results/content-assets-retirement.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);}
preimages(v.retiredSources);references(archive);assert.deepEqual(routing(),v.routing);
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const runtime=walk('games/voxel/src');assert.equal(sha(Buffer.concat(runtime.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);assert.equal(v.buildId,prior.buildId);assert.equal(json(archive+'/release-check.json').matchedReleaseFiles,12);
for(const f of v.fixtureFiles){assert.equal(sha(read(archive+'/react-fixture'+f.path)),f.sha256);assert.equal(sha(read('apps/web/test-results/react-fixture'+f.path)),f.sha256);}
reactCheck(json(archive+'/react.json'));assert.equal(json(archive+'/react.json').buildId,v.buildId);
const publicBefore=json(archive+'/public-before.json').filter(f=>!f.path.startsWith('apps/web/public/minecraft-assets/'));
assert.equal(publicBefore.length,574);assert.deepEqual(walk('apps/web/public').map(p=>({path:p,sha256:sha(read(p))})),publicBefore);
const web=json(archive+'/web-inventory.json');assert.deepEqual(web,json(base+'/web-inventory.json').filter(f=>!f.path.startsWith('apps/web/dist/minecraft-assets/')));
for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
assert(!fs.existsSync('apps/web/public/minecraft-assets'));assert(fs.existsSync('apps/web/public/legacy/minecraft/thumbnail.png'));
const hosted=json(archive+'/hosted-read.json');assert.equal(hosted.result,'NO_CONFIGURED_CATALOG_OR_AVATAR_REFERENCES_TO_RETIRED_ASSETS');assert.deepEqual(Object.values(hosted.matchingCounts),[0,0,0]);assert.equal(hosted.trace.length,3);assert(hosted.trace.every(r=>r.method==='HEAD'));assert.equal(hosted.rowValuesReturned,false);assert.equal(hosted.hostedWrites,false);
const checks=json(archive+'/checks.json');assert.equal(checks.checks.length,10);assert(checks.checks.every(c=>c.exitCode===0));
for(const name of ['game-types','web-types','service-types'])assert.equal(read(archive+'/checks/'+name+'.txt').length,0);
assert.match(read(archive+'/checks/domain.txt').toString(),/pass 109/);assert.match(read(archive+'/checks/wasm.txt').toString(),/pass 92/);
assert.match(read(archive+'/dev-supervisor.txt').toString(),/pass 2/);assert.match(read(archive+'/dev-preflight.txt').toString(),/Development configuration present: voxel-server on 3001/);assert.match(read(archive+'/dev-preflight.txt').toString(),/Verified current source\/content and 12 release files/);
assert.match(read(archive+'/postgres-service.txt').toString(),/pass 1/);assert.match(read(archive+'/postgres-stop.txt').toString(),/server stopped/);
const boundary=json(archive+'/boundary.json');assert.equal(boundary.gameModules,45);assert.equal(boundary.forbiddenModules,0);
const complete=json(archive+'/content.json');assert.equal(complete.result,'PASS');assert.equal(complete.legacyEntries,197);assert.deepEqual(complete.pending,[]);
const before=json(archive+'/lock-before.json'),lock=json('package-lock.json');assert.deepEqual(Object.keys(before.packages).filter(p=>!lock.packages[p]).sort(),['node_modules/@playground/voxel-content','packages/voxel-content']);
for(const p of Object.keys(lock.packages))if(before.packages[p])for(const key of ['version','resolved','integrity'])assert.equal(lock.packages[p][key],before.packages[p][key],p+':'+key);
const result={result:'CONTENT_ASSETS_PREIMAGES_FROZEN_DECISIONS_CORRUPTION_SOURCE_LOCK_PUBLIC_BUILD_LOCAL_SQL_REACT_DEV_AND_BASELINE_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,copiedSources:v.sourceInputs.filter(f=>!f.inherited).length,retiredFiles:v.retiredSources.length,retiredAssets:1946,unchangedPublicFiles:574,productionFiles:750,fixtureFiles:7,artifacts:v.artifacts.length,priorArchiveUnchanged:true,productionGameRuntimeUnchanged:true,hostedReadOnlyQueries:3,hostedWrites:false,deployed:false};
fs.writeFileSync('games/voxel/test-results/content-assets-retirement-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
