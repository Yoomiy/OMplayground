import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import {Client,type Room} from 'colyseus.js';
import {WorkerDrivingLab} from '../client/src/lab/worker-driving-lab.js';
import {historyCommand} from '../client/tests/lab-history-fixture.js';
// Explicit source roots keep comparisons pinned and avoid mutating a release.
const oldRoot=process.env.TIMING_BASELINE_ROOT;
assert.ok(oldRoot,'TIMING_BASELINE_ROOT must point to the previous lab source snapshot');
const currentRoot=process.env.TIMING_CURRENT_ROOT ?? new URL('../',import.meta.url).pathname;
const duration=Number(process.env.TIMING_SECONDS ?? 6)*1000;
const latency=Number(process.env.TIMING_LATENCY_MS ?? 0);
const endpoint=process.env.LAB_TEST_ENDPOINT ?? 'ws://127.0.0.1:19001';
const {WorkerDrivingLab:OldLab}=await import(oldRoot+'/client/src/lab/worker-driving-lab.ts');
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const results:any[]=[];
const cases=process.env.TIMING_REVERSE === '1' ? ['combined','buffer','previous'] : ['previous','buffer','combined'];
for(const scenario of ['steady','stalls'])for(const name of cases){
 const client=new Client(endpoint);const room=await client.create('custom',{name:'Clock comparison'});room.onMessage('*',()=>{});
 const entry=pathToFileURL(name==='previous'?oldRoot+'/client/src/lab/prediction-worker.ts':currentRoot+'/client/src/lab/prediction-worker.ts').href;
 const thread=new Worker(new URL('./worker-benchmark-entry.mjs',import.meta.url),{workerData:{entryModule:entry},execArgv:['--conditions=development']});
 let messages=0,sends=0,drives=0,neutral=0,measured=false;
 const port:any={onmessage:null,onerror:null,terminate:()=>thread.terminate(),postMessage(data:any){if(measured&&data.kind==='drive')drives++;thread.postMessage(data)}};
 thread.on('message',data=>{if(measured){messages++;if(data.kind==='send'){sends++;if(data.message==='lab-neutral')neutral++;}}port.onmessage?.({data})});
 thread.on('error',e=>{throw e});
 const lab:any=name==='previous'?new OldLab(()=>port):new WorkerDrivingLab(()=>port);
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const later=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.delete(timer);fn()},ms);timers.add(timer)};
 const transport={sessionId:room.sessionId,onMessage(type:string,fn:(value:any)=>void){return room.onMessage(type,value=>later(()=>fn(value),latency))},onLeave(fn:()=>void){return room.onLeave(fn)},
  send(type:string,value:any){later(()=>room.send(type,value),latency)}} as unknown as Room;
 let clockCommand={...historyCommand};
 lab.attach(transport);lab.setMode('predicted');if(name==='combined')lab.startInputClock(()=>transport,()=>clockCommand);
 room.send('start-match');await wait(3400);
 let prior=performance.now(),frame=0,active=0,elapsed=0,maxPending=0,updateMs=0,workCpu:any;
 let firstWindow=0;const samples:any[]=[];let start=performance.now(),lastBlock=0;
 const update=setInterval(()=>{
  const now=performance.now(),dt=now-prior;prior=now;
  clockCommand={...historyCommand,steer:Math.sin((now-start)/800)*.35,boostHeld:Math.floor((now-start)/1800)%2===0};
  const before=performance.now();lab.update(transport,dt/1000,clockCommand,now);const cost=performance.now()-before;
  if(measured){const s=lab.getDebugState();frame++;elapsed+=dt;if(s.predictionActive)active+=dt;maxPending=Math.max(maxPending,s.pending);updateMs+=cost;samples.push({dt,active:s.predictionActive,age:s.predictionResultAgeMs??0});}
  if(measured&&scenario==='stalls'&&now-lastBlock>700){lastBlock=now;const until=performance.now()+260;while(performance.now()<until){}}
 },1000/30);
 try{
  const warmUntil=performance.now()+4000;while(!lab.getDebugState().predictedCar&&performance.now()<warmUntil)await wait(20);
  assert(lab.getDebugState().predictedCar);await wait(500);firstWindow=lab.exportTelemetry().at(-1)?.windowSequence ?? 0;start=performance.now();lastBlock=start;
  measured=true;workCpu=process.cpuUsage();await wait(duration);const cpu=process.cpuUsage(workCpu);measured=false;
  const windows=lab.exportTelemetry().filter((w:any)=>w.windowSequence>firstWindow&&w.phase==='playing');
  const counts:any={};for(const w of windows)for(const [k,v]of Object.entries(w.recoveryCounts))counts[k]=(counts[k]??0)+Number(v);
  const result={name,scenario,oneWayLatencyMs:latency,seconds:elapsed/1000,frames:frame,framesOver50ms:samples.filter(sample=>sample.dt>50).length,activePercent:100*active/elapsed,maxPending,workerMessages:messages,driveRequests:drives,neutralPackets:neutral,cpuMs:(cpu.user+cpu.system)/1000,mainUpdateMs:updateMs,counts,
    correctionsOver10cm:windows.reduce((n:number,w:any)=>n+w.carCorrectionsOver10cm,0),
    correctionsOver50cm:windows.reduce((n:number,w:any)=>n+w.carCorrectionsOver50cm,0),
    unalignedCorrections:windows.reduce((n:number,w:any)=>n+(w.unalignedCorrections??0),0),
    correctionSamples:windows.reduce((n:number,w:any)=>n+w.carCorrectionMeters.count,0),
    correctionMaxMeters:Math.max(0,...windows.map((w:any)=>w.carCorrectionMeters.max)),hardSnaps:windows.reduce((n:number,w:any)=>n+w.hardSnaps,0),error:lab.getDebugState().error,finalPending:lab.getDebugState().pending};
  assert.equal(result.error,null);assert(maxPending<=24);results.push(result);console.log(JSON.stringify(result));
 }finally{clearInterval(update);lab.stopInputClock?.();lab.detach();for(const timer of timers)clearTimeout(timer);await thread.terminate();await room.leave();}
}
writeFileSync(process.argv[2] ?? '.run/timing-comparison.json',JSON.stringify(results,null,2)+'\n');
