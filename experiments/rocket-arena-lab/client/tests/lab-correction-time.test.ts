import assert from 'node:assert/strict';
import test from 'node:test';
import { historyFixture,historyCommand } from './lab-history-fixture.js';

test('held input at a later physics tick cannot count ordinary motion as a correction',async()=>{
 const f=await historyFixture();
 try {
  const seed=structuredClone(f.core.buildPredictionFrame()!);seed.tick++;
  seed.cars[0].position.x=0;seed.cars[0].velocity.x=20;
  f.lab.setMode('shorter');f.receive(seed);f.lab.setMode('predicted');
  f.lab.update(f.room,0,historyCommand,performance.now());f.lab.exportTelemetry();
  const held=structuredClone(seed);held.tick++;held.cars[0].position.x+=20/60;
  f.receive(held);f.lab.update(f.room,0,historyCommand,performance.now());
  const latest=f.lab.exportTelemetry().at(-1)!;
  assert.equal(latest.carCorrectionMeters.count,0);
  assert.equal(latest.unalignedCorrections,1);
  assert.equal(f.lab.getDebugState().correctionMeters,0);
  assert.deepEqual(f.lab.presentationState.correctionOffset,[0,0,0]);
 } finally {f.dispose()}
});

test('a genuine correction compares matching physics ticks even when input acknowledgements differ',async()=>{
 const f=await historyFixture();
 try {
  for(let i=0;i<30;i++)f.tick();
  while(f.lab.needsContinuation)f.lab.continuePrediction(performance.now());
  const before=f.lab.presentationState.car!;
  const frame=structuredClone(f.core.buildPredictionFrame()!);
  frame.tick=(f.lab as any).completedTick;
  frame.cars[0]={...frame.cars[0],...structuredClone(before),
   acknowledgedSequence:f.lab.getDebugState().sequence-1};
  frame.cars[0].position.x+=2;
  f.receive(frame);f.lab.update(f.room,0,historyCommand,performance.now());
  while(f.lab.needsContinuation)f.lab.continuePrediction(performance.now());
  assert.ok(Math.abs(f.lab.getDebugState().correctionMeters-2)<1e-5);
  assert.ok(f.lab.exportTelemetry().some(row=>row.carCorrectionsOver50cm>0));
 } finally {f.dispose()}
});
