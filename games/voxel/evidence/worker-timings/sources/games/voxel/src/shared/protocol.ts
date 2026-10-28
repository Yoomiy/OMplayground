import { isInputFrame } from './input.ts';
import type { InputFrame } from './input.ts';
import { ENVIRONMENT_VERSION } from './environment.ts';
import { isInventoryCommand, isInventoryView, validStack } from './inventory.ts';
import type { InventoryCommand, InventoryView } from './inventory.ts';
import type { GameMode, MiningView, DropView } from './gameplay.ts';
import { isMovementModifiers, isVitalsView } from './vitals.ts';
import type { VitalsView } from './vitals.ts';
import type { MovementModifiers } from './movement.ts';
import type { HitEvent } from './combat.ts';
import type { ExplosiveView, ExplosionEvent } from './explosives.ts';
import { isActorAppearance } from './appearance.ts';
import type { ActorAppearance } from './appearance.ts';
import { isLifecycleView } from './lifecycle.ts';
import type { LifecycleView } from './lifecycle.ts';
export const PROTOCOL = 13;
export const GENERATOR_VERSION = 2;
export const MAX_CONTROL_BYTES = 16384;
export const STREAM_RADIUS = 3;
export const MESH_RADIUS = 2;
export const COLLISION_RADIUS = 1;
export const BOUNDS = Object.freeze({ minX: -256, minZ: -256, maxX: 256, maxZ: 256, height: 256 });
export type BuildIdentity = {
  buildId: string;
  engineHash: string;
  bindingsHash: string;
  contentHash: string;
  protocol: number;
  environmentVersion: number;
};
export type Revision = { x: number; z: number; revision: number };
export type Cell = readonly [number, number, number];
export type ClientMessage =
  | { type: 'hello'; ticket: string; buildId: string }
  | { type: 'input'; frames: InputFrame[] }
  | { type: 'ready'; epoch: number; columns: Revision[] }
  | { type: 'focus'; epoch: number; active: boolean }
  | { type: 'palette'; epoch: number; sequence: number; state: number }
  | { type: 'resync'; x: number; z: number; subscription: number }
  | { type: 'inventory'; epoch: number; sequence: number; operation: InventoryCommand }
  | { type: 'respawn'; epoch: number; sequence: number }
  | {
      type: 'ignite';
      epoch: number;
      sequence: number;
      inputSequence: number;
      target: Cell;
      revision: number;
      inventoryRevision: number;
    }
  | {
      type: 'attack';
      epoch: number;
      sequence: number;
      inputSequence: number;
      inventoryRevision: number;
    }
  | {
      type: 'mining';
      epoch: number;
      sequence: number;
      inputSequence: number;
      target: Cell | null;
      revision: number;
      inventoryRevision: number;
    }
  | {
      type: 'action';
      epoch: number;
      sequence: number;
      inputSequence: number;
      kind: 'place' | 'remove' | 'collect';
      target: Cell;
      state: number;
      inventoryRevision: number;
      revisions: Revision[];
    }
  | { type: 'flight'; epoch: number; sequence: number; on: boolean };
