import { Client, type Room } from 'colyseus.js';
import type { GameState } from '@rocket-arena/shared';

type GameRoom = Room<GameState>;
type Reservation = Parameters<Client['consumeSeatReservation']>[0];
type RoomObserver = (room: GameRoom | null) => void;
type DebugWindow = Window & { __rocketRoom?: GameRoom | null };
const localActorIds = new WeakMap<Room, string>();
export function bindLocalActor(room: Room, actorId: string | null): void { localActorIds.set(room, actorId ?? ''); }
export function getLocalActorId(room: Room): string { return localActorIds.get(room) ?? (typeof room.sessionId === 'string' ? room.sessionId : ''); }

/** Owns one authenticated reservation/transport lifetime, including in-flight disposal. */
export class RoomConnectionManager {
  private room: GameRoom | null = null;
  private requestGeneration = 0;
  private readonly closingRooms = new WeakSet<GameRoom>();

  constructor(readonly client: Client, private readonly observeRoom: RoomObserver = () => {}) {}

  async consumePlatformReservation(reservation: Reservation): Promise<GameRoom> {
    const generation = ++this.requestGeneration;
    const room = this.ownRoom(await this.client.consumeSeatReservation<GameState>(reservation), generation);
    // Observers and the interval before platform-state have no presentation listener yet.
    room.onMessage('state-sync', () => {});
    room.onMessage('prediction-state', () => {});
    return room;
  }

  getRoom(): GameRoom | null {
    if (this.room && !this.room.connection.isOpen) this.clearCurrentRoom(this.room);
    return this.room;
  }

  leave(): void {
    this.requestGeneration++;
    const previous = this.room;
    if (!previous) return;
    this.clearCurrentRoom(previous);
    this.closeRoom(previous);
  }

  private closeRoom(room: GameRoom): void {
    // Colyseus 0.15 leave() sends even on closing sockets. Server-driven
    // rematches may close the transport before React replaces the frame.
    if (!room.connection?.isOpen || this.closingRooms.has(room)) return;
    this.closingRooms.add(room);
    try { void Promise.resolve(room.leave()).catch(() => {}); } catch { /* Already closed. */ }
  }

  private ownRoom(nextRoom: GameRoom, generation: number): GameRoom {
    if (generation !== this.requestGeneration) {
      this.closeRoom(nextRoom);
      throw new Error('Room request cancelled');
    }
    const previous = this.room;
    this.room = nextRoom;
    this.observeRoom(nextRoom);
    nextRoom.onLeave(() => this.clearCurrentRoom(nextRoom));
    if (previous && previous !== nextRoom) this.closeRoom(previous);
    return nextRoom;
  }

  private clearCurrentRoom(expectedRoom: GameRoom): void {
    if (this.room !== expectedRoom) return;
    this.room = null;
    this.observeRoom(null);
  }
}

let manager: RoomConnectionManager | null = null;
function getConnectionManager(): RoomConnectionManager {
  if (!manager) {
    const { protocol, host } = window.location;
    manager = new RoomConnectionManager(new Client(`${protocol === 'https:' ? 'wss' : 'ws'}://${host}`), room => {
      if (import.meta.env.VITE_ROCKET_TEST_HOOKS === '1') (window as DebugWindow).__rocketRoom = room;
    });
  }
  return manager;
}
export function getRoom(): GameRoom | null { return getConnectionManager().getRoom(); }
export function leaveRoom(): void { manager?.leave(); }
export function joinPlatformReservation(reservation: Reservation): Promise<GameRoom> {
  return getConnectionManager().consumePlatformReservation(reservation);
}
