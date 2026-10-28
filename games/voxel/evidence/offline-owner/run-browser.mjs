import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
const repo='/home/ubuntu/OMplayground',build=JSON.parse(readFileSync(repo+'/games/voxel/artifacts/build.json','utf8')),results=[];
for(const [name,cwd,tool,extra] of [['tnt',repo+'/games/voxel','tools/browser-survival.ts',{VOXEL_SURVIVAL_TNT:'1'}],['observer',repo+'/apps/voxel-server','tools/browser-school.ts',{}],['release',repo+'/games/voxel','tools/verify-release.mjs',{}]]) {
 const startedAt=new Date().toISOString(),start=Date.now(),log='/tmp/voxel-owner-browser-'+name+'.log',fd=openSync(log,'w');
 const status=await new Promise(resolve=>{const child=spawn(process.execPath,[tool],{cwd,env:{...process.env,...extra},stdio:['ignore',fd,fd]});child.on('error',error=>resolve({exitCode:1,signal:null,error:error.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
 closeSync(fd);const result={name,tool,log,...status,startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync('/tmp/voxel-owner-browser-suite.json',JSON.stringify({buildId:build.buildId,results},null,2)+'\n');process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
