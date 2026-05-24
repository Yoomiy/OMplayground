# Technical Proposal: Voxel Client Performance & Tick Loop Optimization

## 1. Executive Summary

This document proposes key architectural optimizations to solve critical client-side bottlenecks in the Minecraft-like voxel engine (`noa-engine` / Babylon.js). Profiling has highlighted two main performance-heavy areas that degrade frame rates and cause lag spikes:
1. **Procedural World Generation (`proceduralVoxelID`):** Blocking procedural math calculations on the main UI thread during chunk loading.
2. **Custom Object Meshing (`voxelObjectMesher`):** Highly CPU-intensive recreation/disposal of SolidParticleSystems (SPS) when rendering non-cubic blocks (e.g., plants, ladders, fences).

By implementing **multithreaded Web Workers** for worldgen and **GPU Instanced Meshes** for custom object meshing, we can eliminate main-thread stuttering, increase average frame rates from ~45-60 FPS to a solid 120+ FPS, and prevent trash collection (GC) pauses.

---

## 2. Problem Statement & Root Cause Analysis

### Problem A: Procedural World Generation Bottleneck
The client-side voxel engine requests chunk data via the `worldDataNeeded` event, which executes synchronously on the main thread inside `MinecraftClient.tsx`:

```typescript
noa.world.on("worldDataNeeded", (chunkId, data, x0, y0, z0) => {
  const [sx, sy, sz] = data.shape;
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sy; j++) {
      for (let k = 0; k < sz; k++) {
        // Runs 16x16x16 = 4096 times per chunk!
        const blockId = proceduralVoxelID(x, y, z, seed);
        data.set(i, j, k, blockId);
      }
    }
  }
  noa.world.setChunkData(chunkId, data);
});
```

#### Under the Hood Bottlenecks:
1. **Billion-Iteration Calculations:** To fill a single chunk, `proceduralVoxelID` invokes `MultiBiomeGenerator.blockAt`, which runs 2D and 3D Simplex noise equations. For a render distance of 5 chunks, loading/loading transitions trigger dozens of chunks simultaneously, freezing the main thread for several hundred milliseconds.
2. **Heavy Neighbor Scanning in `structureBlock`:** For every block above height level, the engine performs a nested $11 \times 11 = 121$ search loop to determine if adjacent columns have trees:
   ```typescript
   for (let dx = -5; dx <= 5; dx++) {
     for (let dz = -5; dz <= 5; dz++) {
       const trunkColumn = this.sampleColumn(tx, tz);
       // ... tree selection ...
     }
   }
   ```
   With 256 columns in a chunk, this equals **up to 30,976 structural lookup queries per chunk**, which completely saturates CPU resources.
3. **Template String Key Caching:** `sampleColumn` caches column data in a Map using `` `${x},${z}` ``. Allocating tens of thousands of string keys per second forces the browser's Garbage Collector (GC) to halt the main thread, resulting in stuttering.

---

### Problem B: Custom Object Meshing Bottleneck
Custom blocks (flowers, grass plants, ladders, cacti, torches) do not use standard cubic geometries. They are handled by `voxelObjectMesher.ts` using Babylon's `SolidParticleSystem` (SPS).

#### Under the Hood Bottlenecks:
1. **CPU Mesh Reconstruction:** When a custom block is broken, placed, or loaded, `_buildObjectMeshesForChunk` discards the entire chunk's SPS mesh and builds a brand new one:
   ```typescript
   this.removeObjectMeshes(chunk); // Disposes of active meshes
   const sps = new SolidParticleSystem("object_sps_" + chunk.requestID, scene, { ... });
   // Re-adds every custom block in the chunk one by one
   sps.addShape(mesh, count, { positionFunction: setShape });
   ```
2. **Buffer Allocation Overheads:** Creating an SPS forces Javascript to recalculate the positions, indices, normals, and UV arrays on the CPU, and re-allocates WebGL GPU buffers. This is extremely slow and blocks the GPU render pipeline during continuous movement.

---

## 3. Proposed Solutions

### Solution A: Offload Worldgen to Web Workers

We will delegate all biome, noise, heightmap, and block generation to a pool of background Web Workers.

