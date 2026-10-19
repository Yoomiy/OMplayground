import { Worker } from 'node:worker_threads';
import type { LabWorker } from '../client/src/lab/worker-driving-lab.js';

/** Harness adapter; the browser uses its native Worker with this same entry logic. */
export function nodeLabWorker(physicsStepMs=0) {
  const thread=new Worker(new URL('./worker-benchmark-entry.mjs',import.meta.url),{
    workerData:{physicsStepMs},execArgv:['--conditions=development'] });
  const port:LabWorker={postMessage:message=>thread.postMessage(message),onmessage:null,onerror:null,
    terminate(){void thread.terminate()}};
  thread.on('message',data=>port.onmessage?.call(port as unknown as globalThis.Worker,{data} as MessageEvent));
  thread.on('error',error=>{
    console.error('Prediction test worker:',error);
    port.onerror?.call(port as unknown as globalThis.Worker,new Event('error') as ErrorEvent);
  });
  return {port,thread};
}
