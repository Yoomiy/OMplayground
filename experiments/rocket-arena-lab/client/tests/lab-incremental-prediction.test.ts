import assert from 'node:assert/strict';
import test from 'node:test';
import { PHYSICS } from '@rocket-arena/shared';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { historyFixture, historyCommand } from './lab-history-fixture.js';

test('5 ms physics at 30 FPS with delayed/batched input retains progress and catches up between frames', async () => {
  const f = await historyFixture(true,1,3,3);
  const originalStep = PredictionWorld.prototype.step;
  const descriptor = Object.getOwnPropertyDescriptor(performance,'now');
  let now = performance.now(), active = 0, maxPending = 0, maxSlices = 0;
  Object.defineProperty(performance,'now',{ value:()=>now, configurable:true });
  PredictionWorld.prototype.step = function(id,command,sequence) {
    originalStep.call(this,id,command,sequence); now += 5;
  };
  try {
    f.prime();
    for (let tick=0;tick<360;tick++) {
      now += PHYSICS.TIMESTEP*1_000;
      const render = tick%2===0;
      f.tick({ ...historyCommand, steer:tick>90&&tick<160?.3:0, boostHeld:tick>200&&tick<250 },1,render,2);
      let slices=0;
      while(f.lab.needsContinuation && slices<32) { f.lab.continuePrediction(now); slices++; }
      assert.equal(f.lab.needsContinuation,false,'fixed replay targets must finish');
      maxSlices=Math.max(maxSlices,slices);
      maxPending=Math.max(maxPending,f.lab.getDebugState().pending);
      if(render && f.lab.getDebugState().predictionActive) active++;
    }
    assert.ok(active>170,`active ${active}/180 render frames`);
    assert.ok(f.lab.getDebugState().catchupYields>10);
    assert.ok(maxSlices<=16);
    assert.ok(maxPending<=24);
    assert.equal(f.lab.getDebugState().error,null);
    assert.ok(f.lab.exportTelemetry().every(row=>row.recoveryCounts.cpu_budget===0));
  } finally {
    PredictionWorld.prototype.step=originalStep;
    if(descriptor) Object.defineProperty(performance,'now',descriptor);
    else delete (performance as unknown as { now?:unknown }).now;
    f.dispose();
  }
});

test('an epoch change invalidates incomplete replay before exposing a completed result', async () => {
  const f=await historyFixture();
  const original=PredictionWorld.prototype.step;
  try {
    for(let i=0;i<20;i++) f.tick();
    const frame=f.headSnapshot(); frame.cars[0].position.x+=2;
    PredictionWorld.prototype.step=function(id,input,sequence) {
      original.call(this,id,input,sequence);
      const until=performance.now()+9;
      while(performance.now()<until) { /* One non-preemptible slow step. */ }
    };
    f.receive(frame); f.lab.continuePrediction(performance.now());
    assert.equal(f.lab.getDebugState().catchingUp,true);
    const transition=structuredClone(frame); transition.tick++;
    transition.kickoffEpoch++; transition.phase='countdown';
    PredictionWorld.prototype.step=original;
    f.receive(transition); f.lab.continuePrediction(performance.now());
    assert.equal(f.lab.presentationState.phase,'countdown');
    assert.equal(f.lab.presentationState.kickoffEpoch,transition.kickoffEpoch);
    assert.equal(f.lab.getDebugState().catchingUp,false);
  } finally { PredictionWorld.prototype.step=original; f.dispose(); }
});
