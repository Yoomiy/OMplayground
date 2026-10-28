import { engine, loadEngine, content, identity, supportProblem } from './engine.ts';
import { TerrainRenderer } from '../render/terrain.ts';
import { EnginePool } from '../world/worker-pool.ts';
import { WorldStream } from '../world/stream.ts';
import { Prediction } from './prediction.ts';
import { creativePalette } from './palette.ts';
import { RemoteActors } from './interpolation.ts';
import { appearanceMatchesContent } from '../shared/appearance.ts';
import { WorldClock } from './world-clock.ts';
import { WorldAudio } from './world-audio.ts';
import { voiceScene } from './voice-scene.ts';
import type { VoiceScene } from './voice-scene.ts';
import { ENVIRONMENT_VERSION, sampleEnvironment } from '../shared/environment.ts';
import { parseServerMessage, GENERATOR_VERSION, columnKey } from '../shared/protocol.ts';
import type { ClientMessage, ServerMessage, Cell } from '../shared/protocol.ts';
import { decodeChunk, worldCell } from '../shared/chunk-wire.ts';
import type { Controls, InputFrame } from '../shared/input.ts';
import { validStack } from '../shared/inventory.ts';
import type { InventoryCommand, InventoryView } from '../shared/inventory.ts';
import type { GameMode, MiningView, DropView } from '../shared/gameplay.ts';
import type { VitalsView } from '../shared/vitals.ts';
import { equipmentEffects } from '../shared/vitals.ts';
import { rayBody, combatProfile } from '../shared/combat.ts';
import type { HitEvent } from '../shared/combat.ts';
import type { ExplosiveView, ExplosionEvent } from '../shared/explosives.ts';
import type { WorldState, PauseReason } from '../shared/lifecycle.ts';
export type HudState = {
  mode: GameMode;
  role: 'participant' | 'observer';
  lifecycle: WorldState | 'preparing' | 'recovering';
  worldPauseReason: PauseReason | null;
  combat: boolean;
  canIgnite: boolean;
  hit: { received: boolean; damage: number; at: number } | null;
  selectedSlot: number;
  mining: MiningView;
  vitals: VitalsView | null;
  inventory: InventoryView | null;
  inventoryOpen: boolean;
  inventoryPending: boolean;
  inputMode: 'desktop' | 'touch';
  environment: Readonly<{ hour: number; daytime: boolean; rain: boolean }>;
  effectsMuted: boolean;
  effectsAvailable: boolean;
  status:
    | 'connecting'
    | 'loading'
    | 'playing'
    | 'paused'
    | 'dead'
    | 'stalled'
    | 'recovering'
    | 'unsupported'
    | 'error';
  message: string;
  selected: number;
  players: number;
  flying: boolean;
  pointerLocked: boolean;
  hotbar: readonly {
    key: number;
    state: number;
    family: string;
    labelKey: string;
    slot: number | null;
    count: number | null;
  }[];
};
export type RuntimeCommand =
  | { type: 'inventory'; operation: InventoryCommand }
  | { type: 'inventory-target' }
  | { type: 'select'; state: number }
  | { type: 'select-slot'; slot: number }
  | { type: 'mine'; active: boolean }
  | { type: 'eat' }
  | { type: 'respawn' }
  | { type: 'attack' }
  | { type: 'ignite' }
  | { type: 'interact'; kind: 'place' | 'remove' }
  | { type: 'flight' }
  | { type: 'fullscreen' }
  | { type: 'resume' }
  | { type: 'pause' }
  | { type: 'mute-effects'; muted: boolean }
  | { type: 'look'; dx: number; dy: number }
  | { type: 'touch'; x: number; z: number; jump: boolean; sneak: boolean; sprint: boolean }
  | { type: 'reconnect' };
