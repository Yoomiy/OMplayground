import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
const root='/home/ubuntu/OMplayground/games/voxel',script=process.argv[2];
const allowed=['test:equipment:browser','test:tnt:browser','test:combat:browser','test:survival:browser','test:touch:browser','test:creative:browser','test:inventory:browser','test:presentation:browser','test:environment:browser','test:recovery:browser','test:browser'];
assert.ok(allowed.includes(script));
const file='/tmp/voxel-whole-room-browser-suite.json',build=JSON.parse(readFileSync(`${root}/artifacts/build.json`));
const suite=existsSync(file)?JSON.parse(readFileSync(file)):{buildId:build.buildId,startedAt:new Date().toISOString(),active:null,checks:[]};
assert.equal(suite.buildId,build.buildId);assert.equal(suite.active,null);
const prior=suite.checks.find(check=>check.script===script);
if(prior){assert.equal(process.argv[3],'--retry');const suffix=`.prior-${suite.historicalChecks?.length??0}`;copyFileSync(prior.path,`${prior.path}${suffix}`);copyFileSync(`${prior.path}.exit.json`,`${prior.path}.exit.json${suffix}`);suite.historicalChecks=[...(suite.historicalChecks??[]),{...prior,retainedLog:`${prior.path}${suffix}`}];suite.checks=suite.checks.filter(check=>check.script!==script);delete suite.finishedAt;}
const startedAt=new Date().toISOString(),started=Date.now(),path=`/tmp/voxel-whole-room-suite-${script.replaceAll(':','-')}.log`;
const save=()=>writeFileSync(file,JSON.stringify(suite,null,2)+'\n');suite.active=script;save();
const log=openSync(path,'w');
const status=await new Promise(resolve=>{const child=spawn('npm',['run',script],{cwd:root,stdio:['ignore',log,log]});child.on('error',error=>resolve({code:1,signal:null,error:error.message}));child.on('close',(code,signal)=>resolve({code,signal}));});closeSync(log);
const check={script,path,...status,startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-started};suite.checks.push(check);suite.active=null;if(suite.checks.length===allowed.length)suite.finishedAt=new Date().toISOString();save();writeFileSync(`${path}.exit.json`,JSON.stringify({...check,buildId:build.buildId},null,2)+'\n');console.log(JSON.stringify(check));process.exitCode=status.code??1;
