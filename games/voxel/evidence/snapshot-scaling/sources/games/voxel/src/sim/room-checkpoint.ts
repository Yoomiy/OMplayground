import { BOUNDS, GENERATOR_VERSION } from '../shared/protocol.ts';
import type { BuildIdentity } from '../shared/protocol.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { GameMode } from '../shared/gameplay.ts';
import {
  checkpointIdentity,
  checkpointInteger,
  checkpointObject,
  checkpointPosition,
} from './checkpoint-values.ts';
import { Vitals } from './vitals.ts';
import type { VitalsCheckpoint } from './vitals.ts';
import type { InventoryCheckpoint } from './inventory.ts';
import type { DropsCheckpoint } from './drops.ts';
import type { ExplosivesCheckpoint } from './explosives.ts';
import type { WorldCheckpoint } from './world-store.ts';
export const RECONNECT_RESERVATION_MS = 30000;
export type PlayerCheckpoint = Readonly<{
  id: string;
  state: readonly number[];
  yaw: number;
  pitch: number;
  reservationMs: number | null;
  vitals: VitalsCheckpoint;
}>;
export type RoomCheckpoint = Readonly<{
  schema: 1;
  worldId: string;
  seed: number;
  preset: 'blockyard-natural-v2';
  generatorVersion: number;
  contentHash: string;
  engineHash: string;
  sourceBuildId: string;
  bounds: typeof BOUNDS;
  mode: GameMode;
  tick: number;
  epoch: number;
  paused: boolean;
  hitSequence: number;
  explosionSequence: number;
  spawn: readonly [number, number, number];
  players: readonly PlayerCheckpoint[];
  world: WorldCheckpoint;
  inventories: InventoryCheckpoint;
  drops: DropsCheckpoint;
  explosives: ExplosivesCheckpoint;
}>;
export type RoomCheckpointInput = Omit<
  RoomCheckpoint,
  'world' | 'inventories' | 'drops' | 'explosives'
> & {
  world: unknown;
  inventories: unknown;
  drops: unknown;
  explosives: unknown;
};
export function validCheckpointBody(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === 17 &&
    Array.from(value).every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    checkpointPosition(value.slice(0, 3)) &&
    [3, 4, 5].every((i) => Math.abs(value[i]) <= 128) &&
    [6, 7, 8, 9, 10, 12].every((i) => value[i] === 0 || value[i] === 1) &&
    value[11] >= 0 &&
    [13, 14, 15, 16].every((i) => value[i] === 0)
  );
}
/** Component fields remain unknown until their owning decoders validate them. */
export function readRoomCheckpoint(
  value: unknown,
  content: ContentManifest,
  build: BuildIdentity,
): RoomCheckpointInput {
  const invalid = (): never => {
    throw new Error('invalid room checkpoint');
  };
  if (
    !checkpointObject(value, [
      'schema',
      'worldId',
      'seed',
      'preset',
      'generatorVersion',
      'contentHash',
      'engineHash',
      'sourceBuildId',
      'bounds',
      'mode',
      'tick',
      'epoch',
      'paused',
      'hitSequence',
      'explosionSequence',
      'spawn',
      'players',
      'world',
      'inventories',
      'drops',
      'explosives',
    ]) ||
    value.schema !== 1 ||
    !checkpointIdentity(value.worldId) ||
    !checkpointInteger(value.seed, 0, 0xffffffff) ||
    value.preset !== 'blockyard-natural-v2' ||
    value.generatorVersion !== GENERATOR_VERSION ||
    value.contentHash !== content.hash ||
    value.engineHash !== build.engineHash ||
    typeof value.sourceBuildId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sourceBuildId) ||
    !checkpointObject(value.bounds, Object.keys(BOUNDS)) ||
    !Object.entries(BOUNDS).every(
      ([key, n]) => (value.bounds as Record<string, unknown>)[key] === n,
    ) ||
    !['creative', 'survival'].includes(value.mode as string) ||
    !checkpointInteger(value.tick, 0, Number.MAX_SAFE_INTEGER - 9000) ||
    !checkpointInteger(value.epoch, 0, Number.MAX_SAFE_INTEGER - 2) ||
    typeof value.paused !== 'boolean' ||
    !checkpointInteger(value.hitSequence) ||
    !checkpointInteger(value.explosionSequence) ||
    !checkpointPosition(value.spawn) ||
    !Array.isArray(value.players)
  )
    return invalid();
  const ids = new Set<string>(),
    players: PlayerCheckpoint[] = [];
  for (const p of value.players) {
    if (
      !checkpointObject(p, ['id', 'state', 'yaw', 'pitch', 'reservationMs', 'vitals']) ||
      !checkpointIdentity(p.id) ||
      ids.has(p.id) ||
      !validCheckpointBody(p.state) ||
      typeof p.yaw !== 'number' ||
      !Number.isFinite(p.yaw) ||
      Math.abs(p.yaw) > Math.PI ||
      typeof p.pitch !== 'number' ||
      !Number.isFinite(p.pitch) ||
      Math.abs(p.pitch) > Math.PI / 2 ||
      (p.reservationMs !== null &&
        (typeof p.reservationMs !== 'number' ||
          !Number.isFinite(p.reservationMs) ||
          p.reservationMs < 0 ||
          p.reservationMs > RECONNECT_RESERVATION_MS))
    )
      return invalid();
    let vitals: VitalsCheckpoint;
    try {
      vitals = Vitals.fromCheckpoint(p.vitals).checkpoint();
    } catch {
      return invalid();
    }
    ids.add(p.id);
    players.push(
      Object.freeze({
        id: p.id,
        state: Object.freeze([...p.state]),
        yaw: p.yaw,
        pitch: p.pitch,
        reservationMs: p.reservationMs,
        vitals,
      }),
    );
  }
  return Object.freeze({
    ...value,
    spawn: Object.freeze([...value.spawn]),
    bounds: BOUNDS,
    players: Object.freeze(players),
  }) as RoomCheckpointInput;
}
