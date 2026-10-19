import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { PredictionHistory } from '../client/src/lab/prediction-history.js';
import { historyFixture, historyCommand } from '../client/tests/lab-history-fixture.js';

// Logical consistency, not a CPU/FPS benchmark. The fixture freezes the work-slice
// clock while executing real shared physics, with input/snapshot delays of 3 ticks.
// Keep the ball away from the car to isolate held steering from goals/kickoffs.
const results: unknown[] = [];
const originalCheck = PredictionHistory.prototype.check;
let audit: { checks: number; matches: number; metadataOnly: number;
  aligned: number; positionErrorSum: number; positionErrorMax: number } | null = null;
PredictionHistory.prototype.check = function(authority, live, localId) {
  const result = originalCheck.call(this, authority, live, localId);
  if (!audit) return result;
  audit.checks++; if (result === 'match') audit.matches++;
  // Read retained checkpoints for diagnosis only; the returned decision remains
  // the unchanged production check, including acknowledgement/application ticks.
  const frames = (this as unknown as { frames: Map<number,PredictionFrame> }).frames;
  const expected = frames.get(authority.tick);
  const predicted = expected?.cars.find(car => car.sessionId === localId);
  const actual = authority.cars.find(car => car.sessionId === localId);
  if (predicted && actual) {
    const error = Math.hypot(predicted.position.x-actual.position.x,
      predicted.position.y-actual.position.y,predicted.position.z-actual.position.z);
    audit.aligned++;audit.positionErrorSum+=error;audit.positionErrorMax=Math.max(audit.positionErrorMax,error);
    if (result === 'different') {
      const adjusted = { ...authority, cars: authority.cars.map(car => car.sessionId === localId
        ? { ...car, acknowledgedSequence:predicted.acknowledgedSequence, inputAppliedTick:predicted.inputAppliedTick } : car) };
      if (originalCheck.call(this,adjusted,live,localId) === 'match') audit.metadataOnly++;
    }
  }
  return result;
};
try {
  for (const [label, pattern] of [['60 Hz',[1]],['30 Hz',[2]],['24 Hz',[2,3]],['20 Hz',[3]]] as const) {
    const fixture = await historyFixture(true,1,3,3,true);
    const measured = { checks:0,matches:0,metadataOnly:0,aligned:0,positionErrorSum:0,positionErrorMax:0 };
    try {
      // Test-only authoritative fixture access; no runtime protocol or server API.
      (fixture.core as any).worldBundle.ball.setTranslation({ x:25,y:1,z:0 },true);
      fixture.prime();let nextRender=0,lastRender=-pattern[0],cursor=0;
      for (let tick=0;tick<1_200;tick++) {
        const render=tick===nextRender,deltaTicks=render ? tick-lastRender : 1;
        if(render){lastRender=tick;nextRender+=pattern[cursor++%pattern.length];}
        audit=tick>180 ? measured : null;
        fixture.tick({ ...historyCommand,steer:.75 },1,render,deltaTicks);
      }
      const state=fixture.lab.getDebugState();assert.equal(state.error,null);assert.ok(state.pending<=24);
      const result={renderCadence:label,serverTicks:1_200,excludedWarmupTicks:180,
        measured,confirmationPercent:100*measured.matches/measured.checks,
        checkpointPositionErrorMeanMeters:measured.positionErrorSum/measured.aligned,
        replayedSteps:state.totalReplaySteps,recoveries:state.recoveries};
      results.push(result);console.log(JSON.stringify(result));
    } finally { audit=null;fixture.dispose(); }
  }
} finally { PredictionHistory.prototype.check=originalCheck; }
writeFileSync(process.argv[2] ?? '.run/steady-prediction.json',JSON.stringify(results,null,2)+'\n');
