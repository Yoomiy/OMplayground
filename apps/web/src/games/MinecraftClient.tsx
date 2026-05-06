import { useEffect, useRef } from "react";
import {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  type BlockDelta,
  type InputReq,
  type RoomPlayerInfo,
  type RoomSnapshot,
  type Vec3
} from "@/lib/voxelProtocol";

/**
 * Dumb noa-engine wrapper — props only, no IO. The container connects to
 * the voxel server (`useVoxelSocket`) and pipes data in/out via:
 *   - props: seed, deltas, mySpawn, paused, onInput/onBlockPlace/onBlockBreak
 *   - registerSnapshotListener / registerBlockDeltaListener: imperative
 *     fan-in for high-frequency server updates without re-rendering React.
 *
 * This component renders zero React DOM beyond the host `<div>` — noa
 * mounts its own canvas inside it.
 *
 * `noa-engine` typings are intentionally loose; we annotate the engine as
 * `any` to keep the integration small instead of redeclaring its surface.
 */

const HOTBAR = PLACEABLE_BLOCK_IDS;

/** Served from apps/web/public/minecraft-assets (copied from source packs). */
const MC_TEX = {
  grassTop: "/minecraft-assets/grass_block_top.png",
  grassSide: "/minecraft-assets/grass_block_side.png",
  dirt: "/minecraft-assets/dirt.png",
  stone: "/minecraft-assets/stone.png",
  oakLog: "/minecraft-assets/oak_log.png",
  oakLogTop: "/minecraft-assets/oak_log_top.png",
  oakLeaves: "/minecraft-assets/oak_leaves.png",
  sand: "/minecraft-assets/sand.png",
  waterStill: "/minecraft-assets/water_still.png",
  glass: "/minecraft-assets/glass.png"
} as const;

function registerMcTerrainMaterials(noa: {
  registry: { registerMaterial: (name: string, opts: Record<string, unknown>) => void };
}): void {
  const reg = (name: string, textureURL: string, extra: Record<string, unknown> = {}) => {
    noa.registry.registerMaterial(name, { textureURL, ...extra });
  };
  reg("mc_grass_top", MC_TEX.grassTop);
  reg("mc_grass_side", MC_TEX.grassSide);
  reg("mc_dirt", MC_TEX.dirt);
  reg("mc_stone", MC_TEX.stone);
  reg("mc_oak_log", MC_TEX.oakLog);
  reg("mc_oak_log_top", MC_TEX.oakLogTop);
  reg("mc_oak_leaves", MC_TEX.oakLeaves, { texHasAlpha: true });
  reg("mc_sand", MC_TEX.sand);
  reg("mc_water", MC_TEX.waterStill, { texHasAlpha: true });
  reg("mc_glass", MC_TEX.glass, { texHasAlpha: true });
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b1);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function smoothNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h00 = hash3(xi, 0, zi, seed);
  const h10 = hash3(xi + 1, 0, zi, seed);
  const h01 = hash3(xi, 0, zi + 1, seed);
  const h11 = hash3(xi + 1, 0, zi + 1, seed);
  const fx = xf * xf * (3 - 2 * xf);
  const fz = zf * zf * (3 - 2 * zf);
  const a = h00 * (1 - fx) + h10 * fx;
  const b = h01 * (1 - fx) + h11 * fx;
  return a * (1 - fz) + b * fz;
}

/**
 * Mirror of apps/minecraft-server/src/world.ts proceduralVoxelID. Kept
 * client-side so noa can request blocks synchronously without a
 * round-trip per chunk.
 */
function proceduralVoxelID(x: number, y: number, z: number, seed: number): number {
  const base = 8;
  const amp = 4;
  const heightF =
    smoothNoise(x / 16, z / 16, seed) * amp +
    smoothNoise(x / 4, z / 4, seed ^ 0x1234) * 1.2;
  const height = Math.floor(base + heightF);
  if (y > height) return BLOCK_REGISTRY.AIR;
  if (y === height) return BLOCK_REGISTRY.GRASS;
  if (y > height - 3) return BLOCK_REGISTRY.DIRT;
  return BLOCK_REGISTRY.STONE;
}

