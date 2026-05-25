import { proceduralVoxelID } from "@playground/voxel-content";

export interface ChunkRequest {
  chunkId: string;
  data: any; // ndarray
  x0: number;
  y0: number;
  z0: number;
  seed: number;
  sx: number;
  sy: number;
  sz: number;
  onComplete: (voxels: Uint16Array) => void;
  priority?: number;
}

export class WorldgenWorkerPool {
  private workers: Worker[] = [];
  private workerBusy: boolean[] = [];
  private workerActiveRequest: (ChunkRequest | null)[] = [];
  private queue: ChunkRequest[] = [];
  private activeRequests = new Map<string, ChunkRequest>(); // chunkId -> request
  private playerPos: [number, number, number] = [0, 65, 0];
  private playerDir: [number, number, number] = [0, 0, 1];
  private maxWorkers: number;
  private tickCount = 0;

  constructor() {
    this.maxWorkers = Math.max(2, (navigator.hardwareConcurrency || 4) - 1);
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(
        new URL("./worldgen.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e) => this.onWorkerMessage(i, e.data);
      worker.onerror = (err) => this.onWorkerError(i, err);
      this.workers.push(worker);
      this.workerBusy.push(false);
      this.workerActiveRequest.push(null);
    }
  }

  updatePlayer(pos: [number, number, number], dir: [number, number, number]) {
    this.playerPos = [pos[0], pos[1], pos[2]];
    this.playerDir = [dir[0], dir[1], dir[2]];
    
    this.tickCount++;
    if (this.tickCount >= 10) {
      this.tickCount = 0;
      this.resortQueue();
    }
  }

  requestChunk(req: ChunkRequest) {
    const existing = this.activeRequests.get(req.chunkId);
    if (existing) {
      // If the request is already in the queue, update its callback and data references
      const queueIdx = this.queue.findIndex((r) => r.chunkId === req.chunkId);
      if (queueIdx !== -1) {
        this.queue[queueIdx] = {
          ...this.queue[queueIdx],
          data: req.data,
          onComplete: req.onComplete
        };
      }
      return;
    }

    const chunkReq: ChunkRequest & { priority: number } = {
      ...req,
      priority: this.computePriority(req.x0, req.y0, req.z0, req.sx, req.sy, req.sz)
    };

    this.activeRequests.set(req.chunkId, chunkReq);
    this.queue.push(chunkReq);
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.processQueue();
  }

  cancelChunk(chunkId: string) {
    const queueIdx = this.queue.findIndex((r) => r.chunkId === chunkId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
    }
    this.activeRequests.delete(chunkId);
  }

  private computePriority(
    x0: number,
    y0: number,
    z0: number,
    sx: number,
    sy: number,
    sz: number
  ): number {
    const cx = x0 + sx / 2;
    const cy = y0 + sy / 2;
    const cz = z0 + sz / 2;

    const dx = cx - this.playerPos[0];
    const dy = cy - this.playerPos[1];
    const dz = cz - this.playerPos[2];

    const distSq = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distSq) || 0.01;

    let priority = 10000 / distance;

    const rx = dx / distance;
    const ry = dy / distance;
    const rz = dz / distance;

    const dot = rx * this.playerDir[0] + ry * this.playerDir[1] + rz * this.playerDir[2];
    if (dot > 0.3) {
      priority *= 2.0;
    }

    return priority;
  }

  private resortQueue() {
    if (this.queue.length === 0) return;
    for (const req of this.queue) {
      req.priority = this.computePriority(req.x0, req.y0, req.z0, req.sx, req.sy, req.sz);
    }
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private processQueue() {
    if (this.workers.length === 0) return;
    for (let i = 0; i < this.maxWorkers; i++) {
      if (!this.workerBusy[i] && this.queue.length > 0) {
        const req = this.queue.shift()!;
        this.workerBusy[i] = true;
        this.workerActiveRequest[i] = req;
        this.workers[i].postMessage({
          chunkId: req.chunkId,
          seed: req.seed,
          x0: req.x0,
          y0: req.y0,
          z0: req.z0,
          sx: req.sx,
          sy: req.sy,
          sz: req.sz
        });
      }
    }
  }

  private onWorkerMessage(workerIndex: number, data: any) {
    this.workerBusy[workerIndex] = false;
    this.workerActiveRequest[workerIndex] = null;
    const { chunkId, voxels } = data;

    const req = this.activeRequests.get(chunkId);
    this.activeRequests.delete(chunkId);

    if (req) {
      req.onComplete(voxels);
    }

    this.processQueue();
  }

  private onWorkerError(workerIndex: number, err: ErrorEvent | any) {
    console.error(`Worldgen Web Worker ${workerIndex} encountered an error:`, err);
    this.workerBusy[workerIndex] = false;
    
    const req = this.workerActiveRequest[workerIndex];
    this.workerActiveRequest[workerIndex] = null;
    
    if (req) {
      this.activeRequests.delete(req.chunkId);
      console.warn(`Falling back to synchronous chunk generation for chunk ${req.chunkId} due to worker error.`);
      try {
        const size = req.sx * req.sy * req.sz;
        const voxels = new Uint16Array(size);
        let idx = 0;
        for (let i = 0; i < req.sx; i++) {
          for (let j = 0; j < req.sy; j++) {
            for (let k = 0; k < req.sz; k++) {
              voxels[idx++] = proceduralVoxelID(req.x0 + i, req.y0 + j, req.z0 + k, req.seed);
            }
          }
        }
        req.onComplete(voxels);
      } catch (fallbackErr) {
        console.error(`Failed synchronous fallback for chunk ${req.chunkId}:`, fallbackErr);
      }
    }
    
    this.processQueue();
  }

  dispose() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.workerActiveRequest = [];
    this.activeRequests.clear();
  }
}
