import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";

class ObjMeshDat {
  id: number;
  i: number;
  j: number;
  k: number;
  constructor(id: number, i: number, j: number, k: number) {
    this.id = id | 0;
    this.i = i | 0;
    this.j = j | 0;
    this.k = k | 0;
  }
}

function locationHasher(i: number, j: number, k: number) {
  return (i | 0) | ((j | 0) << 8) | ((k | 0) << 16);
}

export function overrideObjectMesher(noa: any) {
  function ObjectMesher(this: any) {
    const dirtyChunks = new Set<any>();

    this.initChunk = function (chunk: any) {
      chunk._objectBlocks = {};
      chunk._objectSystems = [];
    };

    this.disposeChunk = function (chunk: any) {
      this.removeObjectMeshes(chunk);
      chunk._objectBlocks = null;
      dirtyChunks.delete(chunk);
    };

    this.setObjectBlock = function (chunk: any, blockID: number, i: number, j: number, k: number) {
      const key = locationHasher(i, j, k);
      if (blockID) {
        chunk._objectBlocks[key] = new ObjMeshDat(blockID, i, j, k);
      } else {
        if (chunk._objectBlocks[key]) delete chunk._objectBlocks[key];
      }
      dirtyChunks.add(chunk);
    };

    this.buildObjectMeshes = function () {
      for (const chunk of dirtyChunks) {
        this._buildObjectMeshesForChunk(chunk);
      }
      dirtyChunks.clear();
    };

    this.tick = function () {
      // Nothing needed. SPS meshes shift automatically.
    };

    this._rebaseOrigin = function (_delta: any) {
      // Nothing needed. SPS meshes shift automatically.
    };

    this._buildObjectMeshesForChunk = function (chunk: any) {
      this.removeObjectMeshes(chunk);

      const scene = chunk.noa.rendering.getScene();
      const objectMeshLookup = chunk.noa.registry._blockMeshLookup;

      const matIndexes: Record<number, Record<number, number[]>> = {};
      for (const key in chunk._objectBlocks) {
        const blockDat = chunk._objectBlocks[key];
        const blockID = blockDat.id;
        const mat = objectMeshLookup[blockID]?.material;
        const matIndex = mat ? scene.materials.indexOf(mat) : -1;
        if (!matIndexes[matIndex]) matIndexes[matIndex] = {};
        if (!matIndexes[matIndex][blockID]) matIndexes[matIndex][blockID] = [];
        matIndexes[matIndex][blockID].push(Number(key));
      }

      const x0 = chunk.i * chunk.size;
      const y0 = chunk.j * chunk.size;
      const z0 = chunk.k * chunk.size;

      for (const ixStr in matIndexes) {
        const ix = Number(ixStr);
        const meshHash = matIndexes[ix];
        const sps = this.buildSPSforMaterialIndex(chunk, scene, meshHash, x0, y0, z0);

        const mesh = sps.buildMesh();

        mesh.material = ix > -1 ? scene.materials[ix] : null;
        chunk._objectSystems.push(sps);
        chunk.noa.rendering.addMeshToScene(mesh, true, chunk.pos, chunk);
      }
    };

    this.removeObjectMeshes = function (chunk: any) {
      const systems = chunk._objectSystems || [];
      while (systems.length) {
        const sps = systems.pop();
        if (sps.mesh) sps.mesh.dispose();
        sps.dispose();
      }
    };

    this.buildSPSforMaterialIndex = function (
      chunk: any,
      scene: any,
      meshHash: Record<number, number[]>,
      x0: number,
      y0: number,
      z0: number
    ) {
      const blockHash = chunk._objectBlocks;
      const sps = new SolidParticleSystem("object_sps_" + chunk.requestID, scene, {
        updatable: false
      });

      const blockHandlerLookup = chunk.noa.registry._blockHandlerLookup;
      const objectMeshLookup = chunk.noa.registry._blockMeshLookup;

      for (const blockIDStr in meshHash) {
        const blockID = Number(blockIDStr);
        const mesh = objectMeshLookup[blockID];
        const blockArr = meshHash[blockID];
        const count = blockArr.length;

        const handlers = blockHandlerLookup[blockID];
        const handlerFn = handlers ? handlers.onCustomMeshCreate : null;

        const setShape = function (particle: any, _partIndex: number, shapeIndex: number) {
          const key = blockArr[shapeIndex];
          const dat = blockHash[key];

          particle.position.set(dat.i + 0.5, dat.j, dat.k + 0.5);
          if (handlerFn) handlerFn(particle, x0 + dat.i, y0 + dat.j, z0 + dat.k);
        };
        sps.addShape(mesh, count, { positionFunction: setShape });
        blockArr.length = 0;
      }

      return sps;
    };
  }

  // @ts-expect-error TypeScript doesn't like instantiating nested functions
  noa._objectMesher = new ObjectMesher();
}
