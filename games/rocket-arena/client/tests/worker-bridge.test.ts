import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { Room } from 'colyseus.js';
import { PHYSICS, type InputCommandV2 } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { PredictionController, type PredictionWorker } from '../src/prediction/controller.js';
import type { WorkerRequest, WorkerResponse, PredictionDebugState } from '../src/prediction/worker-protocol.js';

const command: InputCommandV2={ protocolVersion:2,throttle:1,steer:0,pitch:0,roll:0,yaw:0,
  jumpHeld:false,jumpSequence:0,boostHeld:false,powerslideHeld:false,cameraToggleSequence:0 };
function fixture() {
  const requests: WorkerRequest[]=[], sent: {type:string;value:any}[]=[];
  const handlers=new Map<string,(value:any)=>void>();
  const worker:PredictionWorker={ postMessage:(message:any)=>requests.push(message),onmessage:null,onerror:null,terminate(){} };
  const room={ sessionId:'driver',onMessage(type:string,fn:(value:any)=>void){handlers.set(type,fn)},onLeave(){},
    send(type:string,value:any){sent.push({type,value})} } as unknown as Room;
  const prediction=new PredictionController(()=>worker); prediction.attach(room);
  const attach=requests.find(request=>request.kind==='attach')!;
  const receive=(reply:WorkerResponse)=>worker.onmessage!.call(worker as Worker,new MessageEvent('message',{data:reply}));
  const frame=(tick=1,phase:PredictionFrame['phase']='playing')=>handlers.get('prediction-state')!({version:1,tick,
    kickoffEpoch:1,phase,cars:[{sessionId:'driver',acknowledgedSequence:0,position:{x:0,y:1,z:0},
      rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}}],
    ball:{position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}},boostPadCooldowns:[]} as PredictionFrame);
  const debug:PredictionDebugState={mode:'predicted',rttMs:10,fps:30,pending:0,sequence:0,tick:1,
    correctionMeters:0,snapshots:1,error:null,acknowledgedSequence:0,predictionActive:true,recoveryReason:null,
    recoveries:0,reconciliations:1,replaySteps:0,replayMs:0,confirmedSnapshots:0,skippedReplaySteps:0,
    totalReplaySteps:0,historySize:1,catchingUp:false,catchupYields:0,completedSequence:0,predictionLagInputs:0,
    predictedCar:null};
  const state=(requestId?:number,ageMs=0):WorkerResponse=>({kind:'state',generation:attach.generation,revision:0,
    requestId,debug,presentation:{car:{position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1},
      velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}},ball:null,previousCar:null,
      correctionOffset:[0,0,0],rotationOffset:[0,0,0,1],completedSequence:0,completedAtMs:performance.now(),sampledAtMs:performance.now(),
      phase:'playing',kickoffEpoch:1},completedAtAbsoluteMs:performance.timeOrigin+performance.now()-ageMs,operations:[]});
  return {prediction,worker,requests,sent,frame,receive,state,attach,room};
}

test('worker mailbox coalesces stalled rendering and snapshot bursts to one request and three current input ticks',()=>{
  const f=fixture();
  try {
    f.prediction.update(f.room,PHYSICS.TIMESTEP,command,performance.now());
    const first=f.requests.find(request=>request.kind==='drive')!;
    for(let i=0;i<100;i++){f.prediction.update(f.room,.05,command,performance.now());f.frame(i+1)}
    assert.equal(f.requests.filter(request=>request.kind==='drive').length,1);
    f.receive(f.state(first.requestId));
    const drives=f.requests.filter(request=>request.kind==='drive');
    assert.equal(drives.length,2);
    assert.equal(drives[1].frame!.tick,100);
    assert.ok(drives[1].deltaSeconds<=PHYSICS.TIMESTEP*3);
    assert.equal(f.prediction.getDebugState().workerInFlight,1);
  } finally {f.prediction.detach()}
});

test('stale completed bodies and phase changes cannot be reported as active; replies from departed rooms are ignored',()=>{
  const f=fixture();
  try {
    f.frame();f.receive(f.state(undefined,160));
    assert.equal(f.prediction.getDebugState().predictionActive,false);
    f.receive(f.state());assert.equal(f.prediction.getDebugState().predictionActive,true);
    f.frame(2,'countdown');assert.equal(f.prediction.getDebugState().predictionActive,false);
    f.prediction.detach();f.prediction.attach(f.room);
    f.receive({kind:'send',generation:f.attach.generation,message:'player-input',value:{sequence:99,command}});
    assert.equal(f.sent.filter(message=>message.type==='player-input').length,0);
    f.receive(f.state());assert.equal(f.prediction.getDebugState().predictionActive,false);
  } finally {f.prediction.detach()}
});

