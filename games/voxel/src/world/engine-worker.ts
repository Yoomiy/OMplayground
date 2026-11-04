import { initSync, set_content, TerrainGen, ChunkMesher } from '../../engine/pkg/voxel_engine.js';
import type { EngineConfig, EngineJob, EngineResult } from './jobs.ts';
let generator: TerrainGen | undefined, mesher: ChunkMesher | undefined;
self.onmessage = ({
  data,
}: {
  data: { type: 'init'; config: EngineConfig } | { type: 'job'; job: EngineJob };
}) => {
  try {
    if (data.type === 'init') {
      initSync({ module: data.config.module });
      set_content(JSON.stringify(data.config.content));
      generator = new TerrainGen(data.config.seed);
      mesher = new ChunkMesher();
      self.postMessage({ type: 'ready' });
      return;
    }
    const job = data.job;
    if (!generator || !mesher) throw new Error('worker not initialized');
    const result: EngineResult =
      job.kind === 'generate'
        ? {
            id: job.id,
            tag: job.tag,
            kind: 'generate',
            data: generator.generate(job.tag.x, job.tag.z),
          }
        : { id: job.id, tag: job.tag, kind: 'mesh', data: mesher.mesh(job.region) };
    self.postMessage({ type: 'result', result }, { transfer: [result.data.buffer as ArrayBuffer] });
  } catch (error) {
    self.postMessage({
      type: 'failed',
      id: data.type === 'job' ? data.job.id : 0,
      reason: error instanceof Error ? error.message.slice(0, 160) : 'worker failure',
    });
  }
};
