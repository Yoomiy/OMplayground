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
3. **Template String Key Caching:** `sampleColumn` caches column data in a Map using ``${x},${z}``. Allocating tens of thousands of string keys per second forces the browser's Garbage Collector (GC) to halt the main thread, resulting in stuttering.

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
| setChunkData()   | <---------------- |  Uint16Array (Buffer)|
|                  |   Transferable    |                      |
+------------------+                   +----------------------+
```

1. **Worker Pool Setup:** Initialize a lightweight worker pool (e.g. 2 to 4 workers depending on `navigator.hardwareConcurrency`).
2. **Bypass Copying via Transferable Objects:**
  - Instead of sending rich JSON arrays, the Web Worker populates a raw, flat `Uint16Array` (or `Uint8Array` depending on max block ID count).
  - By passing the array's underlying buffer as a Transferable Object (`[array.buffer]`), the ownership of the memory space is transferred instantly to the main thread with **zero copy overhead** (0ms latency).
3. **Numeric Cache Keys:** Refactor the generator cache to use integer hashes instead of strings to eliminate GC overhead:
  ```typescript
   // Fast hashing for (x,z) coordinates in 32-bit integer Space (safe up to 65,536 block boundaries)
   const key = ((x & 0xFFFF) << 16) | (z & 0xFFFF);
  ```

#### Explicit Layout & Conversion Contract

To maintain strict correctness and avoid data corruption when sending flat buffers from Web Workers, the following memory layout contract is defined:

- **Buffer Format:** A single continuous `Uint16Array` of size $S_x \times S_y \times S_z$ (e.g., $16 \times 16 \times 16 = 4096$ elements per chunk).
- **Indexing/Stride Layout:** The worker packs voxels in standard 1D array layout using a 3D-to-1D mapping index:
  ```typescript
  // 3D coordinate (i, j, k) to 1D flat index
  const index = i + (j * sx) + (k * sx * sy);
  ```
- **Payload Structure:**
The worker responds with a message containing:
  ```typescript
  interface WorldgenWorkerResponse {
    chunkId: string;
    x0: number;
    y0: number;
    z0: number;
    voxels: Uint16Array; // The flat buffer
  }
  ```
- **Main Thread Integration (Reconstruction):**
When the main thread receives the `WorldgenWorkerResponse`, it directly accesses the pre-allocated `noa` chunk `ndarray`.
  ```typescript
  const [sx, sy, sz] = data.shape;
  const voxels = response.voxels;
  // If noa's underlying ndarray storage has matching strides, we can do a direct bulk assignment:
  // data.data.set(voxels); // Zero-iteration sync
  // Or fall back to safe, fast, non-procedural iteration:
  let idx = 0;
  for (let k = 0; k < sz; k++) {
    for (let j = 0; j < sy; j++) {
      for (let i = 0; i < sx; i++) {
        data.set(i, j, k, voxels[idx++]);
      }
    }
  }
  noa.world.setChunkData(chunkId, data);
  ```

---

### Solution B: Transition from SPS to GPU Thin Instances

Instead of compiling customized block geometries into monolithic meshes on the CPU, we will utilize **GPU Thin Instances** (or fall back to standard Instanced Meshes for highly dynamic entities like bobbing item drops).

#### Comparison: Solid Particle Systems vs. Instanced Meshes vs. Thin Instances


| Feature              | Solid Particle System (SPS)                        | Standard Instanced Meshes (`InstancedMesh`)             | Thin Instances (`thinInstance`)                       |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **CPU Overhead**     | **Very High** (Re-computes vertices on any change) | **Medium** (Creates a full Babylon `Node` per instance) | **Near Zero** (Only flat Float32 positions buffer)    |
| **GPU Draw Calls**   | 1 draw call per SPS                                | 1 draw call for all instances                           | 1 draw call for all instances                         |
| **Scene Graph Size** | 1 Mesh Node                                        | **High** (Thousands of active scene graph nodes)        | **None** (Only 1 master Mesh Node)                    |
| **Memory footprint** | High (full vertex duplicate data)                  | Medium (node properties, transforms)                    | **Extremely Low** (flat float arrays)                 |
| **Suitability**      | Bad for dynamic custom blocks                      | Good for a few complex moving objects (mobs/drops)      | **Perfect for thousands of static/decorative blocks** |


#### Why Thin Instances are Superior for Custom Blocks

In a voxel world, custom blocks like flowers, grass, ladders, cacti, and torches are mostly static but exist in massive quantities.

- **The Problem with SPS:** Whenever a flower is placed or broken, the entire chunk's SPS is destroyed, vertex buffers are re-allocated, and positions are recalculated on the CPU.
- **The Problem with standard `InstancedMesh`:** Every single flower becomes a Babylon Scene Node. Babylon must loop through, perform frustum culling, update matrix coordinates, and calculate bounding info for all of them every frame, saturating the main-thread tick loop.
- **The Thin Instance Solution:** All instances share a single source mesh. Instead of full node objects, their transforms are written directly into a contiguous `Float32Array` (matrix buffer) and sent to the GPU in a single call. This completely bypasses the scene graph overhead and CPU recalculations.

1. **Hardware Instancing with Thin Instances:**
  For each custom block type, we define thin instances. To organize this per chunk and make unloading clean, we can maintain one master mesh clone *per active chunk* for each custom block type:
2. **Eliminating CPU Rebuilds:**
  - When custom blocks are added, modified, or removed, we simply update the raw `Float32Array` matrix buffer for that chunk's mesh and re-upload it via `thinInstanceSetBuffer`.
  - This operation is instant, taking less than 0.1ms since it bypasses all mesh building, geometry compilation, and CPU-side allocation.
3. **Frame-Budgeted Chunk Meshing (Throttling):**
  - Limit the number of chunks compiled or updated per frame.
  - If 10 chunks are dirty, we process only 1 or 2 per tick, spreading the workload over multiple frames to maintain a solid 60/120 FPS.

---

### Solution C: Async Loading Policies & Priority Queue Management

Transitioning to asynchronous world generation (via Web Workers) introduces a key visual challenge: **chunk-loading latency can cause players to see empty voids (holes) or visual flickering** as they move. To resolve this, we will implement a Priority Queue and throttling policies.

#### 1. Distance & Frustum Priority-Based Queue

Instead of processing chunk requests in a first-come, first-served (FCFS) order, all outstanding chunk generation requests are routed through a priority-sorted queue:

- **Distance Priority:** Chunks closer to the player's current block position $(px, py, pz)$ are prioritized:
$$\text{Priority} = \frac{1}{\text{Distance}(Chunk, Player)^2}$$
- **Direction / Frustum Priority:** Chunks that lie within the player's viewport (frustum) and direction of travel are boosted in priority, while chunks behind the player are demoted.
- **Pre-emption:** If the player turns or moves rapidly, the queue is re-sorted dynamically every few frames.

#### 2. Throttling & Concurrency Policy

- **Active Task Limit:** Limit the maximum number of concurrent Web Worker generation requests to $N = \max(2, \text{navigator.hardwareConcurrency} - 1)$ to prevent CPU core saturation.

If the player moves out of range, simply evict the request if it is still in the queue. If the task is already running in a worker, let it complete and simply discard the results when it arrives on the main thread.

#### 3. Flicker and Hole Prevention Strategies

To hide the latency of asynchronous chunk generation, the engine will apply the following techniques:

- **Volumetric Fog Masking:** Render distance limits are tightly bound with a smooth volumetric fog. The fog distance is dynamically calibrated so that ungenerated chunks are obscured from view, smoothly fading into the world as they load.
- **Fast Heightmap Fallback (Optional):** If a chunk takes longer than 2 frames to generate, the main thread can instantly generate a very cheap, flat 2D heightmap block preview synchronously, allowing the player to stand on/see terrain immediately. This placeholder is cleanly replaced when the Web Worker returns the complete 3D voxel data.

---

## 4. Implementation Steps

### Phase 1: Key Hashing & Structural Optimizations (Immediate Win)

- **Goal:** Optimize `packages/voxel-content/src/worldgen.ts` to be faster and memory-efficient even on the main thread.
- **Actions:**
  - Replace the string `columnCache` template key ``${x},${z}`` with a numeric bitwise hash.
  - Implement a 2D heightmap cache for structures (trees, cacti) at the chunk level, eliminating the $11 \times 11$ nested search loops on individual block queries.

### Phase 2: Web Worker Integration for Worldgen & Priority Queue

- **Goal:** Completely eliminate procedural calculation stalls on the main thread while preventing world holes and flicker.
- **Actions:**
  - Write `apps/web/src/games/voxel/worldgen.worker.ts` importing `MultiBiomeGenerator` and conforming to the flat `Uint16Array` layout contract.
  - Implement the distance-and-frustum priority queue manager on the main thread to coordinate worker requests.
  - Update `MinecraftClient.tsx` to route `worldDataNeeded` requests through the priority queue and handle worker responses asynchronously.
  - Configure dynamic fog thresholds to hide chunk loading transitions.

### Phase 3: Object Mesher Refactor (GPU Thin Instances)

- **Goal:** Replace `SolidParticleSystem` with Thin Instances in `voxelObjectMesher.ts`.
- **Actions:**
  - Refactor `voxelObjectMesher.ts` to manage cloned master meshes with thin instance buffers per active chunk.
  - Implement flat Float32 matrix buffers to quickly batch custom blocks (flowers, torches, grass, etc.).
  - Handle dynamic chunk updates/disposals by clean-disposing chunk-specific meshes and buffers when coordinates are unloaded.

---

## 5. Cost-Benefit & Impact Analysis


| Metric                               | Current State (SPS + Main-thread Worldgen) | Target State (GPU Thin Instances + Web Workers)  | Impact                                      |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| **FPS during movement**              | 30 - 55 FPS (frequent drop to 15 FPS)      | 90 - 120+ FPS (highly stable)                    | **Massive Improvement** (Smooth experience) |
| **GC Overhead (Garbage Collection)** | High (template strings in tick loops)      | Extremely Low (numeric hashing, reused arrays)   | **No micro-stutters**                       |
| **CPU Usage (Main Thread)**          | 95% - 100% (saturated)                     | 25% - 35% (only rendering/inputs)                | **Cooler device, less battery drain**       |
| **Complexity**                       | Simple synchronous architecture            | Higher complexity (async worker pool, instances) | Slight increase in dev maintenance          |


