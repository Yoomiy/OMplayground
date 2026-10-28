import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[
 ['inventory','npm',['--prefix','games/voxel','run','inventory:legacy']],
 ['content','npm',['--prefix','games/voxel','run','check:content:complete']],
 ['boundaries','npm',['--prefix','games/voxel','run','check:boundaries']],
 ['release','node',['games/voxel/tools/verify-release.mjs']],
 ['game-types','node',['games/voxel/node_modules/typescript/bin/tsc','--noEmit','-p','games/voxel/tsconfig.json']],
 ['domain','npm',['--prefix','games/voxel','test']],
 ['wasm','npm',['--prefix','games/voxel','run','test:wasm']],
 ['web-types','node',['node_modules/typescript/bin/tsc','--noEmit','-p','apps/web/tsconfig.json']],
 ['service-types','node',['node_modules/typescript/bin/tsc','--noEmit','-p','apps/voxel-server/tsconfig.json']],
 ['web-build','npm',['run','build','--workspace','@playground/web']],
];
const report={startedAt:new Date().toISOString(),checks:[]};
for(const [name,command,args]of checks){
 const log='/tmp/voxel-legacy-content-'+name+'.log',fd=fs.openSync(log,'w'),startedAt=new Date().toISOString();
 const exitCode=await new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(name+':'+signal)):resolve(code));});
 fs.closeSync(fd);
 report.checks.push({name,command,args,startedAt,endedAt:new Date().toISOString(),exitCode,log,sha256:sha(fs.readFileSync(log))});
 fs.writeFileSync('/tmp/voxel-legacy-content-checks.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({name,exitCode}));assert.equal(exitCode,0,name);
}
report.endedAt=new Date().toISOString();report.result='FROZEN_REFERENCE_CONTENT_TYPES_DOMAIN_WASM_AND_APP_PASS';
fs.writeFileSync('/tmp/voxel-legacy-content-checks.json',JSON.stringify(report,null,2)+'\n');