export type ActorState = {
  id: string;
  state: number[];
  yaw: number;
  pitch: number;
  appearance: ActorAppearance;
};
export type ActorDelta = {
  id: string;
  state?: number[];
  yaw?: number;
  pitch?: number;
  appearance?: ActorAppearance;
};
export type ServerMessage =
  | LifecycleView
  | { type: 'rules'; epoch: number; mode: GameMode; combat: boolean; explosives: boolean }
  | {
      type: 'welcome';
      actorId: string;
      epoch: number;
      worldId: string;
      seed: number;
      tick: number;
      environmentVersion: number;
      spawn: Cell;
      buildId: string;
      contentHash: string;
      generatorVersion: number;
      role: 'participant' | 'observer';
      mode: GameMode;
      combat: boolean;
      explosives: boolean;
    }
  | {
      type: 'baseline';
      epoch: number;
      ack: number;
      state: number[];
      phase: 'preparing' | 'playing' | 'paused' | 'dead';
      reason:
        | 'join'
        | 'ready'
        | 'resync'
        | 'focus'
        | 'flight'
        | 'pause'
        | 'movement'
        | 'death'
        | 'respawn'
        | 'damage'
        | 'mode'
        | 'teleport';
      movement: MovementModifiers;
    }
  | {
      type: 'snapshot';
      time: number;
      tick: number;
      self?: { epoch: number; ack: number; state: number[] };
      actors: ActorDelta[];
    }
  | { type: 'actor_joined'; actor: ActorState }
  | { type: 'actor_removed'; id: string }
  | { type: 'unload'; x: number; z: number; subscription: number }
  | { type: 'inventory'; epoch: number; view: InventoryView }
  | { type: 'vitals'; epoch: number; view: VitalsView }
  | ({ type: 'hit' } & HitEvent)
  | { type: 'explosives'; reset: boolean; upsert: ExplosiveView[]; removed: string[] }
  | ({ type: 'explosion' } & ExplosionEvent)
  | ({ type: 'mining'; epoch: number } & MiningView)
  | { type: 'drops'; reset: boolean; upsert: DropView[]; removed: string[] }
  | {
      type: 'result';
      epoch: number;
      sequence: number;
      status: 'applied' | 'cached' | 'retired' | 'stale_epoch' | 'invalid';
      outcome?: { ok: boolean; reason: string; cell?: Cell; state?: number; revision?: number };
    }
  | {
      type: 'error';
      code:
        | 'INVALID'
        | 'INCOMPATIBLE'
        | 'UNAUTHORIZED'
        | 'RECOVERING'
        | 'REPLACED'
        | 'INTERNAL'
        | 'SESSION_ENDED';
      retryable: boolean;
    };
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number =>
  Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const coordinate = (n: unknown) => integer(n, -16, 15);
const revision = (v: unknown): v is Revision =>
  object(v) &&
  exact(v, ['x', 'z', 'revision']) &&
  coordinate(v.x) &&
  coordinate(v.z) &&
  integer(v.revision);
const cell = (v: unknown): v is Cell =>
  Array.isArray(v) &&
  v.length === 3 &&
  integer(v[0], BOUNDS.minX, BOUNDS.maxX - 1) &&
  integer(v[1], 0, 255) &&
  integer(v[2], BOUNDS.minZ, BOUNDS.maxZ - 1);
