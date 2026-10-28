import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync} from 'node:fs';
const startedAt=new Date().toISOString(),start=Date.now(),fd=openSync('/tmp/voxel-school-core-complete-check.log','w');
const status=await new Promise(resolve=>{const child=spawn('npm',['run','check'],{cwd:'/home/ubuntu/OMplayground/games/voxel',stdio:['ignore',fd,fd]});child.on('error',error=>resolve({exitCode:1,signal:null,error:error.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
closeSync(fd);const record={...status,startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start};writeFileSync('/tmp/voxel-school-core-complete-check.exit.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));process.exitCode=status.exitCode??1;
