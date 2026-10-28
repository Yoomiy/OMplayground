import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const repo=process.cwd(),stage=fs.mkdtempSync('/tmp/voxel-reference-fixture-');
const game=path.join(stage,'games/voxel');
fs.mkdirSync(path.join(game,'tools'),{recursive:true});
fs.mkdirSync(path.join(game,'docs'),{recursive:true});
for(const name of ['inventory-legacy-content.ts','check-content-disposition.ts','compile-content.ts'])
  fs.copyFileSync(path.join(repo,'games/voxel/tools',name),path.join(game,'tools',name));
fs.cpSync(path.join(repo,'games/voxel/content'),path.join(game,'content'),{recursive:true});
fs.cpSync(path.join(repo,'games/voxel/docs/legacy-content-reference'),path.join(game,'docs/legacy-content-reference'),{recursive:true});
fs.symlinkSync(path.join(repo,'games/voxel/src'),path.join(game,'src'),'dir');
fs.symlinkSync(path.join(repo,'games/voxel/node_modules'),path.join(game,'node_modules'),'dir');
const sha=b=>createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(path.join(game,'docs/legacy-content-reference/blocks.ts.txt'));
const runs=[];
function run(name,tool,expected){
  const result=spawnSync(process.execPath,[path.join(game,'tools',tool)],{cwd:game,encoding:'utf8',timeout:30000});
  const log='/tmp/voxel-legacy-content-'+name+'.log';
  fs.writeFileSync(log,result.stdout+result.stderr);
  assert.equal(result.signal,null,name);assert.equal(result.error,undefined,name);
  if(expected===0)assert.equal(result.status,0,result.stderr);else assert.notEqual(result.status,0,name);
  runs.push({name,exitCode:result.status,log,sha256:sha(fs.readFileSync(log))});
  return result;
}
run('fixture-regenerate','inventory-legacy-content.ts',0);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(game,'content/legacy-inventory.json'))),JSON.parse(fs.readFileSync(path.join(repo,'games/voxel/content/legacy-inventory.json'))));
run('fixture-audit','check-content-disposition.ts',0);
fs.appendFileSync(path.join(game,'docs/legacy-content-reference/blocks.ts.txt'),'\n// corrupted fixture source\n');
const regenerate=run('corrupt-regenerate','inventory-legacy-content.ts',1);
assert.match(regenerate.stderr,/Frozen legacy source changed/);
const audit=run('corrupt-audit','check-content-disposition.ts',1);
assert.match(audit.stderr,/changed legacy source/);
assert.equal(sha(fs.readFileSync(path.join(repo,'games/voxel/docs/legacy-content-reference/blocks.ts.txt'))),sha(original));
const report={result:'FROZEN_SOURCE_REGENERATION_AND_AUDIT_REJECT_CORRUPTION',stage,runs,liveSourceUnchanged:true};
fs.writeFileSync('/tmp/voxel-legacy-content-negative.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
