import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { Worker } from 'node:worker_threads';
import { nodeLabWorker } from './node-lab-worker.mts';
import { PHYSICS } from '@rocket-arena/shared';
import type { Room } from 'colyseus.js';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { historyFixture, historyCommand } from '../client/tests/lab-history-fixture.js';
import { WorkerDrivingLab } from '../client/src/lab/worker-driving-lab.js';

// Baseline source is supplied explicitly; benchmarks never silently compare a
// worker with an already-modified algorithm. Both use the same current physics.
const baselinePath=process.env.WORKER_BENCH_BASELINE;
assert.ok(baselinePath,'WORKER_BENCH_BASELINE must point to the pinned prediction.ts');
const { DrivingLab: Baseline }=await import(baselinePath);
const duration=Number(process.env.WORKER_BENCH_SECONDS ?? 8)*1_000;
const physicsStepMs=5;
const summaries:Record<string,unknown>={};
for(const mode of ['baseline','worker'] as const) {
  const fixture=await historyFixture();
  const core=fixture.core;
  fixture.lab.detach();
  const handlers=new Map<string,(value:any)=>void>();
  const timers=new Set<ReturnType<typeof setTimeout>>();
  let inputCount=0,snapshotCount=0,round=0;
  const later=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.delete(timer);fn()},ms);timers.add(timer)};
  const room={sessionId:'driver',onMessage(type:string,fn:(value:any)=>void){handlers.set(type,fn)},onLeave(){},
    send(type:string,value:any){
      if(type==='lab-input'||type==='lab-neutral') { inputCount++;later(()=>core.submitPredictionInput('driver',value),[25,35,45,30][inputCount%4]); }
      if(type==='lab-ping') later(()=>handlers.get('lab-pong')?.(value),70);
    }} as unknown as Room;
  let thread:Worker|null=null;
  const originalStep=PredictionWorld.prototype.step;
  const lab=mode==='baseline'?new Baseline():new WorkerDrivingLab(()=>{
    const adapter=nodeLabWorker(physicsStepMs);thread=adapter.thread;return adapter.port;
  });
  if(mode==='baseline') PredictionWorld.prototype.step=function(...args){const started=performance.now();originalStep.apply(this,args);while(performance.now()-started<physicsStepMs){}};
  lab.attach(room);
  let lastServer=performance.now(),previousFrame=performance.now();
  let measured=false,frames=0,activeMs=0,frameMs=0,maxPending=0,maxResultAge=0,maxMailbox=0,maxLag=0;
  const updateTimes:number[]=[];
  const server=setInterval(()=>{
    const now=performance.now();core.advanceSimulation(now-lastServer);lastServer=now;
    if(++round%2===0){const frame=structuredClone(core.buildPredictionFrame()!);snapshotCount++;later(()=>handlers.get('prediction-state')?.(frame),[25,40,35,50][snapshotCount%4]);}
  },PHYSICS.TIMESTEP*1_000);
  const render=setInterval(()=>{
    const now=performance.now(),dt=now-previousFrame;previousFrame=now;
    const before=lab.getDebugState();
    const start=performance.now();
    lab.update(room,dt/1_000,{...historyCommand,steer:Math.sin(now/700)*.3,boostHeld:Math.floor(now/1_500)%2===0},now);
    if(measured){
      frames++;frameMs+=dt;if(before.predictionActive)activeMs+=dt;
      updateTimes.push(performance.now()-start);
      const state=lab.getDebugState();maxPending=Math.max(maxPending,state.pending);
      maxResultAge=Math.max(maxResultAge,state.predictionResultAgeMs??0);maxMailbox=Math.max(maxMailbox,state.workerInFlight??0);maxLag=Math.max(maxLag,state.predictionLagInputs??0);
    }
  },1_000/30);
  try {
    await new Promise(resolve=>setTimeout(resolve,1_000));measured=true;
    await new Promise(resolve=>setTimeout(resolve,duration));measured=false;
    const state=lab.getDebugState();
    updateTimes.sort((a,b)=>a-b);
    const rows=lab.exportTelemetry();
    const result={physicsStepMs,frames,measuredSeconds:frameMs/1_000,fps:frames/frameMs*1_000,
      predictionActivePercent:activeMs/frameMs*100,mainUpdateMeanMs:updateTimes.reduce((a,b)=>a+b,0)/updateTimes.length,
      mainUpdateP95Ms:updateTimes[Math.floor(updateTimes.length*.95)],maxPending,maxResultAgeMs:maxResultAge,maxMailbox,maxLag,
      recoveries:state.recoveries,cpuBudgetRecoveries:rows.reduce((n:number,r:any)=>n+r.recoveryCounts.cpu_budget,0),
      catchupYields:state.catchupYields??0,sequence:state.sequence,acknowledgedSequence:state.acknowledgedSequence,error:state.error};
    summaries[mode]=result;
    assert.equal(result.error,null);
    assert.ok(maxPending<=24);
    if(mode==='worker'){assert.ok(result.predictionActivePercent>70,JSON.stringify(result));assert.equal(result.cpuBudgetRecoveries,0);assert.ok(result.catchupYields>10);assert.ok(maxMailbox<=1)}
  } finally {
    clearInterval(server);clearInterval(render);for(const timer of timers)clearTimeout(timer);
    lab.detach();if(thread)await thread.terminate();PredictionWorld.prototype.step=originalStep;core.dispose();
  }
}
console.log(JSON.stringify(summaries,null,2));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(summaries,null,2)+'\n');
