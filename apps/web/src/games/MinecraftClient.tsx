import { useEffect, useRef, useState } from "react";
import {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  type BlockDelta,
  type GameMode,
  type HotbarSlot,
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
 * This component mounts noa on a host `<div>` and draws a hotbar HUD
 * (block icons) in creative and survival so players see the active slot.
 *
 * `noa-engine` typings are intentionally loose; we annotate the engine as
 * `any` to keep the integration small instead of redeclaring its surface.
 */

const HOTBAR = PLACEABLE_BLOCK_IDS;

/** Max third-person camera pull-back (voxels); noa defaults `initialZoom` 0. */
const CAMERA_ZOOM_DISTANCE_MAX = 16;
/** Wheel delta → `zoomDistance` scale (`game-inputs` uses scaled pixel deltas). */
const CAMERA_ZOOM_SCROLL_STEP = 0.012;

/** Short labels for tooltips / a11y (Hebrew). */
const BLOCK_HUD: Record<number, string> = {
  [BLOCK_REGISTRY.GRASS]: "דשא",
  [BLOCK_REGISTRY.DIRT]: "עפר",
  [BLOCK_REGISTRY.STONE]: "אבן",
  [BLOCK_REGISTRY.WOOD]: "עץ",
  [BLOCK_REGISTRY.LEAVES]: "עלים",
  [BLOCK_REGISTRY.SAND]: "חול",
  [BLOCK_REGISTRY.GLASS]: "זכוכית"
};

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

/** Item-style icon per block for the hotbar (same assets as terrain). */
const BLOCK_HOTBAR_ICON: Record<number, string> = {
  [BLOCK_REGISTRY.GRASS]: MC_TEX.grassTop,
  [BLOCK_REGISTRY.DIRT]: MC_TEX.dirt,
  [BLOCK_REGISTRY.STONE]: MC_TEX.stone,
  [BLOCK_REGISTRY.WOOD]: MC_TEX.oakLog,
  [BLOCK_REGISTRY.LEAVES]: MC_TEX.oakLeaves,
  [BLOCK_REGISTRY.SAND]: MC_TEX.sand,
  [BLOCK_REGISTRY.GLASS]: MC_TEX.glass
};

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
  roster: RoomPlayerInfo[];
  myUserId: string | null;
  gameMode: GameMode;
  /** Survival: server-confirmed stacks. Creative: ignored for placing (still passed for typing). */
  inventorySlots: HotbarSlot[];
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
    gameMode,
    inventorySlots,
    onInput,
    onBlockPlace,
    onBlockBreak,
    registerSnapshotListener,
    registerBlockDeltaListener
  } = props;

  const [survivalSlot, setSurvivalSlot] = useState(0);
  const [creativeSlotIdx, setCreativeSlotIdx] = useState(0);
  const [controlsHintDismissed, setControlsHintDismissed] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  // noa-engine has loose .d.ts typings; lock to any so we don't fight them.
  const noaRef = useRef<unknown>(null);
  const onInputRef = useRef(onInput);
  const onPlaceRef = useRef(onBlockPlace);
  const onBreakRef = useRef(onBlockBreak);
  const pausedRef = useRef(paused);
  const gameModeRef = useRef<GameMode>(gameMode);
  const inventoryRef = useRef<HotbarSlot[]>(inventorySlots);
  const remoteEntitiesRef = useRef(new Map<string, number>());
  const selectedBlockRef = useRef<number>(BLOCK_REGISTRY.GRASS);
  const survivalSlotRef = useRef(0);

  onInputRef.current = onInput;
  onPlaceRef.current = onBlockPlace;
  onBreakRef.current = onBlockBreak;
  pausedRef.current = paused;
  gameModeRef.current = gameMode;
  inventoryRef.current = inventorySlots;
  survivalSlotRef.current = survivalSlot;

  useEffect(() => {
    if (gameMode !== "creative") return;
    const idx = HOTBAR.indexOf(selectedBlockRef.current as (typeof HOTBAR)[number]);
    if (idx >= 0) setCreativeSlotIdx(idx);
  }, [gameMode]);

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
        /** Space is jump; without this, Space can "click" a focused HTML button (e.g. pause). */
        preventDefaults: true,
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

      const gameEl = noa.container.element as HTMLElement;
      const focusGame = (): void => {
        hostRef.current?.focus({ preventScroll: true });
      };
      gameEl.addEventListener("pointerdown", focusGame);
      cleanupFns.push(() => gameEl.removeEventListener("pointerdown", focusGame));

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
        if (gameModeRef.current === "survival") {
          const inv = inventoryRef.current;
          const idx = survivalSlotRef.current;
          const cell = inv[idx];
          if (!cell || cell.count <= 0 || cell.blockId === BLOCK_REGISTRY.AIR) {
            return;
          }
          onPlaceRef.current(
            [tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]],
            cell.blockId
          );
          return;
        }
        onPlaceRef.current(
          [tgt.adjacent[0], tgt.adjacent[1], tgt.adjacent[2]],
          selectedBlockRef.current
        );
      });

      function onHotbarKey(e: KeyboardEvent) {
        if (e.key.toLowerCase() === "e") {
          setInventoryOpen((v) => !v);
          return;
        }
        const n = Number(e.key);
        if (gameModeRef.current === "survival") {
          if (Number.isFinite(n) && n >= 1 && n <= 9) {
            const i = n - 1;
            survivalSlotRef.current = i;
            setSurvivalSlot(i);
          }
          return;
        }
        if (Number.isFinite(n) && n >= 1 && n <= HOTBAR.length) {
          const idx = n - 1;
          selectedBlockRef.current = HOTBAR[idx];
          setCreativeSlotIdx(idx);
        }
      }
      window.addEventListener("keydown", onHotbarKey);
      cleanupFns.push(() => window.removeEventListener("keydown", onHotbarKey));

      let lastEmit = 0;
      noa.on("tick", () => {
        if (pausedRef.current) return;

        const scrolly: number = noa.inputs.pointerState.scrolly;
        if (scrolly !== 0) {
          const cam = noa.camera;
          cam.zoomDistance = Math.max(
            0,
            Math.min(
              CAMERA_ZOOM_DISTANCE_MAX,
              cam.zoomDistance + scrolly * CAMERA_ZOOM_SCROLL_STEP
            )
          );
        }

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

  const slotBox = (active: boolean, key: number, inner: JSX.Element): JSX.Element => (
    <div
      key={key}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black/70 bg-neutral-900/90 shadow-md ${
        active ? "ring-2 ring-amber-200 ring-offset-2 ring-offset-black/50" : ""
      }`}
    >
      <span className="pointer-events-none absolute left-0.5 top-0.5 text-[9px] font-bold text-white drop-shadow">
        {key}
      </span>
      {inner}
    </div>
  );

  const blockHotbarHud = !paused ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 px-2">
      {gameMode === "creative"
        ? HOTBAR.map((blockId, i) =>
            slotBox(
              i === creativeSlotIdx,
              i + 1,
              <img
                src={BLOCK_HOTBAR_ICON[blockId]}
                alt=""
                title={BLOCK_HUD[blockId] ?? ""}
                className="h-9 w-9"
                style={{ imageRendering: "pixelated" }}
              />
            )
          )
        : inventorySlots.slice(0, 9).map((cell, i) => {
            const icon = BLOCK_HOTBAR_ICON[cell.blockId];
            const hasItem =
              cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0 && icon !== undefined;
            return slotBox(
              i === survivalSlot,
              i + 1,
              <>
                {hasItem ? (
                  <img
                    src={icon}
                    alt=""
                    title={`${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`}
                    className="h-9 w-9"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-black/40" aria-hidden />
                )}
                {hasItem ? (
                  <span className="pointer-events-none absolute bottom-0.5 right-0.5 text-[10px] font-black leading-none text-white drop-shadow-md">
                    {cell.count}
                  </span>
                ) : null}
              </>
            );
          })}
    </div>
  ) : null;

  const inventoryPanel = inventoryOpen ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] rounded-xl border border-white/20 bg-neutral-950 p-4 text-white shadow-xl" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">מלאי</div>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={() => setInventoryOpen(false)}>סגור (E)</button>
        </div>
        <div className="grid grid-cols-9 gap-1.5">
          {inventorySlots.slice(0, 9).map((cell, i) => {
            const icon = BLOCK_HOTBAR_ICON[cell.blockId];
            const has = cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0 && icon;
            return (
              <div key={i} className="flex h-11 w-11 items-center justify-center rounded border border-white/30 bg-neutral-900">
                {has ? (
                  <>
                    <img src={icon} alt="" className="h-9 w-9" style={{ imageRendering: "pixelated" }} />
                    <span className="absolute mt-4 text-[10px] font-black text-white drop-shadow">{cell.count}</span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs opacity-60">סרגל חם (הרחבה מלאה תגיע בהמשך)</div>
      </div>
    </div>
  ) : null;

  const controlsHint =
    !paused && !controlsHintDismissed ? (
      <div className="pointer-events-none absolute left-3 top-3 max-w-[min(22rem,calc(100%-1.5rem)))]">
        <div
          className="relative space-y-1 rounded-lg border border-black/40 bg-neutral-950/75 py-2 ps-2.5 pe-8 pt-7 text-[10px] leading-snug text-neutral-100 shadow-md sm:text-[11px] sm:pe-9 sm:pt-8"
          dir="rtl"
        >
          <button
            type="button"
            className="pointer-events-auto absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-base font-bold leading-none text-neutral-300 hover:bg-white/10 hover:text-white"
            aria-label="סגור"
            onClick={() => setControlsHintDismissed(true)}
          >
            ×
          </button>
          <p className="font-semibold text-neutral-300">בקרות</p>
          <p className="text-neutral-200">
            WASD תנועה · רווח קפיצה · לחצן עכבר שמאלי שובר · ימני מניח · מקשי 1–9 לסרגל · גלגלת
            לזום המצלמה
          </p>
        </div>
      </div>
    ) : null;

  return (
    <div className="absolute inset-0">
      <div
        ref={hostRef}
        className="absolute inset-0 outline-none"
        tabIndex={0}
        aria-label="minecraft viewport"
      />
      {controlsHint}
      {blockHotbarHud}
      {inventoryPanel}
    </div>
  );
}
