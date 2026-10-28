import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WorldgenWorkerPool } from "./worldgenPool";

describe("WorldgenWorkerPool", () => {
  let originalWorker: any;
  let mockWorkers: any[] = [];

  beforeEach(() => {
    mockWorkers = [];
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = class MockWorker {
      onmessage: any = null;
      onerror: any = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        mockWorkers.push(this);
      }
    };
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
  });

  it("initializes workers based on hardwareConcurrency", () => {
    const pool = new WorldgenWorkerPool();
    expect(pool).toBeDefined();
    pool.dispose();
  });

  it("calculates priority based on player distance and look direction", () => {
    const pool = new WorldgenWorkerPool();
    pool.updatePlayer([0, 0, 0], [1, 0, 0]); // Player at 0,0,0, looking along +X axis

    // Position 1: close, directly in front of the player (along +X)
    const priorityFront = (pool as any).computePriority(16, 0, 0, 16, 16, 16);
    
    // Position 2: far, behind player
    const priorityBehind = (pool as any).computePriority(-160, 0, 0, 16, 16, 16);

    expect(priorityFront).toBeGreaterThan(priorityBehind);

    pool.dispose();
  });

  it("allows chunk cancellation from queue", () => {
    const pool = new WorldgenWorkerPool();
    const req = {
      chunkId: "c_cancel",
      data: { shape: [16, 16, 16] },
      x0: 100,
      y0: 0,
      z0: 0,
      seed: 123,
      sx: 16,
      sy: 16,
      sz: 16,
      onComplete: vi.fn()
    };

    pool.requestChunk(req);
    expect((pool as any).activeRequests.has("c_cancel")).toBe(true);

    pool.cancelChunk("c_cancel");
    expect((pool as any).activeRequests.has("c_cancel")).toBe(false);
    expect((pool as any).queue.some((r: any) => r.chunkId === "c_cancel")).toBe(false);

    pool.dispose();
  });

  it("updates callback and data for duplicate chunk requests", () => {
    const pool = new WorldgenWorkerPool();
    
    // Force many active workers so the request sits in the queue
    (pool as any).workerBusy.fill(true);

    const onComplete1 = vi.fn();
    const req1 = {
      chunkId: "c_dup",
      data: { shape: [16, 16, 16] },
      x0: 100,
      y0: 0,
      z0: 0,
      seed: 123,
      sx: 16,
      sy: 16,
      sz: 16,
      onComplete: onComplete1
    };

    pool.requestChunk(req1);

    const onComplete2 = vi.fn();
    const req2 = {
      chunkId: "c_dup",
      data: { shape: [16, 16, 16] },
      x0: 100,
      y0: 0,
      z0: 0,
      seed: 123,
      sx: 16,
      sy: 16,
      sz: 16,
      onComplete: onComplete2
    };

    pool.requestChunk(req2);

    const queue = (pool as any).queue;
    expect(queue.length).toBe(1);
    expect(queue[0].onComplete).toBe(onComplete2);

    pool.dispose();
  });

  it("handles worker error events and triggers synchronous fallback", () => {
    const pool = new WorldgenWorkerPool();
    const onComplete = vi.fn();
    const req = {
      chunkId: "c_error_test",
      data: { shape: [16, 16, 16] },
      x0: 0,
      y0: 0,
      z0: 0,
      seed: 12345,
      sx: 16,
      sy: 16,
      sz: 16,
      onComplete
    };

    // Queue request (gets assigned to worker 0 immediately)
    pool.requestChunk(req);
    expect((pool as any).workerBusy[0]).toBe(true);

    // Simulate worker 0 error
    const mockWorker = mockWorkers[0];
    mockWorker.onerror({ message: "Worker crashed" });

    // Busy status must be reset, active request removed, and synchronous fallback complete
    expect((pool as any).workerBusy[0]).toBe(false);
    expect((pool as any).activeRequests.has("c_error_test")).toBe(false);
    expect(onComplete).toHaveBeenCalled();

    // Verify generated fallback data has actual block values from core generator
    const voxels = onComplete.mock.calls[0][0];
    expect(voxels).toBeInstanceOf(Uint16Array);
    expect(voxels.length).toBe(16 * 16 * 16);
    expect(voxels[0]).toBe(42);

    pool.dispose();
  });

  it("throttles player update resorting", () => {
    const pool = new WorldgenWorkerPool();
    const resortSpy = vi.spyOn(pool as any, "resortQueue");

    for (let i = 0; i < 9; i++) {
      pool.updatePlayer([i, 0, 0], [1, 0, 0]);
    }
    expect(resortSpy).not.toHaveBeenCalled();

    // 10th update triggers resort
    pool.updatePlayer([10, 0, 0], [1, 0, 0]);
    expect(resortSpy).toHaveBeenCalledOnce();

    pool.dispose();
  });

  it("safely disposes all active worker resources", () => {
    const pool = new WorldgenWorkerPool();
    const activeWorkers = [...(pool as any).workers];
    expect(activeWorkers.length).toBeGreaterThan(0);

    pool.dispose();
    for (const w of activeWorkers) {
      expect(w.terminate).toHaveBeenCalled();
    }
    expect((pool as any).workers.length).toBe(0);
  });

  it("does not throw an error if processQueue is triggered after dispose", () => {
    const pool = new WorldgenWorkerPool();
    pool.dispose();
    
    const req = {
      chunkId: "c_after_dispose",
      data: { shape: [16, 16, 16] },
      x0: 0,
      y0: 0,
      z0: 0,
      seed: 123,
      sx: 16,
      sy: 16,
      sz: 16,
      onComplete: vi.fn()
    };

    expect(() => pool.requestChunk(req)).not.toThrow();
  });
});
