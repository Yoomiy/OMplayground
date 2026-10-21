import type RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_COLLISION_GEOMETRY, ROOM_POLICIES, TUNING_IDS, getScalarTuningValue,
  type MatchPhase, type RoomPinnedTuningSnapshot, type RosterEntry } from '@rocket-arena/shared';
import { getConstant } from '@rocket-arena/shared/constants';
import { isCapacityValidRoster } from '../systems/room-mutations.js';
import { initializeAuthoritativeRapierWorld, type AuthoritativeRapierCar } from './rapier-room-world.js';
import { AuthoritativeRoomCore, type AuthoritativeRoomCoreOptions,
  type AuthoritativeRoomWorldBundle } from './authoritative-room-core.js';

export const GAME_ROOM_POLICY = ROOM_POLICIES.custom;

/**
 * A policy-bound core factory shared by the Colyseus adapter and focused room
 * tests. Requested capacities remain untrusted assertions checked by the core.
 */
export type GameRoomCoreOptions<TWorld, TCar, TBall> = Omit<
  AuthoritativeRoomCoreOptions<TWorld, TCar, TBall>,
  'mode' | 'policy'
>;

export function createGameRoomCore<TWorld, TCar, TBall>(
  options: GameRoomCoreOptions<TWorld, TCar, TBall>,
): AuthoritativeRoomCore<TWorld, TCar, TBall> {
  return new AuthoritativeRoomCore({
    ...options,
    mode: GAME_ROOM_POLICY.mode,
    policy: GAME_ROOM_POLICY,
  });
}

export interface GameRoomStartPredicateState {
  readonly phase: MatchPhase;
  readonly hostSessionId: string | null;
  readonly roster: ReadonlyMap<string, Readonly<RosterEntry>>;
}

/** Read-only Custom capacity predicate; MatchFlow owns the later countdown. */
export function isGameRoomCapacityValidRoster(
  roster: ReadonlyMap<string, Readonly<RosterEntry>>,
): boolean {
  return isCapacityValidRoster(GAME_ROOM_POLICY, roster);
}

/** Compatibility predicate matching the core's fixed-step Host-start validation. */
export function isGameRoomHostStartEligible(
  state: GameRoomStartPredicateState,
  requesterSessionId: string,
): boolean {
  const requester = state.roster.get(requesterSessionId);
  return state.phase === 'waiting'
    && state.hostSessionId === requesterSessionId
    && requester?.isHost === true
    && isGameRoomCapacityValidRoster(state.roster);
}

/** Initial positions before the authoritative kickoff slot service takes over. */
function initialCarPosition(
  entry: Pick<RosterEntry, 'acceptedJoinOrdinal' | 'team'>,
  tuning: RoomPinnedTuningSnapshot,
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  const y = getScalarTuningValue(tuning, TUNING_IDS.car.collider.height) / 2
    + getConstant('ARENA.KICKOFF.SPAWN_CLEARANCE');
  const teamLocalSlot = Math.floor(entry.acceptedJoinOrdinal / 2)
    % GAME_ROOM_POLICY.teamCapacity;
  const laneMultiplier = [1, -1, 0.5, -0.5][teamLocalSlot] ?? 0;
  const xOffset = entry.team === 'blue'
    ? getConstant('ARENA.KICKOFF.BLUE_X_OFFSET')
    : getConstant('ARENA.KICKOFF.ORANGE_X_OFFSET');
  const z = entry.team === 'blue'
    ? getConstant('ARENA.KICKOFF.BLUE_Z_OFFSET')
    : getConstant('ARENA.KICKOFF.ORANGE_Z_OFFSET');

  return { x: laneMultiplier * xOffset, y, z };
}

/** Create the shared staged Rapier runtime under the Custom policy. */
export async function initializeGameWorld(
  context: { readonly tuning: RoomPinnedTuningSnapshot },
): Promise<AuthoritativeRoomWorldBundle<RAPIER.World, AuthoritativeRapierCar, RAPIER.RigidBody>> {
  return initializeAuthoritativeRapierWorld(context, {
    resolvedGeometry: ARENA_COLLISION_GEOMETRY,
    initialCarPosition: initialCarPosition,
  });
}
