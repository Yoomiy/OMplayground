import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root='/home/ubuntu/OMplayground/games/voxel';
const jsonFile=path=>JSON.parse(readFileSync(path,'utf8'));
const json=path=>jsonFile(`${root}/${path}`);
const result=spawnSync(process.execPath,['tools/verify-release.mjs'],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);process.stdout.write(result.stdout);
const build=json('artifacts/build.json'),suite=jsonFile('/tmp/voxel-appearance-browser-suite.json'),check=jsonFile('/tmp/voxel-appearance-complete-check.exit.json');
const expected=['test:equipment:browser','test:tnt:browser','test:combat:browser','test:survival:browser','test:touch:browser','test:creative:browser','test:inventory:browser','test:presentation:browser','test:environment:browser','test:recovery:browser','test:browser'];
assert.equal(suite.buildId,build.buildId);assert.equal(suite.active,null);assert.ok(suite.finishedAt);assert.deepEqual(suite.checks.map(c=>c.script).sort(),expected.sort());
for(const entry of suite.checks){assert.equal(entry.code,0,entry.script);assert.equal(entry.signal,null);}
assert.equal(check.exitCode,0);assert.ok(check.finishedAt);
const log=readFileSync('/tmp/voxel-appearance-complete-check.log','utf8');for(const marker of [`Voxel build ${build.buildId.slice(0,12)}`,'ℹ tests 54','79 passed; 0 failed; 3 ignored','ℹ tests 51','ℹ tests 6'])assert.ok(log.includes(marker),marker);
const files=new Map([['artifacts/build.json','build.json'],['artifacts/release.json','release.json'],['test-results/release-verification.json','source-release-verification.json'],...['survival-drop','survival-crafting','survival-tool','combat-death','combat-respawn','tnt-fuse','tnt-crater','equipment-night-before','equipment-night-after','avatar-held','remote-equipment-night','remote-equipment-survival','remote-equipment-creative'].map(name=>[`test-results/${name}.png`,`${name}.png`])]);
for(const name of ['browser-equipment','browser-tnt','browser-combat','browser-survival','browser-touch','browser-creative','browser-inventory','browser-presentation','browser-environment','browser-worker-recovery','browser-wasm']){
 const report=json(`test-results/${name}.json`);assert.equal(report.result,'PASS',name);assert.deepEqual(report.errors,[],name);
 for(const identity of name==='browser-environment'?report.results:[report]){if(name!=='browser-wasm')assert.equal(identity.buildId,build.buildId,name);assert.equal(identity.engineHash,build.engineHash,name);assert.equal(identity.contentHash,build.contentHash,name);}
 files.set(`test-results/${name}.json`,`${name}.json`);
}
const screenshotRuns = new Map([
 ...['survival-drop','survival-crafting','survival-tool','tnt-fuse','tnt-crater'].map(name=>[name,'test:tnt:browser']),
 ...['combat-death','combat-respawn'].map(name=>[name,'test:combat:browser']),
 ...['equipment-night-before','equipment-night-after','remote-equipment-night'].map(name=>[name,'test:equipment:browser']),
 ['remote-equipment-survival','test:survival:browser'],['avatar-held','test:presentation:browser'],['remote-equipment-creative','test:presentation:browser']
]);
const screenshots=[...screenshotRuns].map(([name,script])=>{
 const entry=suite.checks.find(check=>check.script===script),mtime=statSync(`${root}/test-results/${name}.png`).mtimeMs;
 assert.ok(mtime>=Date.parse(entry.startedAt)-1000&&mtime<=Date.parse(entry.finishedAt)+1000,`${name}: screenshot must come from its terminal passing scenario`);
 return{path:`${name}.png`,script,startedAt:entry.startedAt,finishedAt:entry.finishedAt,sourceModifiedAt:new Date(mtime).toISOString()};
});
const logs=new Map([['/tmp/voxel-appearance-workbench-occlusion-scenario.ts','workbench-occlusion-scenario.ts'],['/tmp/voxel-capture-appearance.mjs','capture.mjs'],['/tmp/voxel-archive-appearance.py','archive.py'],['/tmp/voxel-appearance-complete-check.log','check.txt'],['/tmp/voxel-appearance-complete-check.exit.json','check-exit.json'],['/tmp/voxel-appearance-browser-suite.json','browser-suite.json'],...suite.checks.flatMap(entry=>[[entry.path,`${entry.script.replaceAll(':','-')}.txt`],[`${entry.path}.exit.json`,`${entry.script.replaceAll(':','-')}-exit.json`]]),...(suite.historicalChecks??[]).flatMap((entry,index)=>[[entry.retainedLog,`historical-browser-${index}.txt`],[entry.retainedLog.replace('.log.prior-','.log.exit.json.prior-'),`historical-browser-${index}-exit.json`]])]);
function collect(dir,prefix){for(const entry of readdirSync(dir,{withFileTypes:true})){const src=`${dir}/${entry.name}`,dest=`${prefix}/${entry.name}`;if(entry.isDirectory())collect(src,dest);else if(entry.isFile())logs.set(src,dest);else throw new Error('unexpected development artifact type');}}
collect('/tmp/voxel-appearance-pre-catalog-history','pre-catalog-history');collect('/tmp/voxel-appearance-pre-warmup-history','pre-warmup-history');
const destination=`${root}/evidence/appearance`;mkdirSync(destination,{recursive:true});
function copy(src,dest){const path=`${destination}/${dest}`;mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});copyFileSync(src,path);}
for(const [src,dest] of files)copy(`${root}/${src}`,dest);for(const [src,dest] of logs)copy(src,dest);
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const scenarios=['tests/appearance.test.ts','tests/avatar-equipment.test.ts','tests/wasm/appearance.test.ts','tools/browser-remote-equipment.ts','tests/gpu-pacing.test.ts','tests/equipment.test.ts','tests/wasm/equipment.test.ts','tests/explosives.test.ts','tests/wasm/explosives.test.ts','tests/combat.test.ts','tests/wasm/combat.test.ts','tests/wasm/room-fixture.ts','tests/wasm/fixture.ts','tools/browser-combat.ts','tools/browser-harness.ts','tests/vitals.test.ts','tests/wasm/prediction.test.ts','tests/survival.test.ts','tests/wasm/survival.test.ts','tests/authority.test.ts','tests/integration/creative.test.ts','tools/browser-survival.ts','tools/browser-touch.ts','tools/browser-creative.ts','tools/browser-inventory.ts','tools/browser-presentation.ts','tools/browser-environment.ts','tools/browser-worker-recovery.ts','tools/browser-smoke.ts','tools/wasm-scenario.mjs'];
writeFileSync(`${destination}/verification.json`,JSON.stringify({result:'PASS_WITH_RETAINED_DEVELOPMENT_HISTORY',capturedAt:new Date().toISOString(),buildId:build.buildId,engineHash:build.engineHash,contentHash:build.contentHash,matchedReleaseFiles:json('test-results/release-verification.json').matchedReleaseFiles,checksExitCode:check.exitCode,browserExitCodes:suite.checks.map(({script,code,signal})=>({script,code,signal})),limitations:'Functional software Chromium/SwiftShader evidence only. Hardware performance/touch/audio, OS focus, latency, long-session load, durable timers/checkpoints, complete content/balance, school/platform integration remain unqualified. Historical development builds and natural-route failures are retained separately from the final release outcomes, including the exact earlier passing two-client night scenario before creative catalog replication and the camera submission wait refinement.',screenshots,scenarios:scenarios.map(path=>({path,hash:hash(`${root}/${path}`)})),files:[...files.values(),...logs.values()].sort().map(path=>({path,hash:hash(`${destination}/${path}`)}))},null,2)+'\n');
console.log(`Captured ${files.size+logs.size} files for ${build.buildId.slice(0,12)} with ${scenarios.length} scenario hashes`);