const state = (v: unknown): v is number[] => Array.isArray(v) && v.length === 17 && v.every(finite);
export function parseClientMessage(text: string): ClientMessage | null {
  if (text.length > MAX_CONTROL_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!object(v)) return null;
  switch (v.type) {
    case 'hello':
      return exact(v, ['type', 'ticket', 'buildId']) &&
        typeof v.ticket === 'string' &&
        /^[a-zA-Z0-9_-]{32,128}$/.test(v.ticket) &&
        typeof v.buildId === 'string' &&
        /^[a-f0-9]{64}$/.test(v.buildId)
        ? (v as ClientMessage)
        : null;
    case 'input':
      return exact(v, ['type', 'frames']) &&
        Array.isArray(v.frames) &&
        v.frames.length > 0 &&
        v.frames.length <= 4 &&
        v.frames.every(isInputFrame)
        ? (v as ClientMessage)
        : null;
    case 'ready':
      return exact(v, ['type', 'epoch', 'columns']) &&
        integer(v.epoch, 1) &&
        Array.isArray(v.columns) &&
        v.columns.length >= 1 &&
        v.columns.length <= 9 &&
        v.columns.every(revision) &&
        new Set(v.columns.map((c) => `${c.x},${c.z}`)).size === v.columns.length
        ? (v as ClientMessage)
        : null;
    case 'focus':
      return exact(v, ['type', 'epoch', 'active']) &&
        integer(v.epoch, 1) &&
        typeof v.active === 'boolean'
        ? (v as ClientMessage)
        : null;
    case 'palette':
      return exact(v, ['type', 'epoch', 'sequence', 'state']) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        integer(v.state, 1, 65534)
        ? (v as ClientMessage)
        : null;
    case 'resync':
      return exact(v, ['type', 'x', 'z', 'subscription']) &&
        coordinate(v.x) &&
        coordinate(v.z) &&
        integer(v.subscription, 1)
        ? (v as ClientMessage)
        : null;
    case 'ignite':
      return exact(v, [
        'type',
        'epoch',
        'sequence',
        'inputSequence',
        'target',
        'revision',
        'inventoryRevision',
      ]) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        integer(v.inputSequence) &&
        cell(v.target) &&
        integer(v.revision) &&
        integer(v.inventoryRevision)
        ? (v as ClientMessage)
        : null;
    case 'attack':
      return exact(v, ['type', 'epoch', 'sequence', 'inputSequence', 'inventoryRevision']) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        integer(v.inputSequence) &&
        integer(v.inventoryRevision)
        ? (v as ClientMessage)
        : null;
    case 'respawn':
      return exact(v, ['type', 'epoch', 'sequence']) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1)
        ? (v as ClientMessage)
        : null;
    case 'flight':
      return exact(v, ['type', 'epoch', 'sequence', 'on']) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        typeof v.on === 'boolean'
        ? (v as ClientMessage)
        : null;
    case 'inventory':
      return exact(v, ['type', 'epoch', 'sequence', 'operation']) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        isInventoryCommand(v.operation, cell)
        ? (v as ClientMessage)
        : null;
    case 'mining':
      return exact(v, [
        'type',
        'epoch',
        'sequence',
        'inputSequence',
        'target',
        'revision',
        'inventoryRevision',
      ]) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        integer(v.inputSequence) &&
        (v.target === null || cell(v.target)) &&
        integer(v.revision) &&
        integer(v.inventoryRevision)
        ? (v as ClientMessage)
        : null;
    case 'action':
      return exact(v, [
        'type',
        'epoch',
        'sequence',
        'inputSequence',
        'kind',
        'target',
        'state',
        'inventoryRevision',
        'revisions',
      ]) &&
        integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        integer(v.inputSequence) &&
        ['place', 'remove', 'collect'].includes(v.kind as string) &&
        cell(v.target) &&
        integer(v.state, 0, 65534) &&
        (v.kind !== 'collect' || v.state === 0) &&
        integer(v.inventoryRevision) &&
        Array.isArray(v.revisions) &&
        v.revisions.length >= 1 &&
        v.revisions.length <= 2 &&
        v.revisions.every(revision)
        ? (v as ClientMessage)
        : null;
    default:
      return null;
  }
}
export function parseServerMessage(text: string): ServerMessage | null {
  if (text.length > 65536) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!object(v)) return null;
  const id = (s: unknown) => typeof s === 'string' && s.length > 0 && s.length <= 128;
  switch (v.type) {
    case 'lifecycle':
      return isLifecycleView(v) ? v : null;
    case 'rules':
      return Object.keys(v).length === 5 &&
        integer(v.epoch, 1) &&
        ['creative', 'survival'].includes(v.mode as string) &&
        typeof v.combat === 'boolean' &&
        typeof v.explosives === 'boolean'
        ? (v as ServerMessage)
        : null;
    case 'welcome':
      return id(v.actorId) &&
        integer(v.epoch, 1) &&
        id(v.worldId) &&
        integer(v.seed, 0, 0xffffffff) &&
        integer(v.tick) &&
        v.environmentVersion === ENVIRONMENT_VERSION &&
        Array.isArray(v.spawn) &&
        v.spawn.length === 3 &&
        v.spawn.every(finite) &&
        id(v.buildId) &&
        id(v.contentHash) &&
        integer(v.generatorVersion) &&
        ['participant', 'observer'].includes(v.role as string) &&
        ['creative', 'survival'].includes(v.mode as string) &&
        typeof v.combat === 'boolean' &&
        typeof v.explosives === 'boolean'
        ? (v as ServerMessage)
        : null;
    case 'baseline':
      return integer(v.epoch, 1) &&
        integer(v.ack) &&
        state(v.state) &&
        ['preparing', 'playing', 'paused', 'dead'].includes(v.phase as string) &&
        [
          'join',
          'ready',
          'resync',
          'focus',
          'flight',
          'pause',
          'movement',
          'death',
          'respawn',
          'damage',
          'mode',
          'teleport',
        ].includes(v.reason as string) &&
        isMovementModifiers(v.movement)
        ? (v as ServerMessage)
        : null;
    case 'snapshot':
      return finite(v.time) &&
        integer(v.tick) &&
        (!v.self ||
          (object(v.self) &&
            integer(v.self.epoch, 1) &&
            integer(v.self.ack) &&
            state(v.self.state))) &&
        Array.isArray(v.actors) &&
        v.actors.length <= 64 &&
        v.actors.every(
          (a) =>
            object(a) &&
            Object.keys(a).every((key) =>
              ['id', 'state', 'yaw', 'pitch', 'appearance'].includes(key),
            ) &&
            id(a.id) &&
            (a.state === undefined || state(a.state)) &&
            (a.yaw === undefined || finite(a.yaw)) &&
            (a.pitch === undefined || finite(a.pitch)) &&
            (a.appearance === undefined || isActorAppearance(a.appearance)),
        )
        ? (v as ServerMessage)
        : null;
    case 'actor_joined':
      return object(v.actor) &&
        exact(v.actor, ['id', 'state', 'yaw', 'pitch', 'appearance']) &&
        id(v.actor.id) &&
        state(v.actor.state) &&
        finite(v.actor.yaw) &&
        finite(v.actor.pitch) &&
        isActorAppearance(v.actor.appearance)
        ? (v as ServerMessage)
        : null;
    case 'actor_removed':
      return id(v.id) ? (v as ServerMessage) : null;
    case 'explosives': {
      const id = (v: unknown) => typeof v === 'string' && /^tnt-[1-9][0-9]{0,15}$/.test(v);
      const position = (v: unknown) =>
        Array.isArray(v) && v.length === 3 && v.every(finite) && inBounds(v[0], v[1], v[2]);
      return exact(v, ['type', 'reset', 'upsert', 'removed']) &&
        typeof v.reset === 'boolean' &&
        Array.isArray(v.upsert) &&
        v.upsert.length <= 64 &&
        v.upsert.every(
          (body) =>
            object(body) &&
            exact(body, ['id', 'revision', 'state', 'position', 'remaining', 'total']) &&
            id(body.id) &&
            integer(body.revision) &&
            integer(body.state, 1, 65534) &&
            position(body.position) &&
            integer(body.total, 30, 900) &&
            integer(body.remaining, 0, body.total as number),
        ) &&
        Array.isArray(v.removed) &&
        v.removed.length <= 64 &&
        v.removed.every(id)
        ? (v as ServerMessage)
        : null;
    }
    case 'explosion':
      return exact(v, [
        'type',
        'sequence',
        'id',
        'position',
        'radius',
        'removed',
        'cancelled',
        'columns',
      ]) &&
        integer(v.sequence, 1) &&
        typeof v.id === 'string' &&
        /^tnt-[1-9][0-9]{0,15}$/.test(v.id) &&
        Array.isArray(v.position) &&
        v.position.length === 3 &&
        v.position.every(finite) &&
        inBounds(v.position[0], v.position[1], v.position[2]) &&
        integer(v.radius, 1, 4) &&
        integer(v.removed, 0, 729) &&
        typeof v.cancelled === 'boolean' &&
        Array.isArray(v.columns) &&
        v.columns.length <= 9 &&
        v.columns.every(revision) &&
        (!v.cancelled || (v.removed === 0 && v.columns.length === 0))
        ? (v as ServerMessage)
        : null;
    case 'hit':
      return exact(v, ['type', 'sequence', 'attacker', 'target', 'position', 'damage', 'dead']) &&
        integer(v.sequence, 1) &&
        id(v.attacker) &&
        id(v.target) &&
        Array.isArray(v.position) &&
        v.position.length === 3 &&
        v.position.every(finite) &&
        inBounds(v.position[0], v.position[1], v.position[2]) &&
        integer(v.damage, 1, 20) &&
        typeof v.dead === 'boolean'
        ? (v as ServerMessage)
        : null;
    case 'vitals':
      return exact(v, ['type', 'epoch', 'view']) && integer(v.epoch, 1) && isVitalsView(v.view)
        ? (v as ServerMessage)
        : null;
    case 'inventory':
      return exact(v, ['type', 'epoch', 'view']) &&
        integer(v.epoch, 1) &&
        isInventoryView(v.view, cell)
        ? (v as ServerMessage)
        : null;
    case 'mining':
      return exact(v, ['type', 'epoch', 'target', 'elapsed', 'total']) &&
        integer(v.epoch, 1) &&
        (v.target === null
          ? v.elapsed === 0 && v.total === 0
          : cell(v.target) &&
            integer(v.total, 1, 30 * 3600) &&
            integer(v.elapsed, 0, v.total as number))
        ? (v as ServerMessage)
        : null;
    case 'drops': {
      const dropId = (id: unknown) => typeof id === 'string' && /^drop-[1-9][0-9]{0,15}$/.test(id);
      return exact(v, ['type', 'reset', 'upsert', 'removed']) &&
        typeof v.reset === 'boolean' &&
        Array.isArray(v.upsert) &&
        v.upsert.length <= 64 &&
        v.upsert.every(
          (drop) =>
            object(drop) &&
            exact(drop, ['id', 'revision', 'stack', 'position']) &&
            dropId(drop.id) &&
            integer(drop.revision) &&
            validStack(drop.stack) &&
            Array.isArray(drop.position) &&
            drop.position.length === 3 &&
            drop.position.every(finite) &&
            drop.position[0] >= BOUNDS.minX &&
            drop.position[0] < BOUNDS.maxX &&
            drop.position[1] >= 0 &&
            drop.position[1] < 256 &&
            drop.position[2] >= BOUNDS.minZ &&
            drop.position[2] < BOUNDS.maxZ,
        ) &&
        Array.isArray(v.removed) &&
        v.removed.length <= 64 &&
        v.removed.every(dropId)
        ? (v as ServerMessage)
        : null;
    }
    case 'unload':
      return coordinate(v.x) && coordinate(v.z) && integer(v.subscription, 1)
        ? (v as ServerMessage)
        : null;
    case 'result':
      return integer(v.epoch, 1) &&
        integer(v.sequence, 1) &&
        ['applied', 'cached', 'retired', 'stale_epoch', 'invalid'].includes(v.status as string) &&
        (v.outcome === undefined ||
          (object(v.outcome) &&
            typeof v.outcome.ok === 'boolean' &&
            typeof v.outcome.reason === 'string' &&
            v.outcome.reason.length < 64 &&
            (v.outcome.cell === undefined || cell(v.outcome.cell)) &&
            (v.outcome.state === undefined || integer(v.outcome.state, 0, 65534)) &&
            (v.outcome.revision === undefined || integer(v.outcome.revision))))
        ? (v as ServerMessage)
        : null;
    case 'error':
      return [
        'INVALID',
        'INCOMPATIBLE',
        'UNAUTHORIZED',
        'RECOVERING',
        'REPLACED',
        'INTERNAL',
        'SESSION_ENDED',
      ].includes(v.code as string) &&
        typeof v.retryable === 'boolean' &&
        (v.code !== 'SESSION_ENDED' || v.retryable === false)
        ? (v as ServerMessage)
        : null;
    default:
      return null;
  }
}
export function columnKey(x: number, z: number): string {
  return `${x},${z}`;
}
export function inBounds(x: number, y: number, z: number): boolean {
  return (
    x >= BOUNDS.minX && x < BOUNDS.maxX && z >= BOUNDS.minZ && z < BOUNDS.maxZ && y >= 0 && y < 256
  );
}
export function around(x: number, z: number, radius: number): { x: number; z: number }[] {
  const out = [];
  for (let dz = -radius; dz <= radius; dz++)
    for (let dx = -radius; dx <= radius; dx++)
      if (coordinate(x + dx) && coordinate(z + dz)) out.push({ x: x + dx, z: z + dz });
  return out;
}
