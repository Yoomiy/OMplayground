// Node adapter for exercising the production browser worker with slow physics.
// Delay injection belongs only to this harness, never the public worker protocol.
import { parentPort, workerData } from 'node:worker_threads';
import { register } from 'tsx/esm/api';
register();
const { PredictionWorld } = await import('../simulation/src/prediction-world.ts');
const original = PredictionWorld.prototype.step;
PredictionWorld.prototype.step = function(...args) {
  const started = performance.now();
  original.apply(this,args);
  while(performance.now()-started < (workerData.physicsStepMs ?? 0)) { /* CPU workload. */ }
};
globalThis.postMessage = message => parentPort.postMessage(message);
await import(workerData.entryModule ?? new URL('../client/src/lab/prediction-worker.ts', import.meta.url).href);
parentPort.on('message',data=>globalThis.onmessage({data}));
