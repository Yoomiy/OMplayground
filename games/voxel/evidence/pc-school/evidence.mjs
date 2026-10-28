import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const archive='games/voxel/evidence/pc-school',base='games/voxel/evidence/shaped-network';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const baseDigest='f52794b47a72c7826d8913fbf2e4eefdaebe869e476674b35affd05184e5fb79';
function desktop(r){
 assert.equal(r.result,'PASS');assert.equal(r.buildId,'7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc');
 assert.deepEqual(r.configuration.networkProfile,{rttMs:100,jitterMs:25,mbps:10});assert.equal(r.configuration.hostedWrites,false);
 assert.equal(r.harvested.length,5);assert.equal(r.completed.inventory.catalog,false);
 assert.equal(r.placement.outcome.ok,true);assert.equal(r.placement.outcome.reason,'edited');
 assert.equal(r.food.hungry.food,19);assert.equal(r.food.after.food,20);
 for(const [slot,item]of[[3,'trail_boots'],[4,'heavy_shield']])assert.equal(r.completed.inventory.equipment[slot].itemType,item);
 const e=r.desktopInput;assert(e.moves>0&&e.lockedPrimary>=6&&e.lockedSecondary>0);assert.equal(e.untrusted,0);
 assert(e.keys.KeyW>0&&e.keys.KeyE>0&&e.keys.Space>0);assert(Object.entries(e.keys).some(([k,n])=>/^Digit[1-9]$/.test(k)&&n>0));
 assert(e.samples.length<=128);assert(e.samples.every(s=>s.trusted));
 for(const c of [r.cleanup,r.remoteEquipment.cleanup]){for(const key of['geometries','textures','workers'])assert.equal(c[key],0);assert.equal(c.audio.state,'closed');assert.equal(c.audio.contexts,0);assert.equal(c.audio.voices,0);}
 assert(r.remoteEquipment.reconnected);assert.equal(r.cleanup.owners.liveWorkers,0);
 assert.equal(r.cleanup.owners.openedSockets,r.cleanup.owners.closedSockets);assert.equal(r.cleanup.owners.createdWorkers,r.cleanup.owners.closedWorkers);
 assert.equal(r.transport.opened,r.transport.closed);assert.equal(r.transport.live,0);assert.equal(r.remainingRooms,0);assert.deepEqual(r.errors,[]);
 for(const d of[r.transport.up,r.transport.down]){assert.equal(d.queuedBytes,0);assert.equal(d.timers,0);assert.equal(d.flows,0);assert(d.peakFlowQueuedBytes<=131072);}
}
function baseCheck(){
 assert.equal(sha(read(base+'/verification.json')),baseDigest);
 const p=json(base+'/verification.json');for(const f of p.artifacts)assert.equal(sha(read(base+'/'+f.path)),f.sha256,f.path);
 return p;
}
if(!process.argv.includes('--audit')){
 assert(!fs.existsSync(archive),'Never overwrite an archive');const prior=baseCheck();
 desktop(json('games/voxel/test-results/browser-survival-desktop.json'));
 for(const name of['browser','types','release'])assert.equal(read('/tmp/voxel-school-desktop-'+name+'.exit').toString().trim(),'0',name);
 assert.equal(read('/tmp/voxel-school-survival-shaper.exit').toString().trim(),'0');
 assert.equal(read('/tmp/voxel-school-desktop-types.log').length,0);
 assert.match(read('/tmp/voxel-school-survival-shaper.log').toString(),/ℹ pass 2\n/);
 const build=json('games/voxel/artifacts/build.json');assert.equal(build.buildId,prior.buildId);
 const runtimeFiles=walk('games/voxel/src'),runtimeHash=sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)])));
 assert.equal(runtimeHash,prior.runtimeHash);
 for(const f of prior.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
 const additions=['docs/voxel-runtime-rewrite-proposal.md','games/voxel/tools/browser-desktop-input.ts','games/voxel/docs/pc-school.md'];
 const paths=[...new Set([...prior.sourceInputs.map(f=>f.path),...additions])].sort();
 const copies={
  'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json',
  'desktop.json':'games/voxel/test-results/browser-survival-desktop.json','desktop.txt':'/tmp/voxel-school-desktop-browser.log',
  'types.txt':'/tmp/voxel-school-desktop-types.log','release.txt':'/tmp/voxel-school-desktop-release.log',
  'fixture.txt':'/tmp/voxel-school-survival-shaper.log','fixture.exit':'/tmp/voxel-school-survival-shaper.exit',
  'negative/driver.ts':'/tmp/voxel-school-desktop-owner-negative.ts','negative/report.json':'/tmp/voxel-school-desktop-owner-negative.json','negative/driver.txt':'/tmp/voxel-school-desktop-owner-negative.log',
  'private-display.zsh':'/tmp/voxel-school-desktop-run.zsh','xvfb.txt':'/tmp/voxel-school-desktop-xvfb.log',
  'README.md':'games/voxel/docs/pc-school.md','evidence.mjs':'/tmp/voxel-pc-school-evidence.mjs',
 };
 for(const name of['browser','types','release'])copies[name+'.exit']='/tmp/voxel-school-desktop-'+name+'.exit';
 for(const p of[...paths,...Object.values(copies)])assert(fs.statSync(p).isFile(),p);
 const artifacts=[];
 const copy=(input,out)=>{const b=read(input),target=archive+'/'+out;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);const sha256=sha(b);artifacts.push({path:out,sha256});return sha256;};
 const sourceInputs=paths.map(p=>{
  const sha256=sha(read(p)),old=prior.sourceInputs.find(f=>f.path===p);
  if(old?.sha256===sha256)return{path:p,sha256,snapshotPath:base+'/sources/'+p,inherited:true};
  copy(p,'sources/'+p);return{path:p,sha256,snapshotPath:archive+'/sources/'+p,inherited:false};
 });
 for(const [out,input]of Object.entries(copies))copy(input,out);
 const v={result:'PC_FIRST_PRIVATE_SCHOOL_SURVIVAL_AND_TRUSTED_INPUT_VERIFIED_LOCALLY',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash,baseArchive:base,baseVerificationSha256:baseDigest,sourceInputs,releaseFiles:prior.releaseFiles,artifacts,qualified:{trustedDesktopJourney:1,focusedRelayTests:2,strictGameTypes:true,unchangedProductionRelease:true},userScope:{primaryDevice:'PC',mobileTabletRequired:false,syntheticScaleRequired:false,headcountCapsAdded:false},physicalSchoolPcPerformanceMeasured:false,hostedWrites:false,scope:'Natural empty-inventory survival and independent peer gear/reconnect through trusted OS keyboard/pointer-lock mouse input in a private software display, over local 100ms data RTT/jitter/shared 10Mbps byte shaping. PC-first school workflows replace large synthetic scale/mobile release gates. Prior source snapshots and release qualification are inherited by exact hashes; production runtime is unchanged. Physical school-PC and actual hosted workflows, product decisions and cutover/retirement remain.'};
 const b=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(archive+'/verification.json',b);
 fs.writeFileSync('games/voxel/test-results/pc-school.json',JSON.stringify({result:v.result,archive,buildId:v.buildId,verificationSha256:sha(b)},null,2)+'\n');
}
const v=json(archive+'/verification.json'),pointer=json('games/voxel/test-results/pc-school.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);assert.equal(walk(archive).length,v.artifacts.length+1);baseCheck();
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(f.snapshotPath)),f.sha256,f.snapshotPath);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const runtimeFiles=walk('games/voxel/src');assert.equal(sha(Buffer.concat(runtimeFiles.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
desktop(json(archive+'/desktop.json'));
for(const name of['browser','types','release','fixture'])assert.equal(read(archive+'/'+name+'.exit').toString().trim(),'0');
assert.equal(read(archive+'/types.txt').length,0);assert.match(read(archive+'/fixture.txt').toString(),/ℹ pass 2\n/);
assert.match(read(archive+'/release.txt').toString(),/Verified current source\/content and 12 release files/);
assert.equal(json(archive+'/negative/report.json').result,'FAIL');assert.match(read(archive+'/negative/driver.txt').toString(),/mouse look requires owned pointer lock/);
const proposal=read('docs/voxel-runtime-rewrite-proposal.md').toString();assert.match(proposal,/students mostly use PCs/);assert.match(proposal,/128-player profiles are historical diagnostics/);
assert.equal(v.userScope.mobileTabletRequired,false);assert.equal(v.userScope.syntheticScaleRequired,false);assert.equal(v.hostedWrites,false);
const result={result:'PC_SCHOOL_ARCHIVED_SOURCE_TRUSTED_INPUT_OWNED_SURVIVAL_CLEANUP_AND_BASELINE_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,copiedSources:v.sourceInputs.filter(f=>!f.inherited).length,artifacts:v.artifacts.length,retainedReleaseFiles:v.releaseFiles.length,priorArchiveUnchanged:true,productionRuntimeUnchanged:true,physicalSchoolPcPerformanceMeasured:false,userScope:v.userScope};
fs.writeFileSync('games/voxel/test-results/pc-school-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
