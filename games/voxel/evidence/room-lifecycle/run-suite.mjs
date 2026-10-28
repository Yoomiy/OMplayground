import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
const repo='/home/ubuntu/OMplayground',game=repo+'/games/voxel',app=repo+'/apps/voxel-server',pg='/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin';
const build=JSON.parse(readFileSync(game+'/artifacts/build.json','utf8')),results=[];
const pgEnv={LD_LIBRARY_PATH:'/tmp/voxel-postgres-runtime/usr/lib/aarch64-linux-gnu',VOXEL_TEST_POSTGRES:'1',VOXEL_PG_BIN:pg,PGHOST:'127.0.0.1',PGPORT:'55439',PGUSER:'ubuntu'};
const tasks=[
 ['school-gateway',app,process.execPath,['--test','tests/integration/*.test.ts'],{}],
 ['postgres-start',repo,pg+'/pg_ctl',['-D','/tmp/voxel-postgres-data','-l','/tmp/voxel-postgres-server.log','-o','-h 127.0.0.1 -p 55439 -k /tmp/voxel-postgres-socket','start'],pgEnv],
 ['postgres',app,process.execPath,['--test','--test-concurrency=1','tests/postgres/*.test.ts'],pgEnv],
 ['postgres-stop',repo,pg+'/pg_ctl',['-D','/tmp/voxel-postgres-data','stop','-m','fast'],pgEnv],
 ['observer',app,process.execPath,['tools/browser-school.ts'],{}],
 ['creative',game,process.execPath,['tools/browser-creative.ts'],{}],
 ['inventory',game,process.execPath,['tools/browser-inventory.ts'],{}],
 ['tnt',game,process.execPath,['tools/browser-survival.ts'],{VOXEL_SURVIVAL_TNT:'1'}],
 ['release',game,process.execPath,['tools/verify-release.mjs'],{}],
];
for(const [name,cwd,command,args,extra] of tasks){
 if(name==='postgres'&&results.find(r=>r.name==='postgres-start')?.exitCode!==0){results.push({name,exitCode:1,skipped:true});continue;}
 const log='/tmp/voxel-lifecycle-'+name+'.log',fd=openSync(log,'w'),startedAt=new Date().toISOString(),start=Date.now();
 const status=await new Promise(resolve=>{const child=spawn(command,args,{cwd,env:{...process.env,...extra},stdio:['ignore',fd,fd]});child.on('error',error=>resolve({exitCode:1,signal:null,error:error.message}));child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));});
 closeSync(fd);const result={name,log,...status,startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync('/tmp/voxel-lifecycle-final-suite.json',JSON.stringify({buildId:build.buildId,results},null,2)+'\n');process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