test('worker failure preserves a monotonic bounded input stream in server presentation mode',()=>{
  const f=fixture();
  try {
    f.frame();
    f.receive({kind:'send',generation:f.attach.generation,message:'player-input',value:{sequence:7,command}});
    f.worker.onerror!.call(f.worker as Worker,new Event('error') as ErrorEvent);
    f.prediction.update(f.room,2,command,performance.now());
    const inputs=f.sent.filter(message=>message.type==='player-input');
    assert.deepEqual(inputs.map(message=>message.value.sequence),[7,8,9,10]);
    assert.equal(f.prediction.mode,'server');
    assert.equal(f.prediction.getDebugState().worker,false);
    f.prediction.neutralize(command);
    const neutral=f.sent.find(message=>message.type==='player-neutral')!;
    assert.equal(neutral.value.sequence,11);assert.equal(neutral.value.command.throttle,0);
  } finally {f.prediction.detach()}
});

test('a superseded mode reply frees the mailbox without reviving its old presentation',()=>{
  const f=fixture();
  try {
    f.frame();f.prediction.update(f.room,PHYSICS.TIMESTEP,command,performance.now());
    const first=f.requests.find(request=>request.kind==='drive')!;
    f.prediction.setMode('server');f.prediction.update(f.room,PHYSICS.TIMESTEP,command,performance.now());
    f.receive(f.state(first.requestId));
    const drives=f.requests.filter(request=>request.kind==='drive');
    assert.equal(drives.length,2);assert.equal(drives[1].revision,1);
    assert.equal(f.prediction.getDebugState().predictionActive,false);
    assert.equal(f.prediction.getDebugState().predictedCar,null);
  } finally {f.prediction.detach()}
});

test('a newly completed old sample stays inactive and prediction/server handoff preserves display continuity',()=>{
 const f=fixture();const descriptor=Object.getOwnPropertyDescriptor(performance,'now');let now=performance.now();
 Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
 try {
  f.frame();const stale=f.state() as Extract<WorkerResponse,{kind:'state'}>;
  stale.presentation.sampledAtMs=stale.presentation.completedAtMs-200;
  f.receive(stale);assert.equal(f.prediction.getDebugState().predictionActive,false);
  const mesh=new THREE.Group();mesh.position.set(0,1,0);f.prediction.present(mesh,null,now);
  const fresh=f.state() as Extract<WorkerResponse,{kind:'state'}>;
  fresh.presentation.car!.position.x=.5;f.receive(fresh);
  now+=16;mesh.position.set(0,1,0);f.prediction.present(mesh,null,now);
  assert.ok(mesh.position.x>0 && mesh.position.x<.5);
  const displayed=mesh.position.x;
  now+=160;mesh.position.set(0,1,0);f.prediction.present(mesh,null,now);
  assert.equal(f.prediction.getDebugState().predictionActive,false);
  assert.ok(mesh.position.x<=displayed);
 } finally {
  if(descriptor)Object.defineProperty(performance,'now',descriptor);
  else delete (performance as unknown as {now?:unknown}).now;
  f.prediction.detach();
 }
});

test('snapshot replies preserve control sample age and cannot revive controls after neutralization',()=>{
 const f=fixture();f.frame();f.prediction.update(f.room,.016,command,performance.now());
 try{
  const first=f.requests.find(r=>r.kind==='drive')!;
  f.prediction.neutralize(command);f.frame(2);
  f.receive(f.state(first.requestId));
  const last=f.requests.filter(r=>r.kind==='drive').at(-1)!;
  assert.equal(last.command.throttle,0);assert.equal(last.command.boostHeld,false);
 }finally{f.prediction.detach()}
});

test('terminal disposal terminates once and ignores queued replies and future updates', () => {
  const f = fixture();
  let terminated = 0;
  f.worker.terminate = () => { terminated++; };
  f.frame();
  const receive = f.worker.onmessage!;
  f.prediction.dispose(); f.prediction.dispose();
  const requests = f.requests.length;
  receive.call(f.worker as Worker, new MessageEvent('message', { data: {
    kind: 'send', generation: f.attach.generation, message: 'player-input', value: { sequence: 99, command },
  } }));
  f.prediction.attach(f.room);
  f.prediction.update(f.room, .1, command, performance.now());
  f.prediction.setMode('predicted');
  assert.equal(terminated, 1);
  assert.equal(f.worker.onmessage, null);
  assert.equal(f.worker.onerror, null);
  assert.equal(f.requests.length, requests);
  assert.equal(f.sent.length, 0);
  assert.equal(f.prediction.getDebugState().worker, false);
  assert.equal(f.prediction.getDebugState().workerInFlight, 0);
});
