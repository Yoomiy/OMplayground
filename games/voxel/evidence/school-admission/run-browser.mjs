import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
const cwd='/home/ubuntu/OMplayground/games/voxel', build=JSON.parse(readFileSync(cwd+'/artifacts/build.json','utf8')), results=[];
for(const [name,tool] of [['wasm','browser-smoke.ts'],['creative','browser-creative.ts'],['inventory','browser-inventory.ts'],['benchmark','benchmark-engine.ts'],['release','verify-release.mjs']]) {
 const startedAt=new Date().toISOString(),start=Date.now(),log='/tmp/voxel-school-browser-'+name+'.log',fd=openSync(log,'w');
 const status=await new Promise(resolve=>{const child=spawn(process.execPath,['tools/'+tool],{cwd,stdio:['ignore',fd,fd]});child.on('error',error=>resolve({exitCode:1,signal:null,error:error.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
 closeSync(fd);const result={name,tool,log,...status,startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync('/tmp/voxel-school-browser-suite.json',JSON.stringify({buildId:build.buildId,results},null,2)+'\n');process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
