import { proceduralVoxelID } from "@playground/voxel-content";

self.onmessage = (e: MessageEvent) => {
  if (!e.data || typeof e.data !== "object") return;
  const { chunkId, seed, x0, y0, z0, sx, sy, sz } = e.data;

  if (
    typeof chunkId !== "string" ||
    typeof seed !== "number" ||
    typeof x0 !== "number" ||
    typeof y0 !== "number" ||
    typeof z0 !== "number" ||
    typeof sx !== "number" ||
    typeof sy !== "number" ||
    typeof sz !== "number" ||
    sx <= 0 || sy <= 0 || sz <= 0 ||
    sx > 32 || sy > 32 || sz > 32
  ) {
    return;
  }

  const size = sx * sy * sz;
  const voxels = new Uint16Array(size);

  let idx = 0;
  // 3D coordinate layout order: must match the original layout in MinecraftClient.tsx
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sy; j++) {
      for (let k = 0; k < sz; k++) {
        const x = x0 + i;
        const y = y0 + j;
        const z = z0 + k;
        voxels[idx++] = proceduralVoxelID(x, y, z, seed);
      }
    }
  }

  const response = {
    chunkId,
    x0,
    y0,
    z0,
    voxels
  };

  // Post back to main thread and transfer the array buffer (zero-copy)
  self.postMessage(response, [voxels.buffer]);
};
