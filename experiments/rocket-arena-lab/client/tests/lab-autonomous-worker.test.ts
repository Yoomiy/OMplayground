import assert from 'node:assert/strict';
import test from 'node:test';
import type { Room } from 'colyseus.js';
import { nodeLabWorker } from '../../scripts/node-lab-worker.mts';
import { WorkerDrivingLab } from '../src/lab/worker-driving-lab.js';
import { historyFixture,historyCommand } from './lab-history-fixture.js';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('real worker sends current controls and predicts movement without rendered frames',async()=>{
 const f=await historyFixture(true,2);f.lab.detach();
 const handlers=new Map<string,(value:any)=>void>();
 const room={sessionId:'driver',onMessage(type:string,fn:(value:any)=>void){handlers.set(type,fn)},onLeave(){},
  send(type:string,value:any){if(type==='lab-input'||type==='lab-neutral')f.core.submitPredictionInput('driver',value);
   if(type==='lab-ping')handlers.get('lab-pong')?.(value)}} as unknown as Room;
 const adapter=nodeLabWorker();const lab=new WorkerDrivingLab(()=>adapter.port);
 let previous=performance.now(),ticks=0;
 const server=setInterval(()=>{const now=performance.now();f.core.advanceSimulation(now-previous);previous=now;
  if(++ticks%2===0)handlers.get('prediction-state')?.(structuredClone(f.core.buildPredictionFrame()!));},1_000/60);
 try{
  lab.startInputClock(()=>room,()=>historyCommand);
  const until=performance.now()+4_000;
  while(!lab.getDebugState().predictedCar&&performance.now()<until)await wait(20);
  const initial=lab.getDebugState().predictedCar;assert.ok(initial);
  await wait(700);
  const state=lab.getDebugState();assert.equal(state.error,null);assert.ok(state.acknowledgedSequence>15);
  assert.ok(state.pending<=24);assert.ok(state.workerInFlight<=1);
  assert.ok(Math.hypot(state.predictedCar!.position.x-initial.position.x,state.predictedCar!.position.z-initial.position.z)>1);
  assert.ok(lab.exportTelemetry().every(r=>r.frames===0),'worker/input ticks cannot fabricate rendered FPS');
 }finally{clearInterval(server);lab.stopInputClock();lab.detach();await adapter.thread.terminate();f.core.dispose()}
});

test('worker neutralizes expired control leases and bounds outgoing work after parent silence',async()=>{
 const f=await historyFixture();f.lab.detach();const adapter=nodeLabWorker();
 const sent:{message:string;value:any}[]=[];
 let initialized=false,answered=false;
 adapter.port.onmessage=(event:any)=>{if(event.data.kind==='send')sent.push(event.data);else {initialized=true;if(event.data.requestId===1)answered=true}};
 try{
  adapter.port.postMessage({kind:'clock',enabled:true});
  adapter.port.postMessage({kind:'attach',generation:1,revision:0,sessionId:'driver',sequence:0,mode:'predicted'});
  const initUntil=performance.now()+5_000;
  while(!initialized&&performance.now()<initUntil)await wait(20);
  assert.ok(initialized,'worker must load before timing the control lease');
  const sampled=performance.timeOrigin+performance.now();
  adapter.port.postMessage({kind:'drive',generation:1,revision:0,requestId:1,frame:f.core.buildPredictionFrame()!,
   frameAtAbsoluteMs:performance.timeOrigin+performance.now(),deltaSeconds:0,
   nowAbsoluteMs:performance.timeOrigin+performance.now(),controlsAtAbsoluteMs:sampled,command:historyCommand});
  const answerUntil=performance.now()+5_000;
  while(!answered&&performance.now()<answerUntil)await wait(20);
  assert.ok(answered,'worker must initialize its physics world before checking the expired lease');
  const leaseUntil=performance.now()+1_000;
  while(!sent.some(s=>s.message==='lab-neutral')&&performance.now()<leaseUntil)await wait(20);
  const neutral=sent.find(s=>s.message==='lab-neutral');assert.ok(neutral);
  assert.equal(neutral.value.command.throttle,0);assert.equal(neutral.value.command.boostHeld,false);
  const count=sent.filter(s=>s.message==='lab-input').length;assert.ok(count<=15);
  for(let i=0;i<4;i++){
   adapter.port.postMessage({kind:'drive',generation:1,revision:0,requestId:2+i,frame:f.core.buildPredictionFrame()!,
    frameAtAbsoluteMs:performance.timeOrigin+performance.now(),deltaSeconds:0,
    nowAbsoluteMs:performance.timeOrigin+performance.now(),controlsAtAbsoluteMs:sampled,command:historyCommand});
   await wait(50);
  }
  assert.equal(sent.filter(s=>s.message==='lab-input').length,count,'snapshot traffic cannot renew an old control lease');
 }finally{await adapter.thread.terminate();f.core.dispose()}
});
