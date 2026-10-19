import assert from 'node:assert/strict';
import test from 'node:test';
import { readTimingProfile } from '../src/lab/timing-profile.js';
import { WorkerDrivingLab, type LabWorker } from '../src/lab/worker-driving-lab.js';
import { historyCommand } from './lab-history-fixture.js';

test('ordinary and invalid URLs select the buffer without the autonomous clock', () => {
  for (const query of ['', '?timing=buffer', '?timing=unknown', '?graphics=low']) {
    assert.deepEqual(readTimingProfile(query), { name:'buffer', autonomous:false, poseBufferMs:50 });
  }
});

test('four timing comparisons independently select scheduling and presentation and report actual settings', () => {
  for (const name of ['baseline','buffer','clock','combined']) {
    const profile = readTimingProfile(`?timing=${name}`);
    const requests: any[] = [];
    const worker = { onmessage:null, onerror:null, postMessage(message:any) { requests.push(message); }, terminate() {} } as LabWorker;
    const lab = new WorkerDrivingLab(() => worker, { poseBufferMs:profile.poseBufferMs });
    try {
      if (profile.autonomous) lab.startInputClock(() => null, () => historyCommand);
      const state = lab.getDebugState();
      assert.equal(state.timingProfile,name);
      assert.equal(state.inputClock,name === 'clock' || name === 'combined');
      assert.equal(state.poseBufferMs,name === 'buffer' || name === 'combined' ? 50 : 0);
      assert.equal(requests.some(message => message.kind === 'clock' && message.enabled),profile.autonomous);
      lab.stopInputClock();
      assert.equal(lab.timingProfile,state.poseBufferMs > 0 ? 'buffer' : 'baseline');
    } finally { lab.stopInputClock();lab.detach(); }
  }
});