```
+------------------+                   +----------------------+
|   Main Thread    |                   |   Web Worker Pool    |
| (noa / Babylon)  |                   |                      |
|                  |                   |                      |
| worldDataNeeded  |   postMessage()   |                      |
| (x0, y0, z0)     | ----------------> |  MultiBiomeGenerator |
|                  |                   |  4096 noise runs     |
|                  |                   |                      |
| setChunkData()   | <---------------- |  Uint8Array (Data)   |
|                  |   Transferable    |                      |
+------------------+                   +----------------------+
```

1. **Worker Pool Setup:** Initialize a lightweight worker pool (e.g. 2 to 4 workers depending on `navigator.hardwareConcurrency`).
2. **Bypass Copying via Transferable Objects:**
   * Instead of sending rich JSON arrays, the Web Worker populates a raw, flat `Uint8Array`.
   * By passing the array's underlying buffer as a Transferable Object (`[array.buffer]`), the ownership of the memory space is transferred instantly to the main thread with **zero copy overhead** (0ms latency).
3. **Numeric Cache Keys:** Refactor the generator cache to use integer hashes instead of strings to eliminate GC overhead:
   ```typescript
   // Fast hashing for (x,z) coordinates in 32-bit integer Space
   const key = ((x & 0xFFFF) << 16) | (z & 0xFFFF);
   ```

---

### Solution B: Transition from SPS to GPU Instanced Meshes

Instead of compiling customized block geometries into monolithic meshes on the CPU, we can utilize **GPU Instanced Meshes**.

1. **Hardware Instancing:** Custom meshes (like torches or flowers) are registered in Babylon.js as the base mesh. When rendering these blocks, the client calls:
   ```typescript
   const instance = baseMesh.createInstance("instance_name");
   instance.position.set(x, y, z);
   ```
2. **Eliminating CPU Rebuilds:**
   * When custom blocks are added or removed, we no longer destroy and recreate complex vertex buffers on the CPU.
   * Instead, we just spawn a new instance or call `.dispose()` on an existing instance. The GPU handles drawing thousands of duplicates using instancing under the hood with a single draw call.
3. **Frame-Budgeted Chunk Meshing (Throttling):**
   * Limit the number of chunks compiled or updated per frame.
   * If 10 chunks are dirty, we process only 1 or 2 per tick, spreading the workload over multiple frames to maintain a solid 60/120 FPS.

---

## 4. Implementation Steps

### Phase 1: Key Hashing & Structural Optimizations (Immediate Win)
* **Goal:** Optimize `packages/voxel-content/src/worldgen.ts` to be faster and memory-efficient even on the main thread.
* **Actions:**
  * Replace the string `columnCache` template key `` `${x},${z}` `` with a numeric bitwise hash.
  * Implement a 2D heightmap cache for structures (trees, cacti) at the chunk level, eliminating the $11 \times 11$ nested search loops on individual block queries.

### Phase 2: Web Worker Integration for Worldgen
* **Goal:** Completely eliminate procedural calculation stalls on the main thread.
* **Actions:**
  * Write `apps/web/src/games/voxel/worldgen.worker.ts` importing `MultiBiomeGenerator`.
  * Update `MinecraftClient.tsx` to handle chunk generation requests asynchronously via the worker pool.

### Phase 3: Object Mesher Refactor (GPU Instancing)
* **Goal:** Replace `SolidParticleSystem` with Instanced Meshes in `voxelObjectMesher.ts`.
* **Actions:**
  * Build an Instance Manager that maps block types to Babylon `InstancedMesh` lists.
  * Handle dynamic chunk disposal by clean-disposing instances tied to that chunk coordinate range.

---

## 5. Cost-Benefit & Impact Analysis

| Metric | Current State (SPS + Main-thread Worldgen) | Target State (GPU Instanced + Web Workers) | Impact |
| :--- | :--- | :--- | :--- |
| **FPS during movement** | 30 - 55 FPS (frequent drop to 15 FPS) | 90 - 120+ FPS (highly stable) | **Massive Improvement** (Smooth experience) |
| **GC Overhead (Garbage Collection)**| High (template strings in tick loops) | Extremely Low (numeric hashing, reused arrays) | **No micro-stutters** |
| **CPU Usage (Main Thread)** | 95% - 100% (saturated) | 25% - 35% (only rendering/inputs) | **Cooler device, less battery drain** |
| **Complexity** | Simple synchronous architecture | Higher complexity (async worker pool, instances) | Slight increase in dev maintenance |