export type RuntimeOptions = {
  admit: () => Promise<{ ticket: string; buildId: string }>;
  socketUrl: string;
  signal?: AbortSignal;
  fullscreenElement?: HTMLElement;
  renderScale?: number;
  renderHz?: 30 | 60;
  inputMode?: 'desktop' | 'touch';
  onDiagnostic?: (operation: string, reason: string) => void;
};
export type VoxelRuntime = {
  command(command: RuntimeCommand): void;
  subscribe(listener: (state: HudState) => void): () => void;
  dispose(): void;
  debug(): unknown;
  voiceScene(): VoiceScene | null;
};
export async function mountVoxel(
  host: HTMLElement,
  options: RuntimeOptions,
): Promise<VoxelRuntime> {
  const checkCancellation = () => {
    if (options.signal?.aborted) throw new DOMException('Voxel mount cancelled', 'AbortError');
  };
  checkCancellation();
  const problem = supportProblem();
  if (problem) throw new Error(problem);
  const compiled = await loadEngine();
  checkCancellation();
  const appearanceItems = new Map(content.items.map((item) => [item.itemType, item]));
  const inputMode =
    options.inputMode ??
    (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop');
  const renderHz = options.renderHz === 30 ? 30 : 60;
  const neutralTouch = () => ({ x: 0, z: 0, jump: false, sneak: false, sprint: false });
  let touch = neutralTouch();
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'עולם המשחק');
  const ownsPointerLock = () => Object.is(document.pointerLockElement, canvas);
  host.append(canvas);
  const world = new engine.VoxelWorld(),
    renderer = new TerrainRenderer(
      canvas,
      engine.generate_textures(),
      engine.texture_layer_count(),
      new engine.Culler(),
      compiled.memory,
      content.blocks,
      content.items,
      options.renderScale,
    );
  try {
    const initial = content.blocks.findIndex(
      (block) =>
        block.name === content.items.find((item) => item.places)?.places &&
        block.placeable !== false,
    );
    if (initial < 0) throw new Error('missing placeable startup model');
    await renderer.prepare(initial, options.signal);
    checkCancellation();
  } catch (error) {
    renderer.dispose();
    world.free();
    canvas.remove();
    throw error;
  }
  const remotes = new RemoteActors(),
    listeners = new Set<(state: HudState) => void>(),
    keys = new Set<string>();
  const worldClock = new WorldClock();
  const audio = new WorldAudio(),
    soundGroups = new Map(content.behavior.map((block) => [block.family, block.soundGroup]));
  let environmentSeed = 0,
    environment = sampleEnvironment(0, 0),
    openSky = false,
    lastSkyProbe = -Infinity;
  const environmentHud = () => ({
    hour: Math.floor((environment.dayFraction * 24 + 6) % 24),
    daytime: environment.sun[1] >= 0,
    rain: environment.rain > 0.2,
  });
  const hotbar = creativePalette(content);
  let hud: HudState = {
    mode: 'creative',
    role: 'participant',
    lifecycle: 'preparing',
    worldPauseReason: null,
    combat: false,
    canIgnite: false,
    hit: null,
    selectedSlot: 0,
    mining: { target: null, elapsed: 0, total: 0 },
    vitals: null,
    inventory: null,
    inventoryOpen: false,
    inventoryPending: false,
    inputMode,
    environment: environmentHud(),
    effectsMuted: false,
    effectsAvailable: audio.supported,
    status: 'connecting',
    message: 'מתחברים לעולם…',
    selected: hotbar.find((i) => i.family === 'stone')?.state ?? hotbar[0].state,
    players: 1,
    flying: false,
    pointerLocked: false,
    hotbar,
  };
  let socket: WebSocket | null = null,
    pool: EnginePool | null = null,
    stream: WorldStream | null = null,
    prediction: Prediction | null = null,
    slot: number | null = null;
  let reconnectAllowed = true,
    fatalRecovery = false;
  let disposed = false,
    connection = 0,
    phase: 'preparing' | 'playing' | 'paused' | 'dead' = 'preparing',
    focused = false,
    baselineReceived = false,
    actorId = '',
    worldId = '',
    yaw = 0,
    pitch = 0,
    jump = false,
    actionSequence = 0,
    queuedAction: 'place' | 'remove' | 'collect' | 'attack' | 'ignite' | null = null;
  let lastHitSequence = 0;
  let lastHitEvent: HitEvent | null = null;
  let lastExplosionSequence = 0,
    lastExplosionEvent: ExplosionEvent | null = null;
  const primed = new Map<string, ExplosiveView>(),
    blastPatches = new Set<string>();
  let pendingInputs: InputFrame[] = [],
    lastFrame = performance.now(),
    lastUpdate = lastFrame,
    accumulator = 0,
    lastSend = 0,
    lastReceived = 0,
    lastHud = 0,
    lastReady = 0,
    nextDraw = 0,
    animation = 0,
    connectionTimer: ReturnType<typeof setTimeout> | null = null,
    actionPending = 0;
  let updateTimer: ReturnType<typeof setInterval> | null = null;
  let paletteSent: { epoch: number; sequence: number; state: number } | null = null;
  let noticeUntil = 0;
  let miningHeld = false,
    miningSingle = false,
    lastMineKey = '';
  let mineRequest = 0,
    mineRetryAt = 0;
  const dropped = new Map<string, DropView>();
  const worldActions = new Set<number>();
  let inventoryEpoch = 0,
    inventorySequence = 0;
  let pendingInventoryOpen: Extract<InventoryCommand, { kind: 'open' }> | null = null;
  let focusPending = false;
  let footTravel = 0,
    lastFootstep = 0,
    previousFoot: readonly number[] | null = null;
  let lastResult: Extract<ServerMessage, { type: 'result' }> | null = null;
  let recentEdits: { cell: Cell; state: number; revision: number }[] = [];
  let target: Cell | null = null,
    targetNormal: Cell | null = null,
    lastHighlight = '';
  let visualOffset = [0, 0, 0],
    lastPosition = [0, 80, 0];
  const publish = (patch: Partial<HudState>) => {
    hud = { ...hud, ...patch };
    for (const listener of listeners) listener(hud);
  };
  const send = (message: ClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const diagnose = (operation: string, error: unknown) =>
    options.onDiagnostic?.(operation, error instanceof Error ? error.message : String(error));
  const fail = (operation: string, error: unknown) => {
    fatalRecovery = true;
    diagnose(operation, error);
    keys.clear();
    touch = neutralTouch();
    worldClock.reset(worldClock.read(performance.now()), performance.now(), false);
    publish({
      lifecycle: 'recovering',
      status: 'recovering',
      message: 'העולם מתאושש. אפשר להתחבר מחדש.',
    });
    if (prediction) send({ type: 'focus', epoch: prediction.currentEpoch, active: false });
    focused = false;
    audio.setActive(false);
  };
  const clearWorld = () => {
    audio.setActive(false);
    footTravel = 0;
    previousFoot = null;
    worldClock.reset(0, performance.now());
    environmentSeed = 0;
    environment = sampleEnvironment(0, 0);
    openSky = false;
    lastSkyProbe = -Infinity;
    keys.clear();
    touch = neutralTouch();
    jump = false;
    stream?.dispose();
    pool?.dispose();
    stream = null;
    pool = null;
    remotes.clear();
    if (slot !== null) world.player_remove(slot);
    slot = null;
    prediction = null;
    phase = 'preparing';
    baselineReceived = false;
    pendingInputs = [];
    queuedAction = null;
    actionSequence = 0;
    paletteSent = null;
    actionPending = 0;
    worldActions.clear();
    dropped.clear();
    miningHeld = miningSingle = false;
    lastMineKey = '';
    mineRequest = 0;
    mineRetryAt = 0;
    lastResult = null;
    lastHitSequence = 0;
    lastHitEvent = null;
    lastExplosionSequence = 0;
    lastExplosionEvent = null;
    primed.clear();
    blastPatches.clear();
    inventoryEpoch = 0;
    inventorySequence = 0;
    pendingInventoryOpen = null;
    focusPending = false;
    publish({
      inventory: null,
      inventoryOpen: false,
      inventoryPending: false,
      mining: { target: null, elapsed: 0, total: 0 },
      vitals: null,
      combat: false,
      canIgnite: false,
      hit: null,
    });
    recentEdits = [];
    nextDraw = 0;
    target = null;
    targetNormal = null;
    lastHighlight = '';
    renderer.target([], null);
    renderer.resetPresentation();
  };
  const flush = () => {
    if (!pendingInputs.length) return;
    while (pendingInputs.length) {
      const frames = pendingInputs.splice(0, 4);
      send({ type: 'input', frames });
    }
    lastSend = performance.now();
  };
  const syncPalette = () => {
    if (
      hud.mode !== 'creative' ||
      phase !== 'playing' ||
      !prediction ||
      socket?.readyState !== WebSocket.OPEN
    )
      return;
    const epoch = prediction.currentEpoch;
    if (paletteSent?.epoch === epoch && paletteSent.state === hud.selected) return;
    const sequence = paletteSent?.epoch === epoch ? paletteSent.sequence + 1 : 1;
    send({ type: 'palette', epoch, sequence, state: hud.selected });
    paletteSent = { epoch, sequence, state: hud.selected };
  };
  const focus = (active: boolean) => {
    if (
      active &&
      (hud.lifecycle === 'ended' ||
        (hud.role === 'participant' && ['paused', 'recovering'].includes(hud.lifecycle)))
    )
      return;
    if (active && (fatalRecovery || hud.inventoryOpen || phase === 'dead')) return;
    if (focused === active) return;
    focused = active;
    if (!active) {
      miningHeld = miningSingle = false;
      lastMineKey = '';
    }
    audio.setActive(active && phase === 'playing');
    footTravel = 0;
    previousFoot = null;
    nextDraw = 0;
    keys.clear();
    touch = neutralTouch();
    jump = false;
    queuedAction = null;
    miningHeld = miningSingle = false;
    lastMineKey = '';
    pendingInputs = [];
    accumulator = 0;
    if (prediction && phase === 'playing') {
      focusPending = true;
      send({ type: 'focus', epoch: prediction.currentEpoch, active });
    }
  };
  const handle = (event: ServerMessage) => {
    if (event.type === 'lifecycle') {
      const now = performance.now();
      worldClock.reset(event.tick, now, event.state === 'playing');
      publish({
        lifecycle: event.reason === 'policy_unavailable' ? 'recovering' : event.state,
        worldPauseReason: event.reason,
      });
      if (event.state === 'ended') {
        reconnectAllowed = false;
        focus(false);
        phase = 'paused';
        if (ownsPointerLock()) document.exitPointerLock();
        publish({ status: 'error', message: 'המפגש הסתיים. אפשר לחזור לרשימת המשחקים.' });
      } else if (event.state === 'paused' && hud.role === 'participant') {
        focus(false);
        if (ownsPointerLock()) document.exitPointerLock();
        publish({
          message:
            event.reason === 'policy_unavailable' ? 'ממתינים לאישור מצב העולם…' : 'העולם מושהה.',
        });
      }
      return;
    }
    if (hud.lifecycle === 'ended' && event.type !== 'error') return;
    if (event.type === 'explosives') {
      if (
        !event.upsert.every(
          (body) =>
            content.behavior.find((rule) => rule.family === content.blocks[body.state]?.name)
              ?.explosive,
        )
      ) {
        fail('explosives', 'unknown explosive state');
        return;
      }
      if (event.reset) primed.clear();
      for (const id of event.removed) primed.delete(id);
      for (const body of event.upsert)
        if (!primed.has(body.id) || primed.get(body.id)!.revision <= body.revision)
          primed.set(body.id, body);
      return;
    }
    if (event.type === 'explosion') {
      if (event.sequence <= lastExplosionSequence) return;
      lastExplosionSequence = event.sequence;
      lastExplosionEvent = event;
      primed.delete(event.id);
      for (const column of event.columns)
        blastPatches.add(`${column.x},${column.z}:${column.revision}`);
      while (blastPatches.size > 128) blastPatches.delete(blastPatches.values().next().value!);
      if (!event.cancelled) {
        renderer.explosionEffect(event.position, event.radius, performance.now());
        audio.effect(event.position, 'explosion', true);
      }
      return;
    }
    if (event.type === 'hit') {
      if (!prediction || event.sequence <= lastHitSequence) return;
      lastHitSequence = event.sequence;
      lastHitEvent = event;
      const now = performance.now();
      renderer.hitEffect(event.position, now);
      audio.effect(event.position, 'impact', false);
      if (event.target === actorId || event.attacker === actorId)
        publish({ hit: { received: event.target === actorId, damage: event.damage, at: now } });
      return;
    }
    if (event.type === 'vitals') {
      if (prediction && event.epoch === prediction.currentEpoch) publish({ vitals: event.view });
      return;
    }
    if (event.type === 'drops') {
      const items = new Map(content.items.map((item) => [item.itemType, item]));
      if (!event.upsert.every((drop) => validStack(drop.stack, items))) {
        fail('drops', 'invalid drop stack');
        return;
      }
      if (event.reset) dropped.clear();
      for (const id of event.removed) dropped.delete(id);
      for (const drop of event.upsert)
        if (!dropped.has(drop.id) || dropped.get(drop.id)!.revision <= drop.revision)
          dropped.set(drop.id, drop);
      return;
    }
    if (event.type === 'mining') {
      if (event.epoch !== prediction?.currentEpoch) return;
      if (!event.target && hud.mining.target) {
        lastMineKey = '';
        if (miningSingle) miningHeld = false;
      }
      publish({ mining: { target: event.target, elapsed: event.elapsed, total: event.total } });
      return;
    }
    if (event.type === 'rules') {
      if (!prediction || event.epoch <= prediction.currentEpoch) return;
      publish({
        mode: event.mode,
        combat: event.combat,
        canIgnite: event.explosives,
        ...(event.mode === 'survival'
          ? { hotbar: [], selected: 0 }
          : {
              hotbar,
              selected: hotbar.find((i) => i.family === 'stone')?.state ?? hotbar[0].state,
            }),
      });
      return;
    }
    if (event.type === 'inventory') {
      if (!prediction || event.epoch !== prediction.currentEpoch) return;
      const itemDefinitions = new Map(content.items.map((item) => [item.itemType, item]));
      const slots = [
        ...event.view.bag,
        ...event.view.craft2,
        ...event.view.craft3,
        ...event.view.equipment,
        ...(event.view.container?.slots ?? []),
      ];
      if (!slots.every((stack) => stack === null || validStack(stack, itemDefinitions))) {
        fail('inventory', 'invalid owned stack');
        return;
      }
      inventoryEpoch = event.epoch;
      if (hud.mode === 'survival') {
        const bar = event.view.bag.slice(0, 9).map((stack, index) => {
          const item = content.items.find((i) => i.itemType === stack?.itemType);
          const state = item?.places
            ? content.blocks.findIndex((b) => b.name === item.places && b.placeable !== false)
            : 0;
          return {
            key: index,
            slot: index,
            state: Math.max(0, state),
            family: stack?.itemType ?? '',
            labelKey: item?.labelKey ?? 'item.empty',
            count: stack?.count ?? 0,
          };
        });
        publish({
          inventory: event.view,
          hotbar: bar,
          selectedSlot: event.view.selected,
          selected: bar[event.view.selected].state,
        });
      } else publish({ inventory: event.view });
      return;
    }
    if (event.type === 'welcome') {
      if (
        event.buildId !== identity.buildId ||
        event.contentHash !== content.hash ||
        event.environmentVersion !== ENVIRONMENT_VERSION ||
        event.environmentVersion !== identity.environmentVersion ||
        event.generatorVersion !== GENERATOR_VERSION
      ) {
        socket?.close();
        publish({ status: 'error', message: 'המשחק עודכן. יש לרענן את העמוד.' });
        return;
      }
      actorId = event.actorId;
      publish({
        mode: event.mode,
        role: event.role,
        combat: event.combat,
        canIgnite: event.explosives,
        ...(event.mode === 'survival' ? { hotbar: [], selected: 0 } : { hotbar }),
      });
      worldId = event.worldId;
      environmentSeed = event.seed;
      worldClock.reset(event.tick, performance.now());
      slot = world.player_add(...event.spawn);
      world.set_ghost(slot, event.role === 'observer');
      prediction = new Prediction(world, slot);
      prediction.baseline(event.epoch, 0, Array.from(world.player_state(slot)));
      lastPosition = [...event.spawn];
      pool = new EnginePool(
        { module: compiled.module, content, seed: event.seed },
        navigator.hardwareConcurrency || 2,
        (reason) => fail('worker', reason),
      );
      stream = new WorldStream(
        world,
        pool,
        renderer,
        worldId,
        content.hash,
        (x, z, subscription) => send({ type: 'resync', x, z, subscription }),
        (reason) => fail('stream', reason),
      );
      publish({ status: 'loading', message: 'מכינים את העולם…' });
      return;
    }
    if (event.type === 'baseline' && prediction) {
      if (event.reason === 'mode' || event.reason === 'teleport') {
        focus(false);
        if (ownsPointerLock()) document.exitPointerLock();
        pendingInventoryOpen = null;
        publish({ inventoryOpen: false });
        previousFoot = null;
        footTravel = 0;
        lastPosition = event.state.slice(0, 3);
        lastReady = -Infinity;
      }

      const previousEpoch = prediction.currentEpoch;
      prediction.baseline(event.epoch, event.ack, event.state, event.movement);
      phase = event.phase;
      if (event.phase === 'paused' || event.phase === 'dead') {
        focusPending = false;
        focused = false;
        keys.clear();
        touch = neutralTouch();
        miningHeld = false;
        lastMineKey = '';
        audio.setActive(false);
        if (ownsPointerLock()) document.exitPointerLock();
        if (event.phase === 'dead') {
          pendingInventoryOpen = null;
          publish({ inventoryOpen: false });
        }
      }
      baselineReceived = true;
      pendingInputs = [];
      visualOffset = [0, 0, 0];
      if (event.epoch !== previousEpoch) {
        queuedAction = null;
        actionSequence = 0;
        actionPending = 0;
        worldActions.clear();
        if (event.reason !== 'focus' || !focused) miningHeld = miningSingle = false;
        lastMineKey = '';
        mineRequest = 0;
        mineRetryAt = 0;
        lastResult = null;
        inventorySequence = 0;
        publish({ inventoryPending: false });
      }
      // A newer baseline can retire an in-flight opposite focus request. Reassert
      // the latest local intent against its epoch, including a rapid resume/pause.
      if (event.phase === 'playing') {
        focusPending = event.state[12] !== Number(!focused);
        if (focusPending) send({ type: 'focus', epoch: event.epoch, active: focused });
      }
      publish({
        status: fatalRecovery
          ? 'recovering'
          : event.phase === 'dead'
            ? 'dead'
            : event.phase === 'preparing'
              ? 'loading'
              : focused && event.state[12] === 0
                ? 'playing'
                : 'paused',
        message: fatalRecovery
          ? 'העולם מתאושש. אפשר להתחבר מחדש.'
          : event.phase === 'dead'
            ? 'נפלתם. הפריטים נשארו בעולם. אפשר לחזור לנקודת ההתחלה.'
            : event.phase === 'preparing'
              ? 'מכינים את העולם…'
              : focused
                ? ''
                : 'לחצו על העולם כדי להמשיך',
        flying: event.state[10] === 1,
      });
      if (pendingInventoryOpen) {
        if (event.phase === 'playing' && !focusPending) {
          const operation = pendingInventoryOpen;
          pendingInventoryOpen = null;
          publish({ inventoryPending: false });
          sendInventory(operation);
        } else publish({ inventoryPending: true });
      }
      syncPalette();
      return;
    }
    if (event.type === 'snapshot') {
      if (
        !event.actors.every(
          (actor) =>
            !actor.appearance || appearanceMatchesContent(actor.appearance, appearanceItems),
        )
      ) {
        fail('actors', 'invalid public appearance');
        return;
      }
      worldClock.observe(event.tick, performance.now());
      if (event.self && prediction) {
        const before = world.player_state(prediction.slot);
        const changed = prediction.reconcile(event.self.epoch, event.self.ack, event.self.state);
        if (changed) {
          const after = world.player_state(prediction.slot);
          const distance = Math.hypot(
            after[0] - before[0],
            after[1] - before[1],
            after[2] - before[2],
          );
          visualOffset =
            distance < 1
              ? [
                  visualOffset[0] + before[0] - after[0],
                  visualOffset[1] + before[1] - after[1],
                  visualOffset[2] + before[2] - after[2],
                ]
              : [0, 0, 0];
        }
      }
      remotes.snapshot(event.actors, event.time, performance.now());
      return;
    }
    if (event.type === 'actor_joined') {
      if (!appearanceMatchesContent(event.actor.appearance, appearanceItems)) {
        fail('actors', 'invalid public appearance');
        return;
      }
      remotes.join(event.actor, performance.now());
      return;
    }
    if (event.type === 'actor_removed') {
      remotes.remove(event.id);
      return;
    }
    if (event.type === 'unload') {
      stream?.unload(event.x, event.z, event.subscription);
      return;
    }
    if (event.type === 'result') {
      if (prediction && event.epoch === prediction.currentEpoch) {
        if (
          event.sequence === mineRequest &&
          event.outcome?.ok === false &&
          ['input_stale', 'input_dependency', 'input_timeout', 'out_of_reach', 'conflict'].includes(
            event.outcome.reason,
          ) &&
          miningHeld
        ) {
          lastMineKey = '';
          mineRetryAt = performance.now() + 150;
        }
        if (event.sequence === inventorySequence) publish({ inventoryPending: false });
        lastResult = event;
        if (worldActions.delete(event.sequence)) actionPending = worldActions.size;
        if (event.outcome && !event.outcome.ok) {
          const notices: Record<string, string> = {
            collision: 'אין מספיק מקום לבלוק',
            out_of_reach: 'המטרה רחוקה או מוסתרת',
            conflict: 'העולם השתנה. נסו שוב.',
            support: 'הבלוק צריך משטח מתאים',
            forbidden: 'אין הרשאה לפעולה הזאת',
            full: 'אין מקום בתיק או במשבצת היעד',
            no_recipe: 'הסידור אינו מתאים למתכון',
            insufficient: 'אין מספיק פריטים לפעולה',
            wrong_equipment: 'הפריט אינו מתאים למשבצת הציוד',
            occupied: 'יש להחליף ערימה שלמה או לבחור משבצת פנויה',
            station_required: 'צריך שולחן יצירה נגיש ליצירה בגודל 3×3',
            container_not_empty: 'צריך לרוקן את התיבה לפני הסרתה',
            not_owned: 'צריך לבחור במשבצת שמכילה את הבלוק הזה',
            tool_required: 'צריך כלי מתאים כדי לכרות את הבלוק הזה',
            mine_required: 'יש להחזיק את פעולת הכרייה',
            not_food: 'הפריט שנבחר אינו מזון',
            cooldown: 'המתינו מעט לפני אכילה נוספת',
          };
          noticeUntil = performance.now() + 1800;
          publish({ message: notices[event.outcome.reason] ?? 'לא ניתן לבצע את הפעולה כאן' });
        }
      }
      return;
    }
    if (event.type === 'error') {
      if (event.code === 'INVALID') return;
      reconnectAllowed = event.code === 'SESSION_ENDED' ? false : event.retryable;
      if (event.code === 'SESSION_ENDED' || event.code === 'RECOVERING') {
        const now = performance.now();
        worldClock.reset(worldClock.read(now), now, false);
        focus(false);
        if (event.code === 'SESSION_ENDED') phase = 'paused';
        if (ownsPointerLock()) document.exitPointerLock();
      }
      publish({
        ...(event.code === 'SESSION_ENDED' ? { lifecycle: 'ended' as const } : {}),
        ...(event.code === 'RECOVERING' ? { lifecycle: 'recovering' as const } : {}),
        status: 'error',
        message:
          event.code === 'SESSION_ENDED'
            ? 'המפגש הסתיים. אפשר לחזור לרשימת המשחקים.'
            : event.code === 'INCOMPATIBLE'
              ? 'המשחק עודכן. יש לרענן את העמוד.'
              : event.code === 'REPLACED'
                ? 'המשחק פתוח בחלון אחר.'
                : 'החיבור לעולם הופסק. אפשר להתחבר מחדש.',
      });
    }
  };
  async function connect() {
    reconnectAllowed = true;
    fatalRecovery = false;
    const generation = ++connection;
    if (connectionTimer) {
      clearTimeout(connectionTimer);
      connectionTimer = null;
    }
    socket?.close();
    clearWorld();
    publish({
      lifecycle: 'preparing',
      worldPauseReason: null,
      status: 'connecting',
      message: 'מתחברים לעולם…',
    });
    try {
      const admission = await options.admit();
      if (disposed || generation !== connection) return;
      if (admission.buildId !== identity.buildId) throw new Error('incompatible client build');
      const ws = new WebSocket(options.socketUrl);
      socket = ws;
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        if (disposed || generation !== connection) {
          ws.close();
          return;
        }
        lastReceived = performance.now();
        ws.send(
          JSON.stringify({
            type: 'hello',
            ticket: admission.ticket,
            buildId: identity.buildId,
          } satisfies ClientMessage),
        );
      };
      ws.onmessage = ({ data }) => {
        if (disposed || generation !== connection) return;
        lastReceived = performance.now();
        try {
          if (typeof data === 'string') {
            const message = parseServerMessage(data);
            if (!message) throw new Error('invalid server control message');
            handle(message);
          } else {
            const frame = decodeChunk(new Uint8Array(data), content.blocks.length);
            if (!frame) throw new Error('invalid world frame');
            const column = stream?.columns.get(columnKey(frame.x, frame.z));
            const acceptedPatch =
              frame.kind === 'patch' &&
              column &&
              !column.recovering &&
              frame.subscription === column.subscription &&
              frame.revision === column.revision + 1;
            const blastPatch = blastPatches.delete(`${frame.x},${frame.z}:${frame.revision}`);
            const effects =
              acceptedPatch && column.ready && !blastPatch
                ? frame.edits.slice(0, 8).map(([local, state]) => {
                    const cell = worldCell(frame.x, frame.z, local);
                    return { cell, state, before: world.get_block(...cell) };
                  })
                : [];
            stream?.receive(frame);
            if (
              acceptedPatch &&
              stream?.revision(frame.x, frame.z) === frame.revision &&
              !column?.recovering
            ) {
              for (const e of effects)
                if (e.before !== e.state && e.before !== 65535) {
                  renderer.editEffect(
                    e.cell,
                    e.state === 0 ? e.before : e.state,
                    performance.now(),
                    e.state === 0,
                  );
                  const state = e.state === 0 ? e.before : e.state;
                  audio.effect(
                    e.cell.map((v) => v + 0.5),
                    soundGroups.get(content.blocks[state]?.name) ?? 'stone',
                    e.state === 0,
                  );
                }
              for (const [local, state] of frame.edits)
                recentEdits.push({
                  cell: worldCell(frame.x, frame.z, local),
                  state,
                  revision: frame.revision,
                });
              recentEdits = recentEdits.slice(-32);
            }
          }
        } catch (error) {
          fail('replication', error);
        }
      };
      ws.onerror = () => diagnose('socket', 'connection failed');
      ws.onclose = () => {
        if (disposed || generation !== connection) return;
        focused = false;
        audio.setActive(false);
        keys.clear();
        touch = neutralTouch();
        if (!reconnectAllowed) return;
        publish({ status: 'recovering', message: 'החיבור הופסק. מתחברים מחדש…' });
        connectionTimer = setTimeout(() => {
          void connect();
        }, 1500);
      };
    } catch (error) {
      if (!disposed && generation === connection) {
        diagnose('admission', error);
        publish({ status: 'error', message: 'לא ניתן להתחבר לעולם. נסו שוב.' });
      }
    }
  }
  function controls(): Controls {
    const body = slot === null ? null : world.player_state(slot);
    const heldJump = !!body && (body[10] === 1 || body[7] === 1 || body[9] === 1);
    const value = {
      x: Math.max(-1, Math.min(1, touch.x + Number(keys.has('KeyD')) - Number(keys.has('KeyA')))),
      z: Math.max(-1, Math.min(1, touch.z + Number(keys.has('KeyS')) - Number(keys.has('KeyW')))),
      yaw,
      pitch,
      jump: heldJump ? keys.has('Space') || touch.jump : jump,
      sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sneak,
      sprint: keys.has('ControlLeft') || keys.has('ControlRight') || touch.sprint,
    };
    jump = false;
    return value;
  }
  function aimsAtActor(now: number): boolean {
    if (!prediction) return false;
    const p = world.player_state(prediction.slot),
      cos = Math.cos(pitch),
      origin = [p[0], p[1] + 1.62, p[2]],
      direction = [Math.sin(yaw) * cos, Math.sin(pitch), -Math.cos(yaw) * cos];
    const item = content.items.find(
      (item) => item.itemType === hud.inventory?.bag[hud.selectedSlot]?.itemType,
    );
    return remotes.frame(now).some((actor) => {
      const distance = rayBody(origin, direction, actor.position, combatProfile(item).reach);
      if (distance === null) return false;
      const end = origin.map((value, axis) => value + direction[axis] * (distance + 1e-4));
      return world.line_clear(origin[0], origin[1], origin[2], end[0], end[1], end[2]);
    });
  }
  function ignite(): boolean {
    if (!target) return true;
    if (
      !prediction ||
      !stream ||
      !hud.inventory ||
      inventoryEpoch !== prediction.currentEpoch ||
      actionPending >= 16
    )
      return false;
    const revision = stream.revision(target[0] >> 4, target[2] >> 4);
    if (revision < 0) return false;
    flush();
    renderer.swing(performance.now());
    const sequence = ++actionSequence;
    send({
      type: 'ignite',
      epoch: prediction.currentEpoch,
      sequence,
      inputSequence: prediction.currentSequence,
      target: [...target],
      revision,
      inventoryRevision: hud.inventory.revision,
    });
    worldActions.add(sequence);
    actionPending = worldActions.size;
    return true;
  }
  function attack(): boolean {
    if (
      !prediction ||
      !hud.inventory ||
      inventoryEpoch !== prediction.currentEpoch ||
      actionPending >= 16
    )
      return false;
    flush();
    renderer.swing(performance.now());
    const sequence = ++actionSequence;
    send({
      type: 'attack',
      epoch: prediction.currentEpoch,
      sequence,
      inputSequence: prediction.currentSequence,
      inventoryRevision: hud.inventory.revision,
    });
    worldActions.add(sequence);
    actionPending = worldActions.size;
    return true;
  }
  function interaction(kind: 'place' | 'remove' | 'collect') {
    if (hud.mode === 'survival' && kind === 'remove') {
      miningHeld = miningSingle = true;
      return;
    }
    if (!prediction || !stream || !target || !targetNormal || actionPending >= 16) return;
    const hit = content.blocks[world.get_block(...target)];
    let destination: Cell = target;
    if (kind === 'place' && !hit?.replaceable)
      destination = [
        target[0] + targetNormal[0],
        target[1] + targetNormal[1],
        target[2] + targetNormal[2],
      ];
    const revisions = new Map<string, { x: number; z: number; revision: number }>();
    for (const c of [target, destination]) {
      const x = c[0] >> 4,
        z = c[2] >> 4,
        revision = stream.revision(x, z);
      if (revision < 0) return;
      revisions.set(columnKey(x, z), { x, z, revision });
    }
    flush();
    renderer.swing(performance.now());
    const sequence = ++actionSequence;
    send({
      type: 'action',
      epoch: prediction.currentEpoch,
      sequence,
      inputSequence: prediction.currentSequence,
      kind,
      target,
      state: kind === 'collect' ? 0 : hud.selected,
      inventoryRevision: hud.inventory?.revision ?? 0,
      revisions: [...revisions.values()],
    });
    worldActions.add(sequence);
    actionPending = worldActions.size;
  }
  function sendMining(target: Cell | null): void {
    if (!prediction || !stream || socket?.readyState !== WebSocket.OPEN) return;
    flush();
    mineRequest = ++actionSequence;
    send({
      type: 'mining',
      epoch: prediction.currentEpoch,
      sequence: mineRequest,
      inputSequence: target ? prediction.currentSequence : 0,
      target,
      revision: target ? Math.max(0, stream.revision(target[0] >> 4, target[2] >> 4)) : 0,
      inventoryRevision: hud.inventory?.revision ?? 0,
    });
  }
  function miningControl(ready: boolean, sampled: boolean): void {
    if (hud.mode !== 'survival') return;
    if (!miningHeld || !focused || !ready || fatalRecovery || phase !== 'playing') {
      if (lastMineKey) sendMining(null);
      lastMineKey = '';
      return;
    }
    if (
      !sampled ||
      performance.now() < mineRetryAt ||
      !target ||
      !hud.inventory ||
      hud.inventoryPending ||
      inventoryEpoch !== prediction?.currentEpoch
    )
      return;
    const stack = hud.inventory.bag[hud.inventory.selected];
    const key = `${target.join(',')}:${world.get_block(...target)}:${hud.inventory.selected}:${stack?.itemType ?? ''}:${stack?.instance?.durability ?? 0}`;
    if (key !== lastMineKey) {
      lastMineKey = key;
      sendMining([...target]);
      renderer.swing(performance.now());
    }
  }
  function updateTarget(position: ArrayLike<number>) {
    const selected = hud.inventory?.bag[hud.selectedSlot],
      collects =
        hud.mode === 'survival' &&
        content.items.some((item) => item.itemType === selected?.itemType && item.collects);
    const cos = Math.cos(pitch),
      hit = (collects ? world.raycast_liquids.bind(world) : world.raycast.bind(world))(
        position[0],
        position[1] + 1.62,
        position[2],
        Math.sin(yaw) * cos,
        Math.sin(pitch),
        -Math.cos(yaw) * cos,
        6,
      );
    target = hit[0] ? [hit[1], hit[2], hit[3]] : null;
    targetNormal = hit[0] ? [hit[4], hit[5], hit[6]] : null;
    const key = target
      ? `${target.join(',')}:${world.get_block(...target)}:${renderer.origin.x}:${renderer.origin.z}`
      : '';
    if (key !== lastHighlight) {
      lastHighlight = key;
      const boxes: number[][] = [];
      if (target) {
        const raw = world.target_boxes(...target);
        for (let i = 0; i < raw.length; i += 6) boxes.push(Array.from(raw.subarray(i, i + 6)));
      }
      renderer.target(boxes, target);
    }
  }
  function update(now: number) {
    if (disposed) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastUpdate) / 1000));
    lastUpdate = now;
    environment = sampleEnvironment(worldClock.read(now), environmentSeed);
    accumulator += dt;
    if (prediction && stream) {
      let state = world.player_state(prediction.slot);
      stream.setCenter(state[0], state[2], yaw);
      stream.pump(2);
      if (phase === 'preparing' && baselineReceived && now - lastReady > 300) {
        const columns = stream.readyAround(state);
        if (columns && stream.meshCount > 0) {
          send({ type: 'ready', epoch: prediction.currentEpoch, columns });
          lastReady = now;
        }
      }
      const ready = stream.readyAround(state) !== null,
        stalled = now - lastReceived > 1500;
      if (ready && now - lastSkyProbe > 250) {
        lastSkyProbe = now;
        openSky = world.raycast(state[0], state[1] + 1.9, state[2], 0, 1, 0, 256)[0] === 0;
      }
      if (
        phase === 'playing' &&
        !ready &&
        !stalled &&
        hud.status !== 'loading' &&
        !['error', 'recovering'].includes(hud.status)
      )
        publish({ status: 'loading', message: 'ממתינים לטעינת השטח…' });
      else if (phase === 'playing' && ready && hud.status === 'loading')
        publish({
          status: focused ? 'playing' : 'paused',
          message: focused ? '' : 'לחצו על העולם כדי להמשיך',
        });
      if (stalled && hud.status !== 'recovering' && hud.status !== 'error')
        publish({ status: 'stalled', message: 'ממתינים לחיבור…' });
      let steps = 0;
      let sampled = false;
      while (accumulator >= 1 / 60 && steps++ < 6) {
        accumulator -= 1 / 60;
        if (phase === 'playing' && focused && ready && !stalled && state[12] === 0) {
          const sample = prediction.sample(controls());
          if (sample) {
            sampled = true;
            pendingInputs.push(sample);
            updateTarget(world.player_state(prediction.slot));
            if (queuedAction) {
              if (queuedAction === 'attack') {
                if (attack()) queuedAction = null;
              } else if (queuedAction === 'ignite') {
                if (ignite()) queuedAction = null;
              } else {
                interaction(queuedAction);
                queuedAction = null;
              }
            }
          } else fail('prediction', 'input acknowledgement stalled');
        }
      }
      if (now - lastSend >= 1000 / 30) flush();
      miningControl(ready && !stalled, sampled);
      state = world.player_state(prediction.slot);
      lastPosition = Array.from(state.subarray(0, 3));
      if (
        focused &&
        phase === 'playing' &&
        ready &&
        !stalled &&
        !fatalRecovery &&
        state[6] === 1 &&
        state[10] === 0
      ) {
        if (previousFoot)
          footTravel += Math.min(
            0.5,
            Math.hypot(lastPosition[0] - previousFoot[0], lastPosition[2] - previousFoot[2]),
          );
        if (footTravel >= 1.4 && now - lastFootstep >= 180) {
          const beneath = world.get_block(
            Math.floor(state[0]),
            Math.floor(state[1] - 0.05),
            Math.floor(state[2]),
          );
          audio.effect(
            [state[0], state[1] + 0.02, state[2]],
            soundGroups.get(content.blocks[beneath]?.name ?? '') ?? 'stone',
            false,
          );
          footTravel %= 1.4;
          lastFootstep = now;
        }
      } else footTravel = 0;
      previousFoot = lastPosition;
      audio.frame(
        lastPosition,
        yaw,
        pitch,
        environment,
        openSky,
        focused && phase === 'playing' && !fatalRecovery,
      );
      for (let i = 0; i < 3; i++) visualOffset[i] *= Math.exp(-dt * 12);
      updateTarget(state);
      if (now - lastHud > 100) {
        lastHud = now;
        if (noticeUntil && now > noticeUntil) {
          noticeUntil = 0;
          publish({ message: focused ? '' : 'לחצו על העולם כדי להמשיך' });
        }
        publish({
          players: remotes.size + 1,
          environment: environmentHud(),
          flying: state[10] === 1,
          pointerLocked: ownsPointerLock(),
          ...(phase === 'playing' && !stalled && hud.status === 'stalled'
            ? { status: focused ? ('playing' as const) : ('paused' as const), message: '' }
            : {}),
        });
      }
    } else {
      accumulator = 0;
    }
  }
  function frame(now: number) {
    if (disposed) return;
    lastFrame = now;
    draw(
      lastPosition.map((v, i) => v + visualOffset[i]),
      now,
    );
    animation = requestAnimationFrame(frame);
  }
  function draw(position: readonly number[], now: number) {
    // Controls/prediction/streaming/network use their own timer; GPU submission
    // frequency does not schedule or mint control steps. Main-thread stalls still apply.
    const interval = 1000 / (focused && phase === 'playing' ? renderHz : 10);
    if (now < nextDraw) return;
    nextDraw = now + interval - ((now - nextDraw) % interval);
    const state = slot === null ? null : world.player_state(slot);
    try {
      renderer.frame(position, yaw, pitch, remotes.frame(now), now, environment, openSky, {
        state: hud.selected,
        speed: state ? Math.hypot(state[3], state[5]) : 0,
        active: focused && phase === 'playing' && !fatalRecovery,
        itemType:
          hud.mode === 'survival' ? (hud.inventory?.bag[hud.selectedSlot]?.itemType ?? null) : null,
        drops: [...dropped.values()],
        explosives: [...primed.values()],
        vision:
          hud.mode === 'survival' &&
          equipmentEffects(
            (hud.inventory?.equipment ?? []).flatMap((stack) => {
              const item = stack && content.items.find((item) => item.itemType === stack.itemType);
              return item ? [item] : [];
            }),
          ).vision,
      });
    } catch (error) {
      fail('webgl', error);
    }
  }
  const resize = () =>
    renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const onKeyDown = (event: KeyboardEvent) => {
    if (!focused || (inputMode === 'desktop' && !ownsPointerLock())) return;
    if (
      [
        'Space',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ShiftLeft',
        'ShiftRight',
        'ControlLeft',
        'ControlRight',
      ].includes(event.code)
    ) {
      event.preventDefault();
      if (event.code === 'Space' && !keys.has('Space')) jump = true;
      keys.add(event.code);
    }
    if (event.code === 'KeyF' && !event.repeat) command({ type: 'flight' });
    if (event.code === 'KeyR' && !event.repeat) command({ type: 'eat' });
    if (event.code === 'KeyQ' && !event.repeat) command({ type: 'attack' });
    if (event.code === 'KeyG' && !event.repeat) command({ type: 'ignite' });
    if (/^Digit[1-9]$/.test(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      if (hud.mode === 'survival') command({ type: 'select-slot', slot: index });
      else {
        const selected = hotbar[index];
        if (selected) command({ type: 'select', state: selected.state });
      }
    }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onMouseMove = (event: MouseEvent) => {
    if (!ownsPointerLock()) return;
    look(event.movementX, event.movementY);
  };
  function look(dx: number, dy: number) {
    if (!focused || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    yaw = Math.atan2(Math.sin(yaw + dx * 0.002), Math.cos(yaw + dx * 0.002));
    pitch = Math.max(-1.55, Math.min(1.55, pitch - dy * 0.002));
  }
  const onPointerLock = () => {
    if (inputMode === 'touch') return;
    if (hud.lifecycle === 'ended') {
      publish({ pointerLocked: false });
      return;
    }
    if (phase === 'dead') {
      publish({ pointerLocked: false });
      return;
    }
    const locked = ownsPointerLock();
    focus(locked && document.visibilityState === 'visible');
    publish({
      pointerLocked: locked,
      status: fatalRecovery
        ? 'recovering'
        : phase === 'playing'
          ? locked
            ? 'playing'
            : 'paused'
          : hud.status,
      message:
        hud.role === 'participant' && hud.lifecycle === 'paused'
          ? 'העולם מושהה.'
          : locked
            ? ''
            : 'לחצו על העולם כדי להמשיך',
    });
  };
  const onMouseDown = (event: MouseEvent) => {
    if (inputMode === 'touch') return;
    if (!ownsPointerLock()) {
      command({ type: 'resume' });
      return;
    }
    if (event.button === 0) {
      if (hud.mode === 'survival') command({ type: 'mine', active: true });
      else queuedAction = 'remove';
    }
    if (event.button === 2) command({ type: 'interact', kind: 'place' });
  };
  const onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) command({ type: 'mine', active: false });
  };
  const onBlur = () => focus(false);
  const onVisibility = () => {
    if (document.visibilityState !== 'visible') focus(false);
  };
  const onContext = (event: Event) => event.preventDefault();
  const onContextLost = (event: Event) => {
    event.preventDefault();
    renderer.contextLost();
    focus(false);
    fail('webgl', 'context lost');
  };
  const onContextRestored = () => {
    publish({ status: 'error', message: 'התצוגה הופעלה מחדש. יש לרענן את העמוד.' });
  };
  function sendInventory(operation: InventoryCommand): void {
    if (socket?.readyState !== WebSocket.OPEN || performance.now() - lastReceived > 1500) return;
    if (
      !prediction ||
      phase !== 'playing' ||
      fatalRecovery ||
      (hud.inventoryPending && operation.kind !== 'close')
    )
      return;
    if (operation.kind !== 'open' && inventoryEpoch !== prediction.currentEpoch) return;
    inventorySequence = ++actionSequence;
    publish({ inventoryPending: true });
    send({
      type: 'inventory',
      epoch: prediction.currentEpoch,
      sequence: inventorySequence,
      operation,
    });
  }
  function openInventory(operation: Extract<InventoryCommand, { kind: 'open' }>): void {
    if (!prediction || phase !== 'playing' || fatalRecovery) return;
    publish({ inventoryOpen: true });
    pendingInventoryOpen = operation;
    if (focused) {
      focus(false);
      if (ownsPointerLock()) document.exitPointerLock();
    }
    if (focusPending) publish({ inventoryPending: true });
    else {
      pendingInventoryOpen = null;
      sendInventory(operation);
    }
  }
  function command(cmd: RuntimeCommand) {
    if (disposed) return;
    if (cmd.type === 'ignite') {
      if (hud.canIgnite && focused && phase === 'playing') {
        miningHeld = miningSingle = false;
        if (lastMineKey) sendMining(null);
        lastMineKey = '';
        queuedAction = 'ignite';
      }
      return;
    }
    if (cmd.type === 'attack') {
      if (hud.combat && focused && phase === 'playing') {
        miningHeld = miningSingle = false;
        if (lastMineKey) sendMining(null);
        lastMineKey = '';
        queuedAction = 'attack';
      }
      return;
    }
    if (cmd.type === 'eat') {
      if (hud.mode === 'survival' && hud.inventory && hud.vitals && hud.vitals.food < 20)
        sendInventory({
          kind: 'consume',
          slot: hud.selectedSlot,
          revision: hud.inventory.revision,
        });
      return;
    }
    if (cmd.type === 'respawn') {
      if (prediction && phase === 'dead' && hud.vitals?.respawnIn === 0)
        send({ type: 'respawn', epoch: prediction.currentEpoch, sequence: ++actionSequence });
      return;
    }
    if (cmd.type === 'mine') {
      if (cmd.active && hud.combat && aimsAtActor(performance.now())) {
        command({ type: 'attack' });
        return;
      }
      miningSingle = false;
      if (hud.mode === 'creative') {
        if (cmd.active && !miningHeld) queuedAction = 'remove';
        miningHeld = cmd.active;
      } else {
        miningHeld = cmd.active;
        if (!cmd.active) {
          if (lastMineKey) sendMining(null);
          lastMineKey = '';
        }
      }
      return;
    }
    if (cmd.type === 'select-slot') {
      if (
        hud.mode === 'survival' &&
        hud.inventory &&
        Number.isInteger(cmd.slot) &&
        cmd.slot >= 0 &&
        cmd.slot < 9
      )
        sendInventory({ kind: 'select', slot: cmd.slot, revision: hud.inventory.revision });
      return;
    }
    if (cmd.type === 'inventory-target') {
      if (target) openInventory({ kind: 'open', target: [...target] });
      return;
    }
    if (cmd.type === 'inventory') {
      if (cmd.operation.kind === 'open') openInventory(cmd.operation);
      else {
        if (cmd.operation.kind === 'close') {
          pendingInventoryOpen = null;
          publish({ inventoryOpen: false });
        }
        sendInventory(cmd.operation);
      }
      return;
    }
    if (
      cmd.type === 'select' &&
      hud.mode === 'creative' &&
      hotbar.some((i) => i.state === cmd.state)
    ) {
      publish({ selected: cmd.state });
      syncPalette();
    } else if (cmd.type === 'interact') {
      const item = content.items.find(
        (item) => item.itemType === hud.inventory?.bag[hud.selectedSlot]?.itemType,
      );
      if (cmd.kind === 'place' && hud.mode === 'survival' && item?.igniter)
        command({ type: 'ignite' });
      else if (cmd.kind === 'place' && hud.mode === 'survival' && item?.collects)
        queuedAction = 'collect';
      else queuedAction = cmd.kind;
    } else if (cmd.type === 'resume') {
      if (hud.lifecycle === 'ended' || (hud.role === 'participant' && hud.lifecycle !== 'playing'))
        return;
      if (hud.inventoryOpen || phase === 'dead') return;
      audio.unlock();
      if (inputMode === 'touch') {
        focus(document.visibilityState === 'visible' && document.hasFocus());
        if (focused) publish({ status: phase === 'playing' ? 'playing' : hud.status, message: '' });
      } else if (typeof canvas.requestPointerLock === 'function') {
        // The browser API exists in both void and Promise-returning forms.
        try {
          void Promise.resolve(canvas.requestPointerLock()).catch((error) =>
            diagnose('pointer_lock', error),
          );
        } catch (error) {
          diagnose('pointer_lock', error);
        }
      } else
        publish({
          status: 'unsupported',
          message: 'הדפדפן אינו תומך בלכידת העכבר. אפשר להשתמש במכשיר מגע.',
        });
    } else if (cmd.type === 'pause') {
      if (phase === 'dead') return;
      focus(false);
      if (ownsPointerLock()) document.exitPointerLock();
      publish({ status: 'paused', message: 'לחצו על העולם כדי להמשיך' });
    } else if (cmd.type === 'mute-effects') {
      audio.setMuted(cmd.muted);
      publish({ effectsMuted: cmd.muted });
      if (!cmd.muted) audio.unlock();
    } else if (cmd.type === 'look' && inputMode === 'touch') look(cmd.dx, cmd.dy);
    else if (cmd.type === 'touch' && inputMode === 'touch' && focused) {
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.z)) return;
      if (cmd.jump && !touch.jump) jump = true;
      touch = {
        x: Math.max(-1, Math.min(1, cmd.x)),
        z: Math.max(-1, Math.min(1, cmd.z)),
        jump: cmd.jump,
        sneak: cmd.sneak,
        sprint: cmd.sprint,
      };
    } else if (cmd.type === 'fullscreen')
      void (options.fullscreenElement ?? host)
        .requestFullscreen?.()
        .catch((error) => diagnose('fullscreen', error));
    else if (cmd.type === 'reconnect' && hud.lifecycle !== 'ended') void connect();
    else if (
      cmd.type === 'flight' &&
      prediction &&
      phase === 'playing' &&
      (hud.mode === 'creative' || hud.role === 'observer')
    ) {
      flush();
      send({
        type: 'flight',
        epoch: prediction.currentEpoch,
        sequence: ++actionSequence,
        on: !hud.flying,
      });
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerlockchange', onPointerLock);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', onContext);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  updateTimer = setInterval(() => update(performance.now()), 1000 / 60);
  animation = requestAnimationFrame(frame);
  const runtime: VoxelRuntime = {
    command,
    voiceScene() {
      if (
        disposed ||
        fatalRecovery ||
        !baselineReceived ||
        !prediction ||
        phase === 'preparing' ||
        socket?.readyState !== WebSocket.OPEN ||
        hud.lifecycle === 'ended' ||
        hud.lifecycle === 'recovering' ||
        document.visibilityState !== 'visible' ||
        performance.now() - lastReceived > 3000
      )
        return null;
      return voiceScene(
        lastPosition.map((v, i) => v + visualOffset[i]),
        yaw,
        pitch,
        remotes.frame(performance.now()),
        (from, to) => world.line_clear(...from, ...to),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(hud);
      return () => listeners.delete(listener);
    },
    debug() {
      return {
        disposed,
        inputMode,
        mode: hud.mode,
        lifecycle: hud.lifecycle,
        worldPauseReason: hud.worldPauseReason,
        worldTick: worldClock.read(performance.now()),
        mining: hud.mining,
        vitals: hud.vitals,
        combat: hud.combat,
        hit: hud.hit,
        lastHitEvent,
        lastExplosionEvent,
        explosives: [...primed.values()],
        canIgnite: hud.canIgnite,
        miningHeld,
        drops: [...dropped.values()],
        selectedSlot: hud.selectedSlot,
        environment: { ...environment, openSky },
        atmosphere: renderer.atmosphere,
        avatars: renderer.actors,
        renderOrigin: { x: renderer.origin.x, z: renderer.origin.z },
        feedback: renderer.feedback,
        audio: audio.stats,
        renderLimitHz: disposed ? 0 : focused && phase === 'playing' ? renderHz : 10,
        touch: { ...touch },
        focused,
        visible: document.visibilityState,
        hasFocus: document.hasFocus(),
        lastFrame,
        lastUpdate,
        resources: {
          geometries: renderer.gl.info.memory.geometries,
          textures: renderer.gl.info.memory.textures,
          workers: pool?.liveCount ?? 0,
        },
        actorId,
        worldId,
        body:
          slot === null
            ? null
            : {
                position: Array.from(world.player_state(slot).subarray(0, 3)),
                onGround: world.player_state(slot)[6],
                inWater: world.player_state(slot)[7],
                eyesInWater: world.player_state(slot)[8],
                frozen: world.player_state(slot)[12],
                flying: world.player_state(slot)[10],
                velocity: Array.from(world.player_state(slot).subarray(3, 6)),
              },
        view: { yaw, pitch },
        lastResult,
        inventory: hud.inventory,
        inventoryOpen: hud.inventoryOpen,
        inventoryPending: hud.inventoryPending,
        recentEdits,
        status: hud.status,
        epoch: prediction?.currentEpoch,
        phase,
        position: lastPosition,
        selected: hud.selected,
        players: remotes.size + 1,
        inputLag: prediction?.inputLag,
        correction: prediction?.correction,
        columns: stream?.columns.size,
        collisionColumns: stream?.collisionCount,
        meshed: stream?.meshCount,
        workers: pool?.count,
        activeJobs: pool?.active,
        stream: stream?.stats,
        render: { ...renderer.stats, gpu: renderer.gpuStats },
        target,
        targetState: !disposed && target ? world.get_block(...target) : null,
        targetNormal,
        actionPending,
        queuedAction,
        actionSequence,
        lastReceivedAgoMs: performance.now() - lastReceived,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      options.signal?.removeEventListener('abort', onAbort);
      connection++;
      cancelAnimationFrame(animation);
      if (updateTimer !== null) {
        clearInterval(updateTimer);
        updateTimer = null;
      }
      if (connectionTimer) clearTimeout(connectionTimer);
      socket?.close();
      if (ownsPointerLock()) document.exitPointerLock();
      if (Object.is(document.fullscreenElement, options.fullscreenElement ?? host)) {
        try {
          void Promise.resolve(document.exitFullscreen()).catch((error) =>
            diagnose('fullscreen', error),
          );
        } catch (error) {
          diagnose('fullscreen', error);
        }
      }
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerlockchange', onPointerLock);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      clearWorld();
      renderer.dispose();
      void audio.dispose();
      world.free();
      listeners.clear();
      canvas.remove();
    },
  };
  const onAbort = () => runtime.dispose();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) runtime.dispose();
  else void connect();
  return runtime;
}
