import { Client, type Room } from 'colyseus.js';
import { GameState, type RoomMode } from '@rocket-arena/shared';

type GameRoom = Room<GameState>;
type RoomObserver = (room: GameRoom | null) => void;
type DebugWindow = Window & { __debugRoom?: GameRoom | null };
const localActorIds = new WeakMap<Room, string>();
export function bindLocalActor(room: Room, actorId: string | null): void { localActorIds.set(room, actorId ?? ''); }
export function getLocalActorId(room: Room): string { return localActorIds.get(room) ?? (typeof room.sessionId === 'string' ? room.sessionId : ''); }

/** Owns one client connection's room identity and explicit decode mode. */
export class RoomConnectionManager {
  private room: GameRoom | null = null;
  private requestGeneration = 0;
  private readonly joinedRoomModes = new WeakMap<GameRoom, RoomMode>();

  constructor(
    readonly client: Client,
    private readonly observeRoom: RoomObserver = () => {},
  ) {}

  async joinArena(name?: string): Promise<GameRoom> {
    const generation = ++this.requestGeneration;
    const joinedRoom = this.ownRoom(
      await this.client.joinOrCreate<GameState>('arena', { name: name || 'Player' }),
      'quick',
      generation,
    );
    console.log(`[Net] Joined arena room: ${joinedRoom.id}, sessionId: ${joinedRoom.sessionId}`);
    return joinedRoom;
  }

  async consumePlatformReservation(reservation: Parameters<Client['consumeSeatReservation']>[0]): Promise<GameRoom> {
    const generation = ++this.requestGeneration;
    const room = this.ownRoom(await this.client.consumeSeatReservation<GameState>(reservation), 'custom', generation);
    // Observers and the interval before platform-state have no presentation listener yet.
    room.onMessage('state-sync', () => {});
    room.onMessage('prediction-state', () => {});
    return room;
  }

  async createCustomRoom(name?: string, labBotCount: 0 | 1 | 7 = 0): Promise<GameRoom> {
    const generation = ++this.requestGeneration;
    const joinedRoom = this.ownRoom(
      await this.client.create<GameState>('custom', { name: name || 'Player', ...(labBotCount ? { labBotCount } : {}) }),
      'custom',
      generation,
    );
    console.log(`[Net] Created custom room: ${joinedRoom.id}`);
    return joinedRoom;
  }

  async joinCustomRoom(code: string, name?: string): Promise<GameRoom> {
    const generation = ++this.requestGeneration;
    const rooms = await this.client.getAvailableRooms('custom');
    if (generation !== this.requestGeneration) throw new Error('Room request cancelled');
    const target = rooms.find((candidate) => candidate.metadata?.code === code.toUpperCase());
    if (!target) throw new Error('Room not found');
    const joinedRoom = this.ownRoom(
      await this.client.joinById<GameState>(target.roomId, { name: name || 'Player' }),
      'custom',
      generation,
    );
    console.log(`[Net] Joined custom room: ${joinedRoom.id} (code: ${code})`);
    return joinedRoom;
  }

  getJoinedRoomMode(joinedRoom: GameRoom): RoomMode {
    const mode = this.joinedRoomModes.get(joinedRoom);
    if (mode === undefined) {
      throw new Error('Joined room mode is unavailable for this connection.');
    }
    return mode;
  }

  getRoom(): GameRoom | null {
    if (this.room && !this.room.connection.isOpen) this.clearCurrentRoom(this.room);
    return this.room;
  }

  /** Also cancels matchmaking that may finish after the client has left. */
  leave(): void {
    this.requestGeneration++;
    const previous = this.room;
    if (!previous) return;
    this.clearCurrentRoom(previous);
    this.closeRoom(previous);
  }

  private closeRoom(room: GameRoom): void {
    try { void Promise.resolve(room.leave()).catch(() => {}); } catch { /* Already closed. */ }
  }

  private ownRoom(nextRoom: GameRoom, mode: RoomMode, generation: number): GameRoom {
    if (generation !== this.requestGeneration) {
      this.closeRoom(nextRoom);
      throw new Error('Room request cancelled');
    }
    const previous = this.room;
    this.room = nextRoom;
    this.joinedRoomModes.set(nextRoom, mode);
    this.observeRoom(nextRoom);
    nextRoom.onLeave(() => this.clearCurrentRoom(nextRoom));
    if (previous && previous !== nextRoom) this.closeRoom(previous);
    return nextRoom;
  }

  private clearCurrentRoom(expectedRoom: GameRoom): void {
    this.joinedRoomModes.delete(expectedRoom);
    if (this.room !== expectedRoom) return;
    this.room = null;
    this.observeRoom(null);
  }
}

let client: Client | null = null;
let connectionManager: RoomConnectionManager | null = null;

function exposeDebugRoom(nextRoom: GameRoom | null): void {
  if (typeof window === 'undefined') return;
  (window as DebugWindow).__debugRoom = nextRoom;
}

/**
 * Path the reverse proxy forwards to the Colyseus process in production.
 * Matchmaking (`/matchmake/...`) and room sockets both hang off this prefix,
 * so the proxy can strip it and serve the built client from the site root.
 */
const PROXIED_SERVER_PATH = '/game';

function getServerUrl(): string {
  if (typeof window === 'undefined') {
    throw new Error('The browser networking client requires a Window location.');
  }

  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) return configured;

  // A page served over TLS may only open a TLS socket, and the proxy that
  // terminates TLS is the only thing listening on the public port. Dev keeps
  // using the same-origin proxy for both matchmaking and room sockets.
  const { protocol, host } = window.location;
  if (new URLSearchParams(window.location.search).get('embed') === '1') return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
  if (protocol === 'https:') return `wss://${host}${PROXIED_SERVER_PATH}`;
  return `ws://${host}${PROXIED_SERVER_PATH}`;
}

export function getClient(): Client {
  if (client === null) client = new Client(getServerUrl());
  return client;
}

function getConnectionManager(): RoomConnectionManager {
  if (connectionManager === null) {
    connectionManager = new RoomConnectionManager(getClient(), exposeDebugRoom);
  }
  return connectionManager;
}

export function joinArena(name?: string): Promise<GameRoom> {
  return getConnectionManager().joinArena(name);
}

export function createCustomRoom(name?: string, labBotCount: 0 | 1 | 7 = 0): Promise<GameRoom> {
  return getConnectionManager().createCustomRoom(name, labBotCount);
}

export function joinCustomRoom(code: string, name?: string): Promise<GameRoom> {
  return getConnectionManager().joinCustomRoom(code, name);
}

export function getJoinedRoomMode(joinedRoom: GameRoom): RoomMode {
  return getConnectionManager().getJoinedRoomMode(joinedRoom);
}

export function getRoom(): GameRoom | null {
  return getConnectionManager().getRoom();
}

export function leaveRoom(): void {
  connectionManager?.leave();
}

export function joinPlatformReservation(reservation: Parameters<Client['consumeSeatReservation']>[0]): Promise<GameRoom> {
  return getConnectionManager().consumePlatformReservation(reservation);
}