export interface MinecraftClientProps {
  seed: number;
  initialDeltas: [number, number, number, number][];
  mySpawn: Vec3;
  paused: boolean;
  /** Roster used by the client only for displayName lookup of remote meshes. */
  roster: RoomPlayerInfo[];
  myUserId: string | null;
  onInput: (input: InputReq) => void;
  onBlockPlace: (pos: Vec3, blockId: number) => void;
  onBlockBreak: (pos: Vec3) => void;
  registerSnapshotListener: (cb: (snap: RoomSnapshot) => void) => () => void;
  registerBlockDeltaListener: (cb: (delta: BlockDelta) => void) => () => void;
}

export function MinecraftClient(props: MinecraftClientProps): JSX.Element {
  const {
    seed,
    initialDeltas,
    mySpawn,
    paused,
    roster,
    myUserId,
    onInput,
    onBlockPlace,
    onBlockBreak,
    registerSnapshotListener,
    registerBlockDeltaListener
  } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  // noa-engine has loose .d.ts typings; lock to any so we don't fight them.
  const noaRef = useRef<unknown>(null);
  const onInputRef = useRef(onInput);
  const onPlaceRef = useRef(onBlockPlace);
  const onBreakRef = useRef(onBlockBreak);
  const pausedRef = useRef(paused);
  const remoteEntitiesRef = useRef(new Map<string, number>());
  const selectedBlockRef = useRef<number>(BLOCK_REGISTRY.GRASS);

  onInputRef.current = onInput;
  onPlaceRef.current = onBlockPlace;
  onBreakRef.current = onBlockBreak;
  pausedRef.current = paused;

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    void (async () => {
      const { Engine } = await import("noa-engine");
      const Babylon = await import("@babylonjs/core");
      if (cancelled || !hostRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noa: any = new Engine({
        debug: false,
        silent: true,
        playerStart: mySpawn,
        playerHeight: 1.8,
        playerWidth: 0.6,
        blockTestDistance: 8,
        domElement: hostRef.current,
        chunkSize: 16,
        chunkAddDistance: [3, 3],
        chunkRemoveDistance: [4, 4]
      } as Record<string, unknown>);
      noaRef.current = noa;
      noa?.setPaused?.(pausedRef.current);

      const deltas = new Map<string, number>();
      for (const [x, y, z, id] of initialDeltas) {
        deltas.set(`${x},${y},${z}`, id);
      }

      const scene = noa.rendering.getScene();
      registerMcTerrainMaterials(noa);

      noa.registry.registerBlock(BLOCK_REGISTRY.GRASS, {
        material: ["mc_grass_top", "mc_dirt", "mc_grass_side"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.DIRT, {
        material: "mc_dirt",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.STONE, {
        material: "mc_stone",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.WOOD, {
        material: ["mc_oak_log_top", "mc_oak_log_top", "mc_oak_log"],
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.LEAVES, {
        material: "mc_oak_leaves",
        solid: true,
        opaque: false
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.SAND, {
        material: "mc_sand",
        solid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.WATER, {
        material: "mc_water",
        solid: false,
        opaque: false,
        fluid: true
      });
      noa.registry.registerBlock(BLOCK_REGISTRY.GLASS, {
        material: "mc_glass",
        solid: true,
        opaque: false
      });

      noa.world.on(
        "worldDataNeeded",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chunkId: unknown, data: any, x0: number, y0: number, z0: number) => {
          const [sx, sy, sz] = data.shape;
          for (let i = 0; i < sx; i++) {
            for (let j = 0; j < sy; j++) {
              for (let k = 0; k < sz; k++) {
                const x = x0 + i;
                const y = y0 + j;
                const z = z0 + k;
                const override = deltas.get(`${x},${y},${z}`);
                const blockId =
                  override !== undefined
                    ? override
                    : proceduralVoxelID(x, y, z, seed);
                data.set(i, j, k, blockId);
              }
            }
          }
          noa.world.setChunkData(chunkId, data);
        }
      );

      const remoteMaterial = new Babylon.StandardMaterial("mat_remote", scene);
      remoteMaterial.diffuseColor = new Babylon.Color3(1, 0.8, 0.2);
      const sourceMesh = Babylon.MeshBuilder.CreateBox(
        "remote-player",
        { height: 1.8, width: 0.6, depth: 0.6 },
        scene
      );
      sourceMesh.material = remoteMaterial;
      sourceMesh.setEnabled(false);
      noa.rendering.addMeshToScene(sourceMesh, true);

      function ensureRemoteEntity(userId: string): number {
        const existing = remoteEntitiesRef.current.get(userId);
        if (existing !== undefined) return existing;
        const mesh = sourceMesh.createInstance(`remote-${userId}`);
        const id: number = noa.entities.add(
          [mySpawn[0], mySpawn[1], mySpawn[2]],
          0.6,
          1.8,
          mesh,
          [0, 0.9, 0],
          false,
          false
        );
        remoteEntitiesRef.current.set(userId, id);
        return id;
      }

      const offSnapshot = registerSnapshotListener((snap) => {
        for (const [userId, p] of Object.entries(snap.players)) {
          if (userId === myUserId) continue;
          const eid = ensureRemoteEntity(userId);
          noa.entities.setPosition(eid, p.pos);
        }
        for (const [userId, eid] of remoteEntitiesRef.current) {
          if (!(userId in snap.players)) {
            noa.ents.deleteEntity?.(eid);
            remoteEntitiesRef.current.delete(userId);
          }
        }
      });
      cleanupFns.push(offSnapshot);

      const offBlockDelta = registerBlockDeltaListener(({ pos, blockId }) => {
        noa.setBlock(blockId, pos[0], pos[1], pos[2]);
        deltas.set(`${pos[0]},${pos[1]},${pos[2]}`, blockId);
      });
      cleanupFns.push(offBlockDelta);

      noa.inputs.down.on("fire", () => {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        onBreakRef.current([tgt.position[0], tgt.position[1], tgt.position[2]]);
      });
      noa.inputs.down.on("alt-fire", () => {
        if (pausedRef.current) return;
        const tgt = noa.targetedBlock;
        if (!tgt) return;
        onPlaceRef.current(
          [tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]],
          selectedBlockRef.current
        );
      });

      function onHotbarKey(e: KeyboardEvent) {
        const n = Number(e.key);
        if (Number.isFinite(n) && n >= 1 && n <= HOTBAR.length) {
          selectedBlockRef.current = HOTBAR[n - 1];
        }
      }
      window.addEventListener("keydown", onHotbarKey);
      cleanupFns.push(() => window.removeEventListener("keydown", onHotbarKey));

      let lastEmit = 0;
      noa.on("tick", () => {
        if (pausedRef.current) return;
        const now = performance.now();
        if (now - lastEmit < 60) return;
        lastEmit = now;
        const playerEnt = noa.playerEntity;
        const pos: number[] = noa.entities.getPosition(playerEnt);
        const heading: number = noa.camera.heading;
        const physState = noa.entities.getPhysics(playerEnt);
        const onGround = physState?.body?.resting?.[1] === -1;
        onInputRef.current({
          pos: [pos[0], pos[1], pos[2]],
          heading,
          jumping: !onGround,
          t: Date.now()
        });
      });

      cleanupFns.push(() => {
        try {
          noa.dispose?.();
        } catch {
          // noa<0.34 didn't expose dispose; the engine GCs when host detaches.
        }
      });

      // Roster reserved for future name-label rendering — keep ref so unused-var lint is happy.
      void roster;
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      noaRef.current = null;
      remoteEntitiesRef.current.clear();
    };
  }, [seed]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noa: any = noaRef.current;
    noa?.setPaused?.(paused);
  }, [paused]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 outline-none"
      tabIndex={0}
      aria-label="minecraft viewport"
    />
  );
}
