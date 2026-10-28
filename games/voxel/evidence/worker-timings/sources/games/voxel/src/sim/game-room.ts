import { readStaffCommand } from '../shared/staff.ts';
import type { StaffCommand, StaffResult } from '../shared/staff.ts';
import { ActionLedger } from './action-ledger.ts';
import { InputQueue } from './input-queue.ts';
import { FixedScheduler } from './scheduler.ts';
import { WorldStore } from './world-store.ts';
import type { WorldPort, GeneratorPort } from '../shared/engine-port.ts';
import {
  readRoomCheckpoint,
  RECONNECT_RESERVATION_MS,
  validCheckpointBody,
} from './room-checkpoint.ts';
import type { RoomCheckpoint, RoomCheckpointInput } from './room-checkpoint.ts';
import { checkpointObject } from './checkpoint-values.ts';
import { localIndex } from '../shared/chunk-wire.ts';
import { Inventories } from './inventory.ts';
import { Drops } from './drops.ts';
import { miningPlan } from './mining.ts';
import { Vitals } from './vitals.ts';
import { exposedToSun } from './sunlight.ts';
import { Explosives } from './explosives.ts';
import { blastPlan } from './blast.ts';
import { CHAIN_FUSE, EXPLOSIONS_PER_TICK, EXPLOSIVE_RADIUS } from '../shared/explosives.ts';
import type { ExplosionEvent } from '../shared/explosives.ts';
import { combatProfile, rayBody } from '../shared/combat.ts';
import type { HitEvent } from '../shared/combat.ts';
import { equipmentEffects } from '../shared/vitals.ts';
import { makeStack, sameStack } from '../shared/inventory.ts';
import type { Slot } from '../shared/inventory.ts';
import type { GameMode, MiningView, DropView } from '../shared/gameplay.ts';
import type { LifecycleView, PauseReason } from '../shared/lifecycle.ts';
import { DROP_RADIUS, PICKUP_RADIUS } from '../shared/gameplay.ts';
import { stepBoundedMovement, DEFAULT_MOVEMENT } from '../shared/movement.ts';
import type { MovementModifiers } from '../shared/movement.ts';
import { NEUTRAL } from '../shared/input.ts';
import { ENVIRONMENT_VERSION, sampleEnvironment } from '../shared/environment.ts';
import type { Controls } from '../shared/input.ts';
import {
  around,
  columnKey,
  GENERATOR_VERSION,
  inBounds,
  STREAM_RADIUS,
  BOUNDS,
} from '../shared/protocol.ts';
import type {
  ClientMessage,
  ServerMessage,
  BuildIdentity,
  Cell,
  ActorState,
  ActorDelta,
} from '../shared/protocol.ts';
import type { ChunkFrame } from '../shared/chunk-wire.ts';
import type { ContentManifest } from '../shared/content.ts';
import { sameAppearance } from '../shared/appearance.ts';
import { blockDrops } from '../shared/loot.ts';
export type Capabilities = {
  build: boolean;
  fly: boolean;
  observe: boolean;
  combat: boolean;
  explosives: boolean;
};
export type AdmittedActor = {
  id: string;
  role: 'participant' | 'observer';
  capabilities: Capabilities;
};
export type RoomPorts = {
  send(connection: string, event: ServerMessage | ChunkFrame): void;
  /** Actual individual scheduler steps, including replication through send(). */
  onStep?(kind: 'world' | 'observer', elapsedMs: number): void;
  close(
    connection: string,
    reason: 'REPLACED' | 'RECOVERING' | 'UNAUTHORIZED' | 'SESSION_ENDED',
  ): void;
};
type Outcome = { ok: boolean; reason: string; cell?: Cell; state?: number; revision?: number };
type RestingPose = { state: Float64Array; yaw: number; pitch: number; until: number };
type RoomRecovery = {
  data: RoomCheckpointInput;
  owners: ReadonlyMap<string, AdmittedActor | null>;
};
type Actor = {
  id: string;
  role: 'participant' | 'observer';
  capabilities: Capabilities;
  connection: string | null;
  slot: number;
  epoch: number;
  queue: InputQueue;
  ledger: ActionLedger<Outcome>;
  controls: Controls;
  phase: 'preparing' | 'playing' | 'dead';
  vitals: Vitals;
  movement: MovementModifiers;
  deathHandled: boolean;
  lastVitals: string;
  resolved: boolean;
  spawnNew: boolean;
  focused: boolean;
  disconnectedAt: number;
  saved: Float64Array;
  subscriptions: Map<string, { x: number; z: number; id: number }>;
  nextSubscription: number;
  visible: Map<string, ActorState>;
  catalogItem: string | null;
  catalogSequence: number;
  pending: Map<
    number,
    {
      message: Extract<ClientMessage, { type: 'action' | 'mining' | 'attack' | 'ignite' }>;
      expires: number;
    }
  >;
  mining:
    | (MiningView & {
        target: Cell;
        state: number;
        cellRevision: number;
        slot: number;
        stack: Slot;
      })
    | null;
  visibleDrops: Map<string, number>;
  dropsReset: boolean;
  visibleExplosives: Map<string, number>;
  explosivesReset: boolean;
};
export class GameRoom {
  readonly store: WorldStore;
  readonly inventories: Inventories;
  readonly drops: Drops;
  readonly explosives: Explosives;
  private currentMode: GameMode;
  get mode(): GameMode {
    return this.currentMode;
  }
  private paused = false;
  private pausedAt = 0;
  private ended = false;
  private pauseReason: PauseReason = 'manual';
  readonly actors = new Map<string, Actor>();
  private vitals = new Map<string, Vitals>();
  private resting = new Map<string, RestingPose>();
  private policies = new Map<string, { role: AdmittedActor['role']; capabilities: Capabilities }>();
  private ownerAuthorizations: Map<string, { actor: AdmittedActor | null; until: number }> | null =
    null;
  private clock: FixedScheduler;
  private observerClock: FixedScheduler;
  private observerTick = 0;
  private tick = 0;
  private epoch = 0;
  private hitSequence = 0;
  private explosionSequence = 0;
  private spawn: [number, number, number];
  private content: ContentManifest;
  private build: BuildIdentity;
  private ports: RoomPorts;
  private worldId: string;
  private seed: number;
  constructor(
    store: WorldStore,
    content: ContentManifest,
    build: BuildIdentity,
    ports: RoomPorts,
    worldId: string,
    seed: number,
    now: number,
    initialTick = 0,
    mode: GameMode = 'creative',
    recovery?: RoomRecovery,
  ) {
    if (!Number.isFinite(now) || now < 0) throw new Error('invalid room checkpoint time');
    if (!Number.isSafeInteger(initialTick) || initialTick < 0)
      throw new Error('invalid world tick');
    this.tick = initialTick;
    this.store = store;
    this.content = content;
    this.build = build;
    this.ports = ports;
    this.worldId = worldId;
    this.seed = seed;
    this.currentMode = mode;
    this.drops = recovery ? Drops.fromCheckpoint(content, recovery.data.drops) : new Drops(content);
    this.explosives = recovery
      ? Explosives.fromCheckpoint(content, recovery.data.explosives)
      : new Explosives();
    const access = {
      station: (cell: Cell) =>
        content.behavior.find(
          (b) => b.family === content.blocks[store.world.get_block(...cell)]?.name,
        )?.interaction ?? null,
      canUse: (id: string, cell: Cell, opening: boolean) => this.canUseStation(id, cell, opening),
    };
    this.inventories = recovery
      ? Inventories.fromCheckpoint(content, access, recovery.data.inventories)
      : new Inventories(content, access);
    this.clock = new FixedScheduler(now);
    this.observerClock = new FixedScheduler(now);
    const p = store.generator.find_spawn();
    this.spawn = [
      Math.max(-224, Math.min(224, p[0])) + 0.5,
      Math.min(250, p[1] + 2),
      Math.max(-224, Math.min(224, p[2])) + 0.5,
    ];
    if (recovery) {
      const d = recovery.data,
        own = this.inventories.checkpoint(),
        playerIds = new Set(d.players.map((p) => p.id));
      if (own.players.length !== d.players.length || own.players.some((p) => !playerIds.has(p.id)))
        throw new Error('incoherent room ownership checkpoint');
      if ((d.drops as { tick: number }).tick !== d.tick)
        throw new Error('incoherent room checkpoint drop clock');
      this.paused = d.paused;
      this.pausedAt = now;
      this.epoch = d.epoch + 1;
      this.hitSequence = d.hitSequence;
      this.explosionSequence = d.explosionSequence;
      this.spawn = [...d.spawn];
      const inventoryById = new Map(own.players.map((p) => [p.id, p]));
      for (const p of d.players) {
        const inventory = inventoryById.get(p.id)!;
        if (
          p.vitals.health === 0 &&
          [...inventory.bag, ...inventory.craft2, ...inventory.craft3, ...inventory.equipment].some(
            Boolean,
          )
        )
          throw new Error('incoherent dead ownership checkpoint');
        this.vitals.set(p.id, Vitals.fromCheckpoint(p.vitals));
        this.resting.set(p.id, {
          state: new Float64Array(p.state),
          yaw: p.yaw,
          pitch: p.pitch,
          until:
            p.reservationMs === 0 ? now - 1 : now + (p.reservationMs ?? RECONNECT_RESERVATION_MS),
        });
      }
      const owners = new Set(this.explosives.checkpoint(content).entries.map((body) => body.owner));
      for (const id of owners) {
        if (!playerIds.has(id)) throw new Error('incoherent explosive owner checkpoint');
        if (!recovery.owners.has(id)) throw new Error('restored explosive owner policy missing');
        const owner = recovery.owners.get(id);
        if (
          owner !== null &&
          (!checkpointObject(owner, ['id', 'role', 'capabilities']) ||
            owner.id !== id ||
            !['participant', 'observer'].includes(owner.role) ||
            !checkpointObject(owner.capabilities, [
              'build',
              'fly',
              'observe',
              'combat',
              'explosives',
            ]) ||
            !['build', 'fly', 'observe', 'combat', 'explosives'].every(
              (key) => typeof owner.capabilities[key as keyof Capabilities] === 'boolean',
            ))
        )
          throw new Error('invalid restored owner policy');
        this.policies.set(
          id,
          owner
            ? { role: owner.role, capabilities: { ...owner.capabilities } }
            : {
                role: 'participant',
                capabilities: {
                  build: false,
                  fly: false,
                  observe: false,
                  combat: false,
                  explosives: false,
                },
              },
        );
      }
      if (
        this.drops
          .checkpoint(d.tick)
          .entries.some((drop) => drop.owner !== null && !playerIds.has(drop.owner))
      )
        throw new Error('incoherent drop owner checkpoint');
      for (const chest of own.chests) {
        const state = this.store
          .edits(chest.cell[0] >> 4, chest.cell[2] >> 4)
          .find(([local]) => local === localIndex(...chest.cell))?.[1];
        if (
          state === undefined ||
          content.behavior.find((rule) => rule.family === content.blocks[state]?.name)
            ?.interaction !== 'container'
        )
          throw new Error('incoherent checkpoint chest terrain');
      }
    }
  }
  static fromCheckpoint(
    world: WorldPort,
    generator: GeneratorPort,
    content: ContentManifest,
    build: BuildIdentity,
    ports: RoomPorts,
    value: unknown,
    now: number,
    owners: ReadonlyMap<string, AdmittedActor | null> = new Map(),
  ): GameRoom {
    const data = readRoomCheckpoint(value, content, build);
    const store = WorldStore.fromCheckpoint(world, generator, content, data.world);
    return new GameRoom(
      store,
      content,
      build,
      ports,
      data.worldId,
      data.seed,
      now,
      data.tick,
      data.mode,
      { data, owners },
    );
  }
  checkpoint(now: number): RoomCheckpoint {
    if (!Number.isFinite(now) || now < 0) throw new Error('invalid room checkpoint time');
    const reservationNow = this.paused ? this.pausedAt : now;
    const players = [...this.vitals].map(([id, vitals]) => {
      const actor = this.actors.get(id),
        pose = this.resting.get(id),
        state = actor?.connection
          ? this.store.world.player_state(actor.slot)
          : (actor?.saved ?? pose?.state);
      if (
        !state ||
        !validCheckpointBody(Array.from(state)) ||
        (actor?.connection &&
          actor.role === 'participant' &&
          actor.vitals.dead &&
          !actor.deathHandled)
      )
        throw new Error('room checkpoint is not at a coherent actor boundary');
      return Object.freeze({
        id,
        state: Object.freeze(Array.from(state)),
        yaw: actor?.controls.yaw ?? pose!.yaw,
        pitch: actor?.controls.pitch ?? pose!.pitch,
        reservationMs: actor?.connection
          ? null
          : Math.max(
              0,
              Math.min(
                RECONNECT_RESERVATION_MS,
                (actor ? actor.disconnectedAt + RECONNECT_RESERVATION_MS : pose!.until) -
                  reservationNow,
              ),
            ),
        vitals: vitals.checkpoint(),
      });
    });
    return Object.freeze({
      schema: 1,
      worldId: this.worldId,
      seed: this.seed,
      preset: 'blockyard-natural-v2',
      generatorVersion: GENERATOR_VERSION,
      contentHash: this.content.hash,
      engineHash: this.build.engineHash,
      sourceBuildId: this.build.buildId,
      bounds: BOUNDS,
      mode: this.mode,
      tick: this.tick,
      epoch: this.epoch,
      paused: this.paused,
      hitSequence: this.hitSequence,
      explosionSequence: this.explosionSequence,
      spawn: Object.freeze([...this.spawn]) as readonly [number, number, number],
      players: Object.freeze(players),
      world: this.store.checkpoint(this.content),
      inventories: this.inventories.checkpoint(),
      drops: this.drops.checkpoint(this.tick),
      explosives: this.explosives.checkpoint(this.content),
    });
  }
  join(admitted: AdmittedActor, connection: string, now: number): void {
    if (this.ended) {
      this.ports.close(connection, 'SESSION_ENDED');
      return;
    }
    const old = this.actors.get(admitted.id);
    const reservationNow = this.paused ? this.pausedAt : now;
    const pose = this.resting.get(admitted.id),
      continuing = old
        ? !!old.connection || reservationNow - old.disconnectedAt <= RECONNECT_RESERVATION_MS
        : !!pose && pose.until >= reservationNow;
    if (old?.connection) {
      this.ports.close(old.connection, 'REPLACED');
      this.store.world.player_remove(old.slot);
    }
    const initial =
      old?.saved.slice() ??
      pose?.state.slice() ??
      new Float64Array([...this.spawn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const slot = this.store.world.player_add(initial[0], initial[1], initial[2]);
    this.store.world.player_restore(slot, initial);
    this.store.world.set_frozen(slot, true);
    this.store.world.set_ghost(slot, admitted.role === 'observer');
    if (!admitted.capabilities.fly || (admitted.role === 'participant' && this.mode === 'survival'))
      this.store.world.set_flying(slot, false);
    const epoch = ++this.epoch;
    const controls = {
      ...NEUTRAL,
      yaw: old?.controls.yaw ?? pose?.yaw ?? 0,
      pitch: old?.controls.pitch ?? pose?.pitch ?? 0,
    };
    const vitals = this.vitals.get(admitted.id) ?? new Vitals();
    if (!continuing) vitals.resetMotion();
    this.vitals.set(admitted.id, vitals);
    const dead = admitted.role === 'participant' && vitals.dead;
    const actor: Actor = {
      ...admitted,
      connection,
      slot,
      epoch,
      queue: new InputQueue(epoch, controls),
      ledger: new ActionLedger(epoch),
      controls,
      phase: dead ? 'dead' : 'preparing',
      vitals,
      movement: DEFAULT_MOVEMENT,
      deathHandled: dead,
      lastVitals: '',
      resolved: false,
      spawnNew: !continuing,
      focused: false,
      disconnectedAt: now,
      saved: initial,
      subscriptions: new Map(),
      nextSubscription: 0,
      visible: new Map(),
      catalogItem: old?.catalogItem ?? null,
      catalogSequence: 0,
      pending: new Map(),
      mining: null,
      visibleDrops: new Map(),
      dropsReset: true,
      visibleExplosives: new Map(),
      explosivesReset: true,
    };
    this.actors.set(actor.id, actor);
    this.resting.set(actor.id, {
      state: initial.slice(),
      yaw: controls.yaw,
      pitch: controls.pitch,
      until: Infinity,
    });
    this.policies.set(actor.id, { role: actor.role, capabilities: actor.capabilities });
    this.inventories.join(actor.id);
    actor.movement = this.movementProfile(actor);
    this.send(actor, {
      type: 'welcome',
      actorId: actor.id,
      epoch,
      worldId: this.worldId,
      seed: this.seed,
      tick: this.tick,
      environmentVersion: ENVIRONMENT_VERSION,
      spawn: [initial[0], initial[1], initial[2]],
      buildId: this.build.buildId,
      contentHash: this.content.hash,
      generatorVersion: GENERATOR_VERSION,
      role: actor.role,
      mode: this.mode,
      combat: this.survival(actor) && actor.capabilities.combat,
      explosives:
        actor.role === 'participant' && actor.capabilities.build && actor.capabilities.explosives,
    });
    this.send(actor, this.lifecycle());
    this.inventoryView(actor);
    this.subscriptions(actor);
    this.store.require(this.positions());
    this.vitalsView(actor);
    if (dead) this.baseline(actor, 'join');
  }
  disconnect(connection: string, now: number): void {
    const actor = this.find(connection);
    if (!actor) return;
    const reservationNow = this.paused ? this.pausedAt : now;
    actor.saved = this.store.world.player_state(actor.slot);
    this.resting.set(actor.id, {
      state: actor.saved.slice(),
      yaw: actor.controls.yaw,
      pitch: actor.controls.pitch,
      until: reservationNow + RECONNECT_RESERVATION_MS,
    });
    this.store.world.player_remove(actor.slot);
    actor.connection = null;
    actor.disconnectedAt = reservationNow;
    actor.epoch = ++this.epoch;
    actor.queue.reset(actor.epoch);
    actor.ledger = new ActionLedger(actor.epoch);
    actor.subscriptions.clear();
    actor.mining = null;
    this.inventories.close(actor.id);
    this.store.require(this.positions());
  }
  receive(connection: string, message: ClientMessage, now: number): void {
    const a = this.find(connection);
    if (!a || this.ended) return;
    if (message.type === 'input') {
      if (a.phase !== 'playing' || !a.focused || (this.paused && a.role === 'participant')) return;
      let resync = false;
      for (const frame of message.frames)
        if (a.queue.receive(frame, now) === 'resync') resync = true;
      if (resync) this.baseline(a, 'resync');
      return;
    }
    if (message.type === 'resync') {
      const sub = a.subscriptions.get(columnKey(message.x, message.z));
      if (sub?.id === message.subscription) this.chunkBaseline(a, sub);
      return;
    }
    if (message.type === 'palette') {
      // An epoch-scoped, idempotent visual selection. This never enters the movement
      // queue, spends an action sequence, installs an owned stack or edits terrain.
      if (
        this.mode !== 'creative' ||
        a.role !== 'participant' ||
        this.paused ||
        a.phase !== 'playing' ||
        message.epoch !== a.epoch ||
        message.sequence <= a.catalogSequence
      )
        return;
      const block = this.content.blocks[message.state];
      const item =
        block &&
        block.placeable !== false &&
        block.shape !== 'air' &&
        this.content.items.find((item) => item.places === block.name);
      if (!item) return;
      a.catalogItem = item.itemType;
      a.catalogSequence = message.sequence;
      return;
    }
    if (message.type === 'ready') {
      if (message.epoch !== a.epoch || a.phase !== 'preparing' || !a.resolved) return;
      const s = this.store.world.player_state(a.slot),
        required = around(Math.floor(s[0] / 16), Math.floor(s[2] / 16), 1);
      if (
        !this.store.ready(Math.floor(s[0] / 16), Math.floor(s[2] / 16)) ||
        message.columns.length !== required.length ||
        !required.every((p) =>
          message.columns.some(
            (c) => c.x === p.x && c.z === p.z && c.revision === this.store.revision(p.x, p.z),
          ),
        )
      )
        return;
      a.phase = 'playing';
      this.store.world.set_frozen(a.slot, !a.focused || (this.paused && a.role === 'participant'));
      this.baseline(a, 'ready');
      return;
    }
    if (message.type === 'focus') {
      if (message.epoch !== a.epoch) return;
      if (a.phase === 'dead') return;
      if (this.paused && a.role === 'participant' && message.active) return;
      a.focused = message.active;
      this.invalidate(a);
      this.store.world.set_frozen(a.slot, !a.focused || a.phase !== 'playing');
      this.baseline(a, 'focus');
      return;
    }
    if (message.type === 'respawn') {
      const result = a.ledger.run(message.epoch, message.sequence, () => ({
        ok:
          a.role === 'participant' &&
          a.phase === 'dead' &&
          !this.paused &&
          a.vitals.dead &&
          a.vitals.view().respawnIn === 0,
        reason: 'respawn',
      }));
      this.send(a, {
        type: 'result',
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ...('value' in result ? { outcome: result.value } : {}),
      });
      if (result.status === 'applied' && result.value.ok && a.vitals.respawn()) {
        const state = new Float64Array([...this.spawn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
        this.store.world.player_restore(a.slot, state);
        a.saved = state;
        a.focused = false;
        a.phase = 'preparing';
        a.resolved = false;
        a.spawnNew = true;
        a.deathHandled = false;
        this.invalidate(a);
        a.movement = this.movementProfile(a);
        this.store.require(this.positions());
        this.baseline(a, 'respawn');
      }
      return;
    }
    if (message.type === 'inventory') {
      const result = a.ledger.run(message.epoch, message.sequence, () => {
        if (a.phase !== 'playing' || this.paused) return { ok: false, reason: 'not_ready' };
        if (a.role !== 'participant' || !a.capabilities.build)
          return { ok: false, reason: 'forbidden' };
        const operation = message.operation;
        const outcome =
          operation.kind === 'consume'
            ? this.survival(a)
              ? this.inventories.consume(a.id, operation.slot, operation.revision, (nutrition) =>
                  a.vitals.eat(nutrition),
                )
              : { ok: false, reason: 'forbidden' }
            : operation.kind === 'drop'
              ? this.inventories.drop(
                  a.id,
                  operation.slot,
                  operation.count,
                  operation.revision,
                  (stack) => {
                    const p = this.store.world.player_state(a.slot),
                      yaw = a.controls.yaw;
                    this.drops.add(stack, [p[0], p[1] + 0.8, p[2]], this.tick, a.id, [
                      Math.sin(yaw) * 2,
                      2,
                      -Math.cos(yaw) * 2,
                    ]);
                  },
                )
              : this.inventories.transact(a.id, operation, this.mode === 'creative');
        if (outcome.containerChanged)
          for (const id of this.inventories.viewers(outcome.containerChanged)) {
            const viewer = this.actors.get(id);
            if (viewer && viewer.id !== a.id) this.inventoryView(viewer);
          }
        return { ok: outcome.ok, reason: outcome.reason };
      });
      this.send(a, {
        type: 'result',
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ...('value' in result ? { outcome: result.value } : {}),
      });
      this.inventoryView(a);
      this.vitalsView(a);
      return;
    }
    if (
      message.type === 'action' ||
      message.type === 'flight' ||
      message.type === 'mining' ||
      message.type === 'attack' ||
      message.type === 'ignite'
    ) {
      if (
        (message.type === 'action' ||
          message.type === 'attack' ||
          message.type === 'ignite' ||
          (message.type === 'mining' && message.target !== null)) &&
        message.epoch === a.epoch &&
        message.sequence > a.ledger.boundary &&
        a.phase === 'playing' &&
        a.focused &&
        message.inputSequence > a.queue.ack
      ) {
        if (a.pending.has(message.sequence)) return;
        if (message.inputSequence > a.queue.received || a.pending.size >= 32) {
          const denied = a.ledger.run(message.epoch, message.sequence, () => ({
            ok: false,
            reason: 'input_dependency',
          }));
          this.send(a, {
            type: 'result',
            epoch: message.epoch,
            sequence: message.sequence,
            status: denied.status,
            ...('value' in denied ? { outcome: denied.value } : {}),
          });
          return;
        }
        if (!a.pending.has(message.sequence))
          a.pending.set(message.sequence, { message, expires: now + 500 });
        return;
      }
      const result = a.ledger.run(message.epoch, message.sequence, () => {
        if (message.type === 'mining' && message.target === null) {
          this.cancelMining(a);
          return { ok: true, reason: 'cancelled' };
        }
        if (a.phase !== 'playing' || !a.focused || (this.paused && a.role === 'participant'))
          return { ok: false, reason: 'not_ready' };
        if (message.type === 'mining') return this.startMining(a, message, now);
        if (message.type === 'attack') return this.attack(a, message, now);
        if (message.type === 'ignite') return this.ignite(a, message, now);
        if (message.type === 'flight') {
          if (!a.capabilities.fly || (a.role === 'participant' && this.mode === 'survival'))
            return { ok: false, reason: 'forbidden' };
          this.store.world.set_flying(a.slot, message.on);
          this.invalidate(a);
          this.baseline(a, 'flight');
          return { ok: true, reason: 'flight' };
        }
        return this.edit(a, message);
      });
      this.send(a, {
        type: 'result',
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ...('value' in result ? { outcome: result.value } : {}),
      });
    }
  }
  advance(now: number): { steps: number; droppedMs: number } {
    let result: { steps: number; droppedMs: number };
    if (this.paused) {
      this.clock.reset(now);
      this.advanceObservers(now);
      result = { steps: 0, droppedMs: 0 };
    } else {
      this.observerClock.reset(now);
      result = this.clock.advance(now, () => {
        const started = this.ports.onStep ? performance.now() : 0;
        this.tick++;
        for (const a of this.actors.values())
          if (a.connection && a.phase === 'playing') this.refreshMovement(a);
        for (let sub = 0; sub < 2; sub++)
          for (const a of this.actors.values())
            if (a.connection && a.phase === 'playing' && a.focused) {
              const input = a.queue.take(now);
              a.controls = input.controls;
              const before = this.store.world.player_state(a.slot);
              const jumped = stepBoundedMovement(
                this.store.world,
                a.slot,
                input.controls,
                a.movement,
              );
              if (this.survival(a)) {
                const after = this.store.world.player_state(a.slot);
                const climbing = [0.1, 0.9, 1.6].some(
                  (height) =>
                    this.content.blocks[
                      this.store.world.get_block(
                        Math.floor(after[0]),
                        Math.floor(after[1] + height),
                        Math.floor(after[2]),
                      )
                    ]?.climbable,
                );
                const effects = equipmentEffects(this.inventories.equipped(a.id));
                const landing = a.vitals.movement(
                  before,
                  after,
                  climbing,
                  effects.fallImmune ? 1 : effects.fall,
                  input.controls.sprint && a.movement.sprint,
                );
                let worn = landing.impact > 0 && this.inventories.wearEquipment(a.id, 'fall');
                if (jumped) worn = this.inventories.wearEquipment(a.id, 'jump') || worn;
                if (worn) {
                  this.inventoryView(a);
                  this.refreshMovement(a);
                }
                this.handleDeath(a);
              }
              if (input.resync) this.baseline(a, 'resync');
            }
        for (const a of this.actors.values())
          if (a.connection) {
            if (
              (this.survival(a) || (a.role === 'participant' && a.vitals.dead)) &&
              (a.phase === 'playing' || a.phase === 'dead')
            ) {
              const body = this.store.world.player_state(a.slot);
              const familyAt = (height: number) =>
                this.content.blocks[
                  this.store.world.get_block(
                    Math.floor(body[0]),
                    Math.floor(body[1] + height),
                    Math.floor(body[2]),
                  )
                ]?.name;
              body[8] = Number(familyAt(1.62) === 'water');
              body[9] = Number([0.1, 0.9, 1.6].some((height) => familyAt(height) === 'lava'));
              a.vitals.step(body);
              const effects = equipmentEffects(this.inventories.equipped(a.id));
              if (
                a.vitals.sunlight(
                  a.phase === 'playing' &&
                    effects.sunRegen &&
                    a.vitals.view().health < 20 &&
                    !body[8] &&
                    !body[9] &&
                    sampleEnvironment(this.tick, this.seed).sun[1] > 0.2 &&
                    exposedToSun(
                      this.store.world,
                      this.content,
                      body,
                      this.store.heightAt(Math.floor(body[0]), Math.floor(body[2])),
                    ),
                )
              ) {
                this.inventories.wearEquipment(a.id, 'sun');
                this.inventoryView(a);
              }
              if (a.vitals.visibility(a.phase === 'playing' && effects.vision)) {
                this.inventories.wearEquipment(a.id, 'vision');
                this.inventoryView(a);
              }
              this.handleDeath(a);
              if (this.tick % 3 === 0) this.vitalsView(a);
            }
            for (const [sequence, pending] of [...a.pending].sort(([a], [b]) => a - b)) {
              if (pending.expires < now) {
                a.pending.delete(sequence);
                const result = a.ledger.run(pending.message.epoch, sequence, () => ({
                  ok: false,
                  reason: 'input_timeout',
                }));
                this.send(a, {
                  type: 'result',
                  epoch: pending.message.epoch,
                  sequence,
                  status: result.status,
                  ...('value' in result ? { outcome: result.value } : {}),
                });
              } else if (pending.message.inputSequence <= a.queue.ack) {
                a.pending.delete(sequence);
                this.receive(a.connection, pending.message, now);
              } else break;
            }
            a.saved = this.store.world.player_state(a.slot);
            this.subscriptions(a);
            this.advanceMining(a, now);
            if (this.tick % 6 === 0 && this.inventories.refresh(a.id)) this.inventoryView(a);
          }
        this.store.require(this.positions());
        this.explosives.step(this.store.world);
        this.advanceExplosions(now);
        this.store.require(this.positions());
        this.drops.step(this.store.world, this.tick);
        if (this.tick % 3 === 0) {
          this.pickups();
          this.dropSnapshots();
          this.explosiveSnapshots();
        }
        if (this.tick % 2 === 0) this.snapshots(now);
        this.ports.onStep?.('world', performance.now() - started);
      });
    }
    for (const a of this.actors.values())
      if (a.connection && a.phase === 'preparing' && !a.resolved) {
        const state = this.store.world.player_state(a.slot),
          cx = Math.floor(state[0] / 16),
          cz = Math.floor(state[2] / 16);
        if (!this.store.ready(cx, cz)) continue;
        if (!this.store.world.player_fits(state[0], state[1], state[2]) || a.spawnNew) {
          const candidates = [];
          for (let dz = -10; dz <= 10; dz++)
            for (let dx = -10; dx <= 10; dx++)
              candidates.push({ x: state[0] + dx, z: state[2] + dz, distance: dx * dx + dz * dz });
          candidates.sort((a, b) => a.distance - b.distance);
          let found = false;
          for (const candidate of candidates) {
            if (!inBounds(candidate.x, 1, candidate.z)) continue;
            const x = Math.floor(candidate.x),
              z = Math.floor(candidate.z);
            for (let y = Math.min(252, this.store.heightAt(x, z)); y >= 0; y--) {
              const height = this.store.world.collision_top(x, y, z);
              if (height <= 0) continue;
              const block = this.content.blocks[this.store.world.get_block(x, y, z)];
              if (
                !block ||
                !['grass_block', 'dirt', 'stone', 'sand', 'bedrock'].includes(block.name)
              )
                continue;
              const foot = y + height + 0.005;
              if (
                [
                  [0, 0],
                  [0.7, 0],
                  [-0.7, 0],
                  [0, 0.7],
                  [0, -0.7],
                ].every(
                  ([ox, oz]) =>
                    this.store.world.player_fits(candidate.x + ox, foot, candidate.z + oz) &&
                    this.store.world.player_fits(candidate.x + ox, foot + 1.3, candidate.z + oz) &&
                    [0.1, 0.9, 1.62].every(
                      (height) =>
                        !['water', 'lava'].includes(
                          this.content.blocks[
                            this.store.world.get_block(
                              Math.floor(candidate.x + ox),
                              Math.floor(foot + height),
                              Math.floor(candidate.z + oz),
                            )
                          ]?.name,
                        ),
                    ),
                )
              ) {
                state[0] = candidate.x;
                state[1] = foot;
                state[2] = candidate.z;
                state[3] = state[4] = state[5] = 0;
                found = true;
              }
              break;
            }
            if (found) break;
          }
          if (!found) continue;
        }
        this.store.world.player_restore(a.slot, state);
        a.resolved = true;
        this.baseline(a, 'join');
      }
    const reservationNow = this.paused ? this.pausedAt : now;
    for (const [id, a] of this.actors)
      if (!a.connection && reservationNow - a.disconnectedAt > RECONNECT_RESERVATION_MS)
        this.actors.delete(id);
    return result;
  }
  private advanceObservers(now: number): void {
    this.observerClock.advance(now, () => {
      if (this.ended) return;
      const started = this.ports.onStep ? performance.now() : 0;
      this.observerTick++;
      for (let sub = 0; sub < 2; sub++)
        for (const a of this.actors.values())
          if (a.connection && a.role === 'observer' && a.phase === 'playing' && a.focused) {
            const input = a.queue.take(now);
            a.controls = input.controls;
            stepBoundedMovement(this.store.world, a.slot, input.controls, a.movement);
            if (input.resync) this.baseline(a, 'resync');
          }
      for (const a of this.actors.values())
        if (a.connection && a.role === 'observer') {
          a.saved = this.store.world.player_state(a.slot);
          this.subscriptions(a);
        }
      this.store.require(this.positions());
      if (this.observerTick % 3 === 0) {
        this.dropSnapshots();
        this.explosiveSnapshots();
      }
      if (this.observerTick % 2 === 0) this.snapshots(now);
      this.ports.onStep?.('observer', performance.now() - started);
    });
  }
  /** Called only by the trusted supervisor, at a worker message boundary. */
  staff(actorId: string, input: StaffCommand, now: number): StaffResult {
    const command = readStaffCommand(input);
    if (!command || !Number.isFinite(now)) return { ok: false, reason: 'invalid' };
    if (this.ended) return { ok: false, reason: 'ended' };
    if (command.kind === 'mode') {
      if (this.mode === command.mode) return { ok: true, reason: 'unchanged' };
      const connected = [...this.actors.values()].filter((a) => a.connection);
      if (connected.some((a) => a.role === 'participant' && a.vitals.dead && !a.deathHandled))
        return { ok: false, reason: 'not_ready' };
      if (!Number.isSafeInteger(this.epoch + connected.length))
        return { ok: false, reason: 'invalid' };
      this.currentMode = command.mode;
      // Complete all native/private changes before publishing any new rule view.
      for (const a of connected) {
        this.inventories.close(a.id);
        a.focused = false;
        this.invalidate(a);
        this.store.world.set_frozen(a.slot, true);
        if (a.role === 'participant' && this.mode === 'survival')
          this.store.world.set_flying(a.slot, false);
        a.vitals.resetMotion();
        if (a.role === 'participant' && a.vitals.dead) a.phase = 'dead';
        else if (a.phase === 'dead') {
          a.phase = 'preparing';
          a.resolved = false;
          a.spawnNew = false;
        }
        a.movement = this.movementProfile(a);
        a.saved = this.store.world.player_state(a.slot);
        a.catalogItem = null;
      }
      for (const a of connected) {
        this.send(a, {
          type: 'rules',
          epoch: a.epoch,
          mode: this.mode,
          combat: this.survival(a) && a.capabilities.combat,
          explosives: a.role === 'participant' && a.capabilities.build && a.capabilities.explosives,
        });
        this.baseline(a, 'mode');
      }
      return { ok: true, reason: 'mode' };
    }
    const a = this.actors.get(actorId),
      target = command.target === 'spawn' ? null : this.actors.get(command.target);
    if (!a?.connection || (command.target !== 'spawn' && !target?.connection))
      return { ok: false, reason: 'not_present' };
    if (a.phase === 'dead' || (target && target.phase !== 'playing'))
      return { ok: false, reason: 'not_ready' };
    if (!Number.isSafeInteger(this.epoch + 1)) return { ok: false, reason: 'invalid' };
    const destination = target ? this.store.world.player_state(target.slot) : this.spawn;
    if (!inBounds(destination[0], destination[1], destination[2]))
      return { ok: false, reason: 'invalid' };
    const state = this.store.world.player_state(a.slot);
    state[0] = destination[0];
    state[1] = Math.min(253, destination[1] + (a.role === 'observer' && target ? 2 : 0));
    state[2] = destination[2];
    state[3] = state[4] = state[5] = 0;
    this.inventories.close(a.id);
    this.invalidate(a);
    a.focused = false;
    a.vitals.resetMotion();
    a.phase = 'preparing';
    a.resolved = false;
    a.spawnNew = false;
    this.store.world.player_restore(a.slot, state);
    this.store.world.set_frozen(a.slot, true);
    a.saved = this.store.world.player_state(a.slot);
    // Explicit remove/join discontinuities reset remote interpolation and preserve
    // observer filtering. Subscription incarnations reject late terrain jobs.
    for (const viewer of this.actors.values())
      if (viewer.visible.delete(a.id)) this.send(viewer, { type: 'actor_removed', id: a.id });
    for (const id of a.visible.keys()) this.send(a, { type: 'actor_removed', id });
    a.visible.clear();
    for (const sub of a.subscriptions.values())
      this.send(a, { type: 'unload', x: sub.x, z: sub.z, subscription: sub.id });
    a.subscriptions.clear();
    a.visibleDrops.clear();
    a.dropsReset = true;
    a.visibleExplosives.clear();
    a.explosivesReset = true;
    this.send(a, { type: 'drops', reset: true, upsert: [], removed: [] });
    this.send(a, { type: 'explosives', reset: true, upsert: [], removed: [] });
    this.subscriptions(a);
    this.store.require(this.positions());
    this.baseline(a, 'teleport');
    return { ok: true, reason: 'teleport' };
  }
  lifecycle(): LifecycleView {
    return {
      type: 'lifecycle',
      state: this.ended ? 'ended' : this.paused ? 'paused' : 'playing',
      reason: this.ended ? 'ended' : this.paused ? this.pauseReason : 'allowed',
      tick: this.tick,
    };
  }
  end(now: number): void {
    if (this.ended) return;
    this.ended = true;
    this.setPaused(true, now, 'ended');
    for (const a of this.actors.values())
      if (a.connection) this.ports.close(a.connection, 'SESSION_ENDED');
  }
  setPaused(
    paused: boolean,
    now: number,
    reason: PauseReason = paused ? 'manual' : 'allowed',
  ): void {
    if (this.ended && !paused) return;
    const changed = this.paused !== paused;
    if (!changed && this.pauseReason === reason) return;
    if (changed && paused) this.pausedAt = now;
    else if (changed) {
      const duration = Math.max(0, now - this.pausedAt);
      for (const actor of this.actors.values())
        if (!actor.connection) actor.disconnectedAt += duration;
      for (const pose of this.resting.values())
        if (Number.isFinite(pose.until)) pose.until += duration;
    }
    this.paused = paused;
    this.pauseReason = reason;
    this.clock.reset(now);
    this.observerClock.reset(now);
    for (const actor of this.actors.values())
      if (actor.connection) {
        if ((changed && actor.role === 'participant') || this.ended) {
          actor.focused = false;
          this.invalidate(actor);
          this.store.world.set_frozen(actor.slot, true);
          this.baseline(actor, 'pause');
        }
        this.send(actor, this.lifecycle());
      }
  }
  private survival(a: Actor): boolean {
    return this.mode === 'survival' && a.role === 'participant';
  }
  private movementProfile(a: Actor): MovementModifiers {
    if (!this.survival(a)) return DEFAULT_MOVEMENT;
    return {
      ...equipmentEffects(this.inventories.active(a.id)).movement,
      sprint: a.vitals.view().food >= 6,
    };
  }
  private refreshMovement(a: Actor): void {
    const next = this.movementProfile(a);
    if (JSON.stringify(next) === JSON.stringify(a.movement)) return;
    a.movement = next;
    this.invalidate(a);
    this.baseline(a, 'movement');
  }
  private vitalsView(a: Actor): void {
    const view = a.vitals.view(),
      key = `${a.epoch}:${JSON.stringify(view)}`;
    if (key === a.lastVitals) return;
    a.lastVitals = key;
    this.send(a, { type: 'vitals', epoch: a.epoch, view });
  }
  private handleDeath(a: Actor): void {
    if (!a.vitals.dead || a.deathHandled || !this.survival(a)) return;
    a.deathHandled = true;
    a.phase = 'dead';
    a.focused = false;
    this.invalidate(a);
    this.store.world.set_frozen(a.slot, true);
    const p = this.store.world.player_state(a.slot);
    this.inventories.drain(a.id, (stack) =>
      this.drops.add(stack, [p[0], p[1] + 0.2, p[2]], this.tick, a.id),
    );
    this.baseline(a, 'death');
  }
  private ignite(
    a: Actor,
    message: Extract<ClientMessage, { type: 'ignite' }>,
    now: number,
  ): Outcome {
    if (a.role !== 'participant' || !a.capabilities.build || !a.capabilities.explosives)
      return { ok: false, reason: 'forbidden' };
    if (!a.queue.active(now)) return { ok: false, reason: 'input_stale' };
    if (!this.aimed(a, message.target)) return { ok: false, reason: 'out_of_reach' };
    const [x, y, z] = message.target;
    if (y === 0) return { ok: false, reason: 'unbreakable' };
    if (this.store.revision(x >> 4, z >> 4) !== message.revision)
      return { ok: false, reason: 'conflict' };
    const state = this.store.world.get_block(x, y, z),
      rule = this.content.behavior.find((rule) => rule.family === this.content.blocks[state]?.name);
    if (!rule?.explosive) return { ok: false, reason: 'not_ignitable' };
    let patches: ReturnType<WorldStore['clearMany']> = null;
    const outcome = this.inventories.ignite(
      a.id,
      message.inventoryRevision,
      this.mode === 'creative',
      () => {
        patches = this.store.clearMany([message.target]);
        if (!patches) return false;
        this.explosives.add(a.id, state, [x + 0.5, y + 0.05, z + 0.5], rule.explosive!);
        return true;
      },
    );
    if (outcome.ok) {
      this.cancelMining(a);
      for (const patch of patches ?? []) this.publishEdit(patch);
      this.inventoryView(a);
      this.store.require(this.positions());
      this.explosiveSnapshots();
    }
    return outcome;
  }
  private finishDamage(
    target: Actor,
    direction: readonly number[],
    strength: number,
    up: number,
  ): void {
    if (target.vitals.dead) {
      this.handleDeath(target);
      return;
    }
    const body = this.store.world.player_state(target.slot);
    if (!body[12]) {
      body[3] = Math.max(-6, Math.min(6, body[3] + direction[0] * strength));
      body[5] = Math.max(-6, Math.min(6, body[5] + direction[2] * strength));
      body[4] = Math.max(body[4], up);
      body[6] = 0;
      this.store.world.player_restore(target.slot, body);
    }
    this.invalidate(target);
    target.movement = this.movementProfile(target);
    this.baseline(target, 'damage');
  }
  requireOwnerAuthorizations(): void {
    this.ownerAuthorizations = new Map();
  }
  authorizeOwners(
    owners: readonly (readonly [string, AdmittedActor | null])[],
    until: number,
  ): void {
    if (!this.ownerAuthorizations || !Number.isFinite(until))
      throw new Error('owner authorization is not configured');
    const ids = new Set<string>();
    for (const [id, actor] of owners) {
      if (!id.length || id.length > 128 || ids.has(id) || (actor !== null && actor.id !== id))
        throw new Error('owner authorization identity mismatch');
      ids.add(id);
    }
    for (const [id, actor] of owners) {
      this.ownerAuthorizations.set(id, {
        actor:
          actor === null ? null : { id, role: actor.role, capabilities: { ...actor.capabilities } },
        until,
      });
    }
    const active = new Set(this.explosives.owners());
    for (const id of this.ownerAuthorizations.keys())
      if (!active.has(id)) this.ownerAuthorizations.delete(id);
  }
  private advanceExplosions(now: number): void {
    let processed = 0;
    for (const bomb of this.explosives.due()) {
      if (processed >= EXPLOSIONS_PER_TICK) break;
      if (!this.store.ready(Math.floor(bomb.position[0] / 16), Math.floor(bomb.position[2] / 16)))
        continue;
      const authorization = this.ownerAuthorizations?.get(bomb.owner);
      if (this.ownerAuthorizations && (!authorization || now >= authorization.until)) continue;
      const policy = this.ownerAuthorizations
        ? authorization!.actor
        : (this.actors.get(bomb.owner) ?? this.policies.get(bomb.owner));
      const current = this.actors.get(bomb.owner),
        connected = current?.connection ? current : null;
      const permitted =
        policy?.role === 'participant' &&
        policy.capabilities.build &&
        policy.capabilities.explosives &&
        (!connected ||
          (connected.role === 'participant' &&
            connected.capabilities.build &&
            connected.capabilities.explosives));
      const position: [number, number, number] = [
        bomb.position[0],
        bomb.position[1] + 0.45,
        bomb.position[2],
      ];
      const blocks = permitted
        ? blastPlan(this.store.world, this.content, position, bomb.rule.radius)
        : [];
      const hits: {
        target: Actor;
        damage: number;
        direction: number[];
        strength: number;
        position: [number, number, number];
      }[] = [];
      if (
        permitted &&
        this.mode === 'survival' &&
        policy.capabilities.combat &&
        (!connected || connected.capabilities.combat)
      )
        for (const target of this.actors.values()) {
          if (
            !target.connection ||
            target.phase !== 'playing' ||
            !this.survival(target) ||
            !target.capabilities.combat ||
            !target.vitals.canBeHit
          )
            continue;
          const body = this.store.world.player_state(target.slot),
            point: [number, number, number] = [body[0], body[1] + 0.9, body[2]],
            delta = point.map((value, axis) => value - position[axis]),
            distance = Math.hypot(...delta),
            range = bomb.rule.radius * 2;
          if (distance >= range) continue;
          const exposure =
            [0.2, 0.9, 1.6].filter((height) =>
              this.store.world.line_clear(...position, body[0], body[1] + height, body[2]),
            ).length / 3;
          if (!exposure) continue;
          const strength = (1 - distance / range) * exposure;
          hits.push({
            target,
            damage: Math.max(
              1,
              Math.ceil(
                bomb.rule.damage *
                  strength *
                  (1 - equipmentEffects(this.inventories.equipped(target.id)).armor),
              ),
            ),
            direction: delta.map((value) => (distance > 1e-8 ? value / distance : 0)),
            strength: strength * 4,
            position: point,
          });
        }
      const patches = this.store.clearMany(blocks.map((block) => block.cell));
      if (!patches) continue;
      this.explosives.remove(bomb.id);
      processed++;
      const closed = new Set<string>();
      for (const { cell, state, rule } of blocks) {
        const dropPosition: [number, number, number] = [
          cell[0] + 0.5,
          cell[1] + 0.2,
          cell[2] + 0.5,
        ];
        for (const id of this.inventories.explode(cell, (stack) =>
          this.drops.add(stack, dropPosition, this.tick),
        ))
          closed.add(id);
        if (rule.explosive)
          this.explosives.add(
            bomb.owner,
            state,
            [cell[0] + 0.5, cell[1] + 0.05, cell[2] + 0.5],
            rule.explosive,
            Math.min(CHAIN_FUSE, rule.explosive.fuse),
          );
        else
          for (const drop of blockDrops(
            rule,
            this.seed,
            cell,
            this.store.revision(cell[0] >> 4, cell[2] >> 4),
          ))
            this.drops.add(
              makeStack(
                this.content.items.find((item) => item.itemType === drop.itemType)!,
                drop.count,
              ),
              dropPosition,
              this.tick,
            );
      }
      const event: ExplosionEvent = {
        sequence: ++this.explosionSequence,
        id: bomb.id,
        position,
        radius: bomb.rule.radius,
        removed: blocks.length,
        cancelled: !permitted,
        columns: patches.map(({ x, z, revision }) => ({ x, z, revision })),
      };
      for (const viewer of this.actors.values())
        if (
          viewer.connection &&
          (viewer.id === bomb.owner ||
            Math.hypot(
              ...this.store.world
                .player_state(viewer.slot)
                .subarray(0, 3)
                .map((value, axis) => value - position[axis]),
            ) <= EXPLOSIVE_RADIUS ||
            patches.some((patch) => viewer.subscriptions.has(columnKey(patch.x, patch.z))))
        )
          this.send(viewer, { type: 'explosion', ...event });
      for (const patch of patches) this.publishEdit(patch);
      for (const id of closed) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
      for (const hit of hits)
        if (hit.target.vitals.strikeDamage(hit.damage)) {
          this.inventories.wearEquipment(hit.target.id, 'armor');
          this.finishDamage(hit.target, hit.direction, hit.strength, hit.strength);
          const event: HitEvent = {
            sequence: ++this.hitSequence,
            attacker: bomb.owner,
            target: hit.target.id,
            position: hit.position,
            damage: hit.damage,
            dead: hit.target.vitals.dead,
          };
          for (const viewer of this.actors.values())
            if (
              viewer.connection &&
              (viewer.id === bomb.owner ||
                viewer.id === hit.target.id ||
                Math.hypot(
                  ...this.store.world
                    .player_state(viewer.slot)
                    .subarray(0, 3)
                    .map((value, axis) => value - hit.position[axis]),
                ) <= 32)
            )
              this.send(viewer, { type: 'hit', ...event });
        }
    }
  }
  private attack(
    a: Actor,
    message: Extract<ClientMessage, { type: 'attack' }>,
    now: number,
  ): Outcome {
    if (!this.survival(a) || !a.capabilities.combat) return { ok: false, reason: 'forbidden' };
    if (!a.queue.active(now)) return { ok: false, reason: 'input_stale' };
    const held = this.inventories.held(a.id);
    if (held.revision !== message.inventoryRevision) return { ok: false, reason: 'conflict' };
    const item = this.content.items.find((item) => item.itemType === held.stack?.itemType),
      profile = combatProfile(item);
    if (!a.vitals.beginAttack(profile.cooldown)) return { ok: false, reason: 'cooldown' };
    this.cancelMining(a);
    a.vitals.effort(0.1);
    this.vitalsView(a);
    const p = this.store.world.player_state(a.slot),
      c = a.controls,
      cos = Math.cos(c.pitch);
    const origin = [p[0], p[1] + 1.62, p[2]],
      direction = [Math.sin(c.yaw) * cos, Math.sin(c.pitch), -Math.cos(c.yaw) * cos];
    const candidates = [...this.actors.values()]
      .flatMap((target) => {
        if (
          target.id === a.id ||
          !target.connection ||
          target.phase !== 'playing' ||
          !this.survival(target) ||
          !target.capabilities.combat
        )
          return [];
        const distance = rayBody(
          origin,
          direction,
          this.store.world.player_state(target.slot),
          profile.reach,
        );
        return distance === null ? [] : [{ target, distance }];
      })
      .sort((a, b) => a.distance - b.distance || a.target.id.localeCompare(b.target.id));
    const chosen = candidates[0];
    if (!chosen) return { ok: false, reason: 'miss' };
    const { target, distance } = chosen,
      position = origin.map((value, axis) => value + direction[axis] * (distance + 1e-4)) as [
        number,
        number,
        number,
      ];
    if (!this.store.world.line_clear(origin[0], origin[1], origin[2], ...position))
      return { ok: false, reason: 'occluded' };
    if (!target.vitals.canBeHit) return { ok: false, reason: 'protected' };
    const damage = Math.max(
      1,
      Math.ceil(
        profile.damage * (1 - equipmentEffects(this.inventories.equipped(target.id)).armor),
      ),
    );
    const outcome = this.inventories.strike(a.id, held.revision, () =>
      target.vitals.strikeDamage(damage),
    );
    if (!outcome.ok) return outcome;
    this.inventories.wearEquipment(target.id, 'armor');
    this.inventoryView(a);
    this.finishDamage(target, [Math.sin(c.yaw), 0, -Math.cos(c.yaw)], 2, 1.8);
    const event: HitEvent = {
      sequence: ++this.hitSequence,
      attacker: a.id,
      target: target.id,
      position,
      damage,
      dead: target.vitals.dead,
    };
    for (const viewer of this.actors.values())
      if (
        viewer.connection &&
        (viewer.id === a.id ||
          viewer.id === target.id ||
          Math.hypot(
            ...this.store.world
              .player_state(viewer.slot)
              .subarray(0, 3)
              .map((v, i) => v - position[i]),
          ) <= 32)
      )
        this.send(viewer, { type: 'hit', ...event });
    return { ok: true, reason: 'hit' };
  }
  private aimed(a: Actor, cell: Cell): boolean {
    const p = this.store.world.player_state(a.slot),
      c = a.controls,
      cos = Math.cos(c.pitch);
    const hit = this.store.world.raycast(
      p[0],
      p[1] + 1.62,
      p[2],
      Math.sin(c.yaw) * cos,
      Math.sin(c.pitch),
      -Math.cos(c.yaw) * cos,
      6,
    );
    return !!hit[0] && hit[1] === cell[0] && hit[2] === cell[1] && hit[3] === cell[2];
  }
  private miningView(a: Actor): void {
    this.send(a, {
      type: 'mining',
      epoch: a.epoch,
      target: a.mining?.target ?? null,
      elapsed: a.mining?.elapsed ?? 0,
      total: a.mining?.total ?? 0,
    });
  }
  private cancelMining(a: Actor): void {
    if (a.mining) {
      a.mining = null;
      this.miningView(a);
    }
  }
  private startMining(
    a: Actor,
    message: Extract<ClientMessage, { type: 'mining' }>,
    now: number,
  ): Outcome {
    if (this.mode !== 'survival' || !a.capabilities.build || a.role !== 'participant')
      return { ok: false, reason: 'forbidden' };
    const target = message.target;
    if (!target || !a.queue.active(now)) return { ok: false, reason: 'input_stale' };
    if (!this.aimed(a, target)) return { ok: false, reason: 'out_of_reach' };
    const held = this.inventories.held(a.id);
    if (
      held.revision !== message.inventoryRevision ||
      this.store.revision(target[0] >> 4, target[2] >> 4) !== message.revision
    )
      return { ok: false, reason: 'conflict' };
    const state = this.store.world.get_block(...target),
      block = this.content.blocks[state],
      rule = this.content.behavior.find((b) => b.family === block?.name);
    if (!block || !rule || block.shape === 'air' || block.breakable === false || target[1] === 0)
      return { ok: false, reason: 'unbreakable' };
    if (!this.inventories.canBreak(target)) return { ok: false, reason: 'container_not_empty' };
    const item = this.content.items.find((i) => i.itemType === held.stack?.itemType),
      plan = miningPlan(rule, item);
    if (!plan.allowed) return { ok: false, reason: 'tool_required' };
    const cellRevision = this.store.cellRevision(...target),
      previous = a.mining;
    if (
      previous &&
      previous.target.every((v, i) => v === target[i]) &&
      previous.cellRevision === cellRevision &&
      previous.slot === held.slot &&
      !!previous.stack === !!held.stack &&
      (!held.stack || sameStack(previous.stack!, held.stack))
    ) {
      this.miningView(a);
      return { ok: true, reason: 'mining' };
    }
    a.mining = {
      target: [...target],
      state,
      cellRevision,
      slot: held.slot,
      stack: held.stack,
      elapsed: 0,
      total: plan.ticks,
    };
    this.miningView(a);
    return { ok: true, reason: 'mining' };
  }
  private advanceMining(a: Actor, now: number): void {
    const job = a.mining;
    if (!job) return;
    const held = this.inventories.held(a.id);
    if (
      !a.focused ||
      !a.capabilities.build ||
      a.role !== 'participant' ||
      !a.queue.active(now) ||
      !this.aimed(a, job.target) ||
      this.store.world.get_block(job.target[0], job.target[1], job.target[2]) !== job.state ||
      this.store.cellRevision(job.target[0], job.target[1], job.target[2]) !== job.cellRevision ||
      held.slot !== job.slot ||
      !!held.stack !== !!job.stack ||
      (held.stack && !sameStack(held.stack, job.stack!)) ||
      !this.inventories.canBreak(job.target)
    ) {
      this.cancelMining(a);
      return;
    }
    job.elapsed++;
    if (job.elapsed < job.total) {
      if (job.elapsed % 3 === 0) this.miningView(a);
      return;
    }
    const rule = this.content.behavior.find(
      (b) => b.family === this.content.blocks[job.state].name,
    )!;
    const stacks = blockDrops(
      rule,
      this.seed,
      job.target,
      this.store.revision(job.target[0] >> 4, job.target[2] >> 4) + 1,
    ).map((drop) =>
      makeStack(this.content.items.find((item) => item.itemType === drop.itemType)!, drop.count),
    );
    const mutation = { value: null as ReturnType<WorldStore['set']> };
    const outcome = this.inventories.mine(a.id, job.slot, job.stack, () => {
      mutation.value = this.store.set(job.target[0], job.target[1], job.target[2], 0);
      return !!mutation.value;
    });
    if (outcome.ok && mutation.value) {
      a.vitals.effort(0.2);
      for (const id of this.inventories.removed(job.target)) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
      for (const stack of stacks)
        this.drops.add(
          stack,
          [job.target[0] + 0.5, job.target[1] + 0.2, job.target[2] + 0.5],
          this.tick,
        );
      this.inventoryView(a);
      this.publishEdit(mutation.value);
    }
    this.cancelMining(a);
  }
  private publishEdit(changed: NonNullable<ReturnType<WorldStore['set']>>): void {
    for (const viewer of this.actors.values()) {
      const sub = viewer.subscriptions.get(columnKey(changed.x, changed.z));
      if (sub) this.send(viewer, { kind: 'patch', ...changed, subscription: sub.id });
    }
  }
  private pickups(): void {
    for (const a of this.actors.values())
      if (
        a.connection &&
        a.phase === 'playing' &&
        a.role === 'participant' &&
        a.capabilities.build
      ) {
        const p = this.store.world.player_state(a.slot),
          origin = [p[0], p[1] + 0.7, p[2]];
        let changed = false;
        for (const drop of this.drops.nearby(origin, PICKUP_RADIUS)) {
          if (
            !this.drops.eligible(drop.id, a.id, this.tick) ||
            !this.store.world.line_clear(
              ...(origin as [number, number, number]),
              drop.position[0],
              drop.position[1] + 0.125,
              drop.position[2],
            )
          )
            continue;
          const accepted = this.inventories.receive(a.id, drop.stack);
          if (accepted) {
            this.drops.take(drop.id, accepted);
            changed = true;
          }
        }
        if (changed) this.inventoryView(a);
      }
  }
  private dropSnapshots(): void {
    for (const a of this.actors.values())
      if (a.connection) {
        const nearby = this.drops.nearby(this.store.world.player_state(a.slot), DROP_RADIUS);
        const current = new Map(nearby.map((drop) => [drop.id, drop.revision]));
        const upsert = nearby.filter((drop) => a.visibleDrops.get(drop.id) !== drop.revision);
        const removed = [...a.visibleDrops.keys()].filter((id) => !current.has(id));
        let reset = a.dropsReset;
        do {
          if (reset || upsert.length || removed.length)
            this.send(a, {
              type: 'drops',
              reset,
              upsert: upsert.splice(0, 64),
              removed: removed.splice(0, 64),
            });
          reset = false;
        } while (upsert.length || removed.length);
        a.dropsReset = false;
        a.visibleDrops = current;
      }
  }
  private explosiveSnapshots(): void {
    for (const viewer of this.actors.values())
      if (viewer.connection) {
        const bodies = this.explosives.nearby(
            this.store.world.player_state(viewer.slot),
            EXPLOSIVE_RADIUS,
          ),
          visible = new Map(bodies.map((body) => [body.id, body.revision]));
        const upsert = bodies.filter(
            (body) => viewer.visibleExplosives.get(body.id) !== body.revision,
          ),
          removed = [...viewer.visibleExplosives.keys()].filter((id) => !visible.has(id));
        let reset = viewer.explosivesReset;
        do {
          if (reset || upsert.length || removed.length)
            this.send(viewer, {
              type: 'explosives',
              reset,
              upsert: upsert.splice(0, 64),
              removed: removed.splice(0, 64),
            });
          reset = false;
        } while (upsert.length || removed.length);
        viewer.visibleExplosives = visible;
        viewer.explosivesReset = false;
      }
  }
  private positions(): Float64Array[] {
    return [...this.actors.values()]
      .filter((a) => a.connection)
      .map((a) => this.store.world.player_state(a.slot))
      .concat(this.explosives.positions.map((position) => new Float64Array(position)));
  }
  private find(connection: string): Actor | undefined {
    return [...this.actors.values()].find((a) => a.connection === connection);
  }
  private send(a: Actor, event: ServerMessage | ChunkFrame): void {
    if (a.connection) this.ports.send(a.connection, event);
  }
  private invalidate(a: Actor): void {
    a.epoch = ++this.epoch;
    a.queue.reset(a.epoch);
    a.catalogSequence = 0;
    a.ledger = new ActionLedger(a.epoch);
    a.controls = { ...NEUTRAL, yaw: a.controls.yaw, pitch: a.controls.pitch };
    a.pending.clear();
    a.mining = null;
  }
  private state(a: Actor): number[] {
    return Array.from(this.store.world.player_state(a.slot), (v, i) =>
      i < 6 ? Math.round(v * 10000) / 10000 : v,
    );
  }
  private inventoryView(a: Actor): void {
    this.inventories.refresh(a.id);
    this.send(a, {
      type: 'inventory',
      epoch: a.epoch,
      view: this.inventories.view(
        a.id,
        this.mode === 'creative' && a.role === 'participant' && a.capabilities.build,
      ),
    });
  }
  private canUseStation(id: string, cell: Cell, _opening: boolean): boolean {
    const a = this.actors.get(id);
    if (
      !a?.connection ||
      !a.capabilities.build ||
      a.role !== 'participant' ||
      a.phase !== 'playing'
    )
      return false;
    const p = this.store.world.player_state(a.slot),
      eye = [p[0], p[1] + 1.62, p[2]];
    // The GUI releases pointer lock; access still requires authoritative eye/reach/occlusion.
    let dx = cell[0] + 0.5 - eye[0],
      dy = cell[1] + 0.5 - eye[1],
      dz = cell[2] + 0.5 - eye[2];
    const length = Math.hypot(dx, dy, dz);
    if (!length || length > 6) return false;
    dx /= length;
    dy /= length;
    dz /= length;
    const hit = this.store.world.raycast(eye[0], eye[1], eye[2], dx, dy, dz, 6);
    return !!hit[0] && hit[1] === cell[0] && hit[2] === cell[1] && hit[3] === cell[2];
  }
  private baseline(a: Actor, reason: Extract<ServerMessage, { type: 'baseline' }>['reason']): void {
    this.send(a, {
      type: 'baseline',
      epoch: a.epoch,
      ack: a.queue.ack,
      state: this.state(a),
      phase:
        this.paused && (a.role === 'participant' || this.ended) && a.phase === 'playing'
          ? 'paused'
          : a.phase,
      reason,
      movement: a.movement,
    });
    this.inventoryView(a);
    this.miningView(a);
    this.vitalsView(a);
  }
  private chunkBaseline(a: Actor, sub: { x: number; z: number; id: number }): void {
    this.send(a, {
      kind: 'baseline',
      x: sub.x,
      z: sub.z,
      subscription: sub.id,
      revision: this.store.revision(sub.x, sub.z),
      edits: this.store.edits(sub.x, sub.z),
    });
  }
  private subscriptions(a: Actor): void {
    const s = this.store.world.player_state(a.slot),
      desired = around(Math.floor(s[0] / 16), Math.floor(s[2] / 16), STREAM_RADIUS),
      keys = new Set(desired.map((p) => columnKey(p.x, p.z)));
    for (const [key, sub] of a.subscriptions)
      if (!keys.has(key)) {
        this.send(a, { type: 'unload', x: sub.x, z: sub.z, subscription: sub.id });
        a.subscriptions.delete(key);
      }
    desired.sort(
      (p, q) =>
        (p.x * 16 - s[0]) ** 2 +
        (p.z * 16 - s[2]) ** 2 -
        ((q.x * 16 - s[0]) ** 2 + (q.z * 16 - s[2]) ** 2),
    );
    for (const p of desired)
      if (!a.subscriptions.has(columnKey(p.x, p.z))) {
        const sub = { ...p, id: ++a.nextSubscription };
        a.subscriptions.set(columnKey(p.x, p.z), sub);
        this.chunkBaseline(a, sub);
      }
  }
  private edit(a: Actor, m: Extract<ClientMessage, { type: 'action' }>): Outcome {
    if (!a.capabilities.build || a.role !== 'participant')
      return { ok: false, reason: 'forbidden' };
    if (this.mode === 'survival' && m.kind === 'remove')
      return { ok: false, reason: 'mine_required' };
    if (m.kind === 'collect' && (this.mode !== 'survival' || m.state !== 0))
      return { ok: false, reason: 'invalid_collection' };
    const p = this.store.world.player_state(a.slot),
      c = a.controls,
      cos = Math.cos(c.pitch),
      dx = Math.sin(c.yaw) * cos,
      dy = Math.sin(c.pitch),
      dz = -Math.cos(c.yaw) * cos;
    const hit =
      m.kind === 'collect'
        ? this.store.world.raycast_liquids(p[0], p[1] + 1.62, p[2], dx, dy, dz, 6)
        : this.store.world.raycast(p[0], p[1] + 1.62, p[2], dx, dy, dz, 6);
    if (!hit[0] || hit[1] !== m.target[0] || hit[2] !== m.target[1] || hit[3] !== m.target[2])
      return { ok: false, reason: 'out_of_reach' };
    let [x, y, z] = m.target;
    const before = this.content.blocks[this.store.world.get_block(x, y, z)];
    if (!before) return { ok: false, reason: 'unavailable' };
    let state = 0;
    if (m.kind === 'remove') {
      if (before.breakable === false || y === 0) return { ok: false, reason: 'unbreakable' };
      if (!this.inventories.canBreak([x, y, z]))
        return { ok: false, reason: 'container_not_empty' };
    } else if (m.kind === 'collect') {
      const held = this.inventories.held(a.id),
        item = this.content.items.find((i) => i.itemType === held.stack?.itemType);
      if (y === 0 || before.shape !== 'liquid' || item?.collects?.family !== before.name)
        return { ok: false, reason: 'container_required' };
    } else {
      const requested = this.content.blocks[m.state];
      if (!requested || requested.placeable === false || requested.shape === 'air')
        return { ok: false, reason: 'invalid_state' };
      if (this.mode === 'survival') {
        const held = this.inventories.held(a.id),
          item = this.content.items.find((i) => i.itemType === held.stack?.itemType);
        if (!item?.places || item.places !== requested.name)
          return { ok: false, reason: 'not_owned' };
      }
      if (!before.replaceable) {
        x += hit[4];
        y += hit[5];
        z += hit[6];
      }
      if (!inBounds(x, y, z)) return { ok: false, reason: 'bounds' };
      const target = this.content.blocks[this.store.world.get_block(x, y, z)];
      if (!target || !(target.replaceable || target.shape === 'air'))
        return { ok: false, reason: 'occupied' };
      const rule = this.content.behavior.find((b) => b.family === requested.name);
      if (rule?.support === 'wall' && hit[5] !== 0) return { ok: false, reason: 'support' };
      if (rule?.support === 'below' && this.store.world.collision_top(x, y - 1, z) < 1)
        return { ok: false, reason: 'support' };
      const facing = ['north', 'east', 'south', 'west'][
        (Math.round(c.yaw / (Math.PI / 2)) + 4) % 4
      ];
      const half =
        hit[5] < 0 || (hit[5] === 0 && (p[1] + 1.62 + dy * hit[8]) % 1 > 0.5) ? 'top' : 'bottom';
      let variant = '';
      if (requested.shape === 'stairs') variant = `facing=${facing},half=${half}`;
      else if (requested.shape === 'slab') variant = `half=${half}`;
      else if (requested.climbable)
        variant = `facing=${hit[4] === 1 ? 'east' : hit[4] === -1 ? 'west' : hit[6] === 1 ? 'south' : 'north'}`;
      state = variant
        ? this.content.blocks.findIndex((b) => b.name === requested.name && b.state === variant)
        : m.state;
      if (state < 0 || this.store.world.player_overlaps(x, y, z, state))
        return { ok: false, reason: 'collision' };
    }
    const columns = new Set([
      columnKey(m.target[0] >> 4, m.target[2] >> 4),
      columnKey(x >> 4, z >> 4),
    ]);
    if (
      ![...columns].every((key) =>
        m.revisions.some(
          (r) => columnKey(r.x, r.z) === key && r.revision === this.store.revision(r.x, r.z),
        ),
      )
    )
      return { ok: false, reason: 'conflict' };
    let changed: ReturnType<WorldStore['set']> = null;
    if (this.mode === 'survival') {
      const outcome = (
        m.kind === 'collect'
          ? this.inventories.collect.bind(this.inventories)
          : this.inventories.place.bind(this.inventories)
      )(
        a.id,
        m.inventoryRevision,
        m.kind === 'collect' ? before.name : this.content.blocks[state].name,
        () => {
          changed = this.store.set(x, y, z, state);
          return !!changed;
        },
      );
      if (!outcome.ok) return outcome;
      this.inventoryView(a);
    } else changed = this.store.set(x, y, z, state);
    if (!changed) return { ok: false, reason: 'unchanged' };
    if (m.kind === 'remove')
      for (const id of this.inventories.removed([x, y, z])) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
    this.publishEdit(changed);
    return { ok: true, reason: 'edited', cell: [x, y, z], state, revision: changed.revision };
  }
  private snapshots(now: number): void {
    const connected = [...this.actors.values()].filter((a) => a.connection);
    const states = new Map(
      connected
        .filter((a) => a.phase === 'playing')
        .map((other) => [
          other.id,
          {
            id: other.id,
            state: this.state(other),
            yaw: other.controls.yaw,
            pitch: other.controls.pitch,
            appearance:
              this.mode === 'survival'
                ? this.inventories.appearance(other.id)
                : { ...this.inventories.appearance(other.id), held: other.catalogItem },
          },
        ]),
    );
    // Viewers commonly share the same previously published actor object. Its
    // delta is identical for all of them, even though their visibility differs.
    const deltas = new WeakMap<ActorState, ActorDelta | null>();
    for (const viewer of connected) {
      const own = this.store.world.player_state(viewer.slot),
        visible = new Map<string, ActorState>(),
        changes: Extract<ServerMessage, { type: 'snapshot' }>['actors'] = [];
      for (const other of connected)
        if (
          other.id !== viewer.id &&
          other.phase === 'playing' &&
          (other.role !== 'observer' || viewer.role === 'observer')
        ) {
          const actor = states.get(other.id)!,
            state = actor.state;
          if (Math.hypot(state[0] - own[0], state[2] - own[2]) > 48) continue;
          visible.set(other.id, actor);
          const old = viewer.visible.get(other.id);
          if (!old) this.send(viewer, { type: 'actor_joined', actor });
          else {
            let delta = deltas.get(old);
            if (delta === undefined) {
              const next = {
                id: other.id,
                ...(state.some((v, i) => v !== old.state[i]) ? { state } : {}),
                ...(actor.yaw !== old.yaw ? { yaw: actor.yaw } : {}),
                ...(actor.pitch !== old.pitch ? { pitch: actor.pitch } : {}),
                ...(!sameAppearance(actor.appearance, old.appearance)
                  ? { appearance: actor.appearance }
                  : {}),
              };
              delta = Object.keys(next).length > 1 ? next : null;
              deltas.set(old, delta);
            }
            if (delta) changes.push(delta);
          }
        }
      for (const id of viewer.visible.keys())
        if (!visible.has(id)) this.send(viewer, { type: 'actor_removed', id });
      viewer.visible = visible;
      this.send(viewer, {
        type: 'snapshot',
        time: now,
        tick: this.tick,
        self: { epoch: viewer.epoch, ack: viewer.queue.ack, state: this.state(viewer) },
        actors: changes.splice(0, 64),
      });
      while (changes.length)
        this.send(viewer, {
          type: 'snapshot',
          time: now,
          tick: this.tick,
          actors: changes.splice(0, 64),
        });
    }
  }
  dispose(): void {
    this.actors.clear();
    this.vitals.clear();
    this.resting.clear();
    this.policies.clear();
    this.ownerAuthorizations?.clear();
    this.inventories.dispose();
    this.drops.dispose();
    this.explosives.dispose();
    this.store.dispose();
  }
}
