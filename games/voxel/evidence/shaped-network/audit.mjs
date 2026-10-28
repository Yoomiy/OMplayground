import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const staging=process.argv.includes('--staging');
const archive=staging?'/tmp/voxel-shaped-tcp-archive-stage':'games/voxel/evidence/shaped-network';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const pointer=json(staging?'/tmp/voxel-shaped-tcp-stage-pointer.json':'games/voxel/test-results/shaped-network.json'),v=json(archive+'/verification.json');
assert.equal(sha(read(archive+'/verification.json')),pointer.verificationSha256);
assert.equal(walk(archive).length,v.artifacts.length+1);
for(const f of v.artifacts)assert.equal(sha(read(archive+'/'+f.path)),f.sha256,f.path);
for(const f of v.sourceInputs){assert.equal(sha(read(f.path)),f.sha256,f.path);assert.equal(sha(read(archive+'/sources/'+f.path)),f.sha256,f.path);}
for(const f of v.releaseFiles)assert.equal(sha(read(f.path)),f.sha256,f.path);
const prior=json(v.priorArchive+'/verification.json');assert.equal(sha(read(v.priorArchive+'/verification.json')),v.priorVerificationSha256);
assert.equal(sha(read(archive+'/baseline-verification.json')),v.priorVerificationSha256);
for(const f of prior.artifacts)assert.equal(sha(read(v.priorArchive+'/'+f.path)),f.sha256,f.path);
assert.equal(v.buildId,prior.buildId);assert.equal(v.runtimeHash,prior.runtimeHash);assert.deepEqual(v.changedRuntime,[]);
assert.equal(v.productionRuntimeChanged,false);assert.equal(v.retainedPriorChecksRerun,false);assert.equal(v.physicalDeviceNetworkQualified,false);
const files=walk('games/voxel/src');assert.equal(sha(Buffer.concat(files.flatMap(p=>[Buffer.from(p.slice('games/voxel/'.length)),read(p)]))),v.runtimeHash);
for(const f of v.releaseFiles)assert.equal(f.sha256,prior.releaseFiles.find(p=>p.path===f.path).sha256);
assert.equal(json('games/voxel/artifacts/build.json').buildId,v.buildId);
for(const name of ['browser','domain','types','release','fixture'])assert.equal(read(archive+'/'+name+'.exit').toString().trim(),'0',name);
assert.match(read(archive+'/domain.txt').toString(),/ℹ pass 109\n/);assert.equal(read(archive+'/types.txt').length,0);
assert.match(read(archive+'/release.txt').toString(),/Verified current source\/content and 12 release files/);
const model=json(archive+'/calibration.json');assert.equal(model.result,'SHAPED_TCP_SHARED_RATE_ORDER_CLEAN_HALF_CLOSE_AND_CANCELLATION_PASS');assert.equal(model.cases.length,2);
function direction(d,profile){
 assert.equal(d.queuedBytes,0);assert.equal(d.flows,0);assert.equal(d.timers,0);
 assert(d.peakFlowQueuedBytes<=131072);assert(d.receivedBytes>=d.forwardedBytes);
 for(let n=0;n<d.trace.length;n++){
  const t=d.trace[n];assert(t.bytes>0&&t.bytes<=8192);assert(t.forwardedAt>=t.eligibleAt);
  assert(t.eligibleAt-t.receivedAt>=Math.max(0,profile.rttMs/2-profile.jitterMs)-.001);
  assert(t.eligibleAt-t.receivedAt<=profile.rttMs/2+profile.jitterMs+.001);
  if(n){const p=d.trace[n-1];assert(t.forwardedAt-p.forwardedAt>=p.bytes*8000/(profile.mbps*1e6)-.001);}
 }
}
const c=model.cases[0],total=c.streams*c.bytesPerStream;
assert.equal(c.streams,2);assert.equal(c.bytesPerStream,262144);
assert.equal(c.lowerBoundMs,2*total*8000/(c.profile.mbps*1e6)+c.profile.rttMs-2*c.profile.jitterMs-2*c.transport.packetBytes*8000/(c.profile.mbps*1e6)-5);
assert(c.elapsedMs>=c.lowerBoundMs);assert.equal(c.transport.up.forwardedBytes,total);assert.equal(c.transport.down.forwardedBytes,total);
for(const d of [c.transport.up,c.transport.down]){direction(d,c.profile);assert(d.readPauses>0);assert.equal(d.trace.length,32);}
assert.equal(c.transport.opened,2);assert.equal(c.transport.closed,2);assert.equal(c.transport.live,0);
const cancel=model.cases[1];assert(cancel.elapsedMs<500);assert.equal(cancel.transport.live,0);
for(const d of [cancel.transport.up,cancel.transport.down]){direction(d,cancel.transport.profile);assert.equal(d.forwardedBytes,0);}
const helper=read(archive+'/sources/games/voxel/tests/fixtures/tcp-shaper.ts').toString();
const paced='this.nextSendAt = now + (packet.length * 8000) / (this.profile.mbps * 1e6);';assert(helper.includes(paced));
assert.equal(read(archive+'/negative/unpaced.ts').toString(),helper.replace(paced,'this.nextSendAt = now;'));
assert.match(read(archive+'/negative/unpaced.txt').toString(),/assert\(elapsed >= lowerBoundMs\)/);assert.match(read(archive+'/negative/unpaced.txt').toString(),/ℹ fail 1\n/);
assert.equal(json(archive+'/negative/unpaced.json').result,'FAIL');
const browser=json(archive+'/browser.json');assert.equal(browser.buildId,v.buildId);assert.equal(browser.result,'SHAPED_TCP_NETWORK_MATRIX_FUNCTIONAL_PASS');
assert.equal(browser.configuration.freshBrowserProcessPerProfile,true);assert.equal(browser.profiles.length,3);
assert.deepEqual(browser.profiles.map(p=>p.profile),[{rttMs:50,jitterMs:0,mbps:10},{rttMs:100,jitterMs:25,mbps:10},{rttMs:150,jitterMs:0,mbps:10}]);
for(const p of browser.profiles){
 assert.equal(p.buildId,v.buildId);assert.equal(p.result,'SHAPED_TCP_BROWSER_JOIN_MOVEMENT_AND_RECONNECT_FUNCTIONAL_PASS');assert.deepEqual(p.errors,[]);
 for(const [key,target]of[['cold',8000],['warm',3000]]){const ready=p[key];assert.equal(ready.targetMs,target);assert(ready.elapsedMs>0);assert.equal(ready.budgetMet,ready.elapsedMs<=target);assert.equal(ready.columns,49);assert.equal(ready.collisionColumns,49);assert(ready.meshed>=25);}
 assert(p.warm.newEpoch>p.warm.oldEpoch);assert.equal(p.warm.admissions,2);
 const m=p.movement;assert.equal(m.samples.length,24);assert(m.framesSent>100);assert(m.after.tick>m.before.tick);assert(m.after.position[0]>m.before.position[0]+2);assert(m.settledAgreementMetres<.01);
 for(const s of m.samples){assert(Number.isFinite(s.inputLag)&&s.inputLag>=0&&s.inputLag<120);assert(Number.isFinite(s.correction)&&s.correction>=0);assert(s.lastReceivedAgoMs<1000);}
 assert.deepEqual(p.cleanup.resources,{geometries:0,textures:0,workers:0});assert.equal(p.cleanup.audio,'closed');
 assert.equal(p.cleanup.owners.liveWorkers,0);assert.equal(p.cleanup.owners.openedSockets,p.cleanup.owners.closedSockets);assert.equal(p.cleanup.owners.createdWorkers,p.cleanup.owners.closedWorkers);
 assert.equal(p.remainingRooms,0);assert.equal(p.transport.live,0);assert.equal(p.transport.opened,p.transport.closed);
 assert.equal(p.transport.packetBytes,8192);assert.equal(p.transport.flowBufferBytes,65536);assert.deepEqual(p.transport.profile,p.profile);
 assert(p.transport.down.forwardedBytes>1000000);assert(p.transport.up.forwardedBytes>1000);
 for(const d of [p.transport.up,p.transport.down])direction(d,p.profile);
}
const web=json(archive+'/web-inventory.json');for(const f of web)assert.equal(sha(read(f.path)),f.sha256,f.path);
const result={result:'SHAPED_TCP_SOURCE_RELEASE_MODEL_NEGATIVE_BROWSER_AND_PRIOR_IMMUTABILITY_AUDIT_PASS',checkedAt:new Date().toISOString(),buildId:v.buildId,verificationSha256:pointer.verificationSha256,sourceFiles:v.sourceInputs.length,releaseFiles:v.releaseFiles.length,artifacts:v.artifacts.length,webInventoryFiles:web.length,productionRuntimeUnchanged:true,priorArchiveUnchanged:true,domainTests:109,browserProfiles:3,localReadinessTargetsMet:browser.profiles.every(p=>p.cold.budgetMet&&p.warm.budgetMet),physicalDeviceNetworkQualified:false,scope:v.scope};
fs.writeFileSync(staging?'/tmp/voxel-shaped-tcp-stage-audit.json':'games/voxel/test-results/shaped-network-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
