import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),destination='games/voxel/evidence/held-bucket';
assert(!fs.existsSync(destination),'Never overwrite an evidence archive');
const read=p=>fs.readFileSync(path.resolve(root,p)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const build=json('games/voxel/artifacts/build.json'),release=json('games/voxel/artifacts/release.json');
const visual=json('games/voxel/test-results/held-bucket/report.json'),game=json('games/voxel/test-results/browser-bucket.json');
assert.equal(visual.result,'PASS');assert.equal(game.result,'PASS');
for(const r of [visual,game,release])assert.equal(r.buildId,build.buildId);
assert.equal(visual.rendererSourceSha256,sha(read('games/voxel/src/render/held-block.ts')));
assert.equal(visual.cases.length,6);
for(const c of visual.cases){assert(c.waterPixels>=40&&c.shellMargin>=8);assert.equal(c.stalePixels,0);assert.equal(c.centerPixels,0);}
assert.deepEqual(visual.cleanup,{geometries:0,textures:0});assert.deepEqual(visual.errors,[]);assert.deepEqual(game.errors,[]);
assert.deepEqual(game.bucket.desktop.errors,[]);assert.equal(game.bucket.desktop.cleanup.audio,'closed');
assert(Object.values(game.bucket.desktop.cleanup.resources).every(n=>n===0));
assert.equal(game.cleanup.audio.contexts,0);assert.equal(game.cleanup.audio.state,'closed');
for(const key of ['geometries','textures','workers'])assert.equal(game.cleanup[key],0);
assert.equal(read('/tmp/voxel-held-core-check.exit').toString().trim(),'0');
const core=read('/tmp/voxel-held-core-check.log').toString();
for(const n of [91,85])assert.match(core,new RegExp('pass '+n));
assert.equal((core.match(/ℹ pass 41\n/g)||[]).length,2);assert.match(core,/80 passed; 0 failed; 3 ignored/);
assert.match(read('/tmp/voxel-held-service-tests.log').toString(),/pass 50/);
assert.match(read('/tmp/voxel-held-web-tests.log').toString(),/180 passed/);
for(const file of ['service-types','web-types'])assert.equal(read('/tmp/voxel-held-'+file+'.log').length,0);
assert.match(read('/tmp/voxel-held-web-build.log').toString(),/built in/);
const startup=json('/tmp/voxel-held-startup.json');assert.equal(startup.buildId,build.buildId);assert.equal(startup.statusRpcs.length,8);assert.equal(startup.remoteApplicationWrites,false);
const previous='games/voxel/evidence/media-composition',prior=json(previous+'/verification.json');
assert.equal(sha(read(previous+'/verification.json')),'09525ad797b46dbd42429f7f8f7b4b7c51fc9ecd85d1a0da69f1a2be22df01ac');
const inputs=prior.sourceInputs.map(f=>({path:f.path,sha256:sha(read(f.path)),priorSha256:f.sha256}));
const changed=inputs.filter(f=>f.sha256!==f.priorSha256);
assert.deepEqual(changed.map(f=>f.path).sort(),['games/voxel/package.json','games/voxel/src/render/held-block.ts','games/voxel/tools/browser-harness.ts','games/voxel/tools/browser-survival.ts']);
const artifacts=[];
function copy(input,output){const b=read(input),p=path.join(destination,output);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);const h=sha(b);artifacts.push({path:output,sha256:h});return h;}
for(const f of changed)copy(f.path,'sources/'+f.path);
const extras=['games/voxel/tools/browser-held-bucket.ts','games/voxel/tools/browser-survival-bucket.ts','games/voxel/tools/browser-bucket-mouse.ts','.github/workflows/voxel.yml','games/voxel/docs/content-progression.md','docs/voxel-runtime-rewrite-progress.md'];
const additionalSources=extras.map(p=>({path:p,sha256:copy(p,'sources/'+p)}));
const releaseFiles=[];
for(const [kind,dir]of[['client','dist-client'],['server','dist-server']])for(const f of release[kind]){
  const p='games/voxel/'+dir+'/'+f.path,h=copy(p,'release/'+dir+'/'+f.path);assert.equal(h,f.hash);releaseFiles.push({path:p,sha256:h});
}
const copies={'build.json':'games/voxel/artifacts/build.json','release.json':'games/voxel/artifacts/release.json','core.txt':'/tmp/voxel-held-core-check.log','core.exit':'/tmp/voxel-held-core-check.exit','service.txt':'/tmp/voxel-held-service-tests.log','service-types.txt':'/tmp/voxel-held-service-types.log','web-tests.txt':'/tmp/voxel-held-web-tests.log','web-types.txt':'/tmp/voxel-held-web-types.log','web-build.txt':'/tmp/voxel-held-web-build.log','release-verify.txt':'/tmp/voxel-held-release-verify.log','startup.json':'/tmp/voxel-held-startup.json','startup.mjs':'/tmp/voxel-held-startup.mjs','gameplay.txt':'/tmp/voxel-held-bucket-gameplay.log','gameplay.json':'games/voxel/test-results/browser-bucket.json','visual.txt':'/tmp/voxel-held-bucket-after.log','producer.mjs':'/tmp/voxel-held-capture.mjs','before/visual.txt':'/tmp/voxel-held-bucket-before.log','negative/framing.txt':'/tmp/voxel-held-bucket-clipped.log','negative/startup-config.txt':'/tmp/voxel-held-startup-config-negative.log'};
for(const [output,input]of Object.entries(copies))copy(input,output);
const walk=dir=>fs.readdirSync(path.resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
for(const [source,prefix]of[['games/voxel/test-results/held-bucket','visual'],['/tmp/voxel-held-bucket-before','before'],['/tmp/voxel-held-bucket-clipped','negative/framing']])for(const file of walk(source))copy(file,prefix+'/'+path.relative(source,file));
for(const name of fs.readdirSync('games/voxel/test-results'))if(/^bucket-.*\.png$/.test(name)&&name!=='bucket-failure.png')copy('games/voxel/test-results/'+name,'gameplay/'+name);
const webInventory=walk('apps/web/dist').sort().map(p=>({path:p,sha256:sha(read(p))})),webBytes=JSON.stringify(webInventory,null,2)+'\n';
fs.writeFileSync(path.join(destination,'web-inventory.json'),webBytes);artifacts.push({path:'web-inventory.json',sha256:sha(webBytes)});
const scope='Held-item presentation correction on matched game build; actual held renderer/native textures on software Chromium, natural bucket touch/OS desktop route, complete core/service/web checks and read-only hosted startup. No physical-device qualification, hosted Auth/gameplay writes, SFU recomposition, deployment or standalone web bundle.';
const note=`# Held bucket visibility and portrait framing

${scope}

The previous held renderer makes empty and filled buckets pixel-identical at
rest at all three measured viewports. The portrait screenshot shows almost all
of the model outside the right edge. Before bytes/results are retained.

The bucket now tilts its opening toward the camera at rest and uses a bounded
forward swing. Held items anchor and scale to the available horizontal room in
narrow viewports. At aspect ratios of at least 4:3, non-bucket pose is unchanged. No fluid physics,
inventory, authority or protocol change is made.

Six actual GPU raster cases cover 900×650, 390×780 and 768×1024, idle and swing,
using real native procedural texture arrays. Filled-only blue pixels, visible
shell margins, a clear reticle, repeated empty/filled switching without stale
pixels and zero geometry/texture cleanup all pass. The stricter intermediate
framing failure is retained rather than relabeled a pass.

Natural seed-4242 empty-inventory mining/refining/crafting, touch collect/place,
filled-bucket reconnect, same-identity trusted OS desktop reuse and teardown pass
on build ${build.buildId}. The complete game gate passes 91 domain, 80 native
(3 ignored), 85 Wasm and 41 source plus 41 packaged integration cases. All 50
service tests, 180 web tests, strict service/web types, production web build,
release verification and eight-status read-only hosted startup pass.

The archive copies 12 published game files, changed/new test/render inputs and
the reports/screenshots. Unchanged input bytes reference the immutable
media-composition archive; previous bucket evidence is also left unchanged.
Production web bytes are inventoried rather than copied. Current hosted Auth
write approval remains pending; automatic approval review rejected that separate
run. School/browser/SFU, extended progression/balance, device/network/capacity,
product ratification and full cutover/legacy removal remain required.
`;
fs.writeFileSync(path.join(destination,'README.md'),note);artifacts.push({path:'README.md',sha256:sha(note)});
const verification={result:'HELD_BUCKET_VISIBILITY_AND_MATCHED_RELEASE_PASS',capturedAt:new Date().toISOString(),buildId:build.buildId,runtimeHash:build.runtimeHash,scope,
 priorArchive:previous,priorVerificationSha256:sha(read(previous+'/verification.json')),priorBucketVerificationSha256:sha(read('games/voxel/evidence/bucket-browser/verification.json')),sourceInputs:inputs,additionalSources,changedInputs:changed.map(f=>f.path),releaseFiles,webInventoryFiles:webInventory.length,artifacts};
const bytes=JSON.stringify(verification,null,2)+'\n';fs.writeFileSync(path.join(destination,'verification.json'),bytes);
const pointer={result:verification.result,buildId:build.buildId,archive:destination,verificationSha256:sha(bytes),artifacts:artifacts.length,scope};
fs.writeFileSync('games/voxel/test-results/held-bucket-increment.json',JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));
