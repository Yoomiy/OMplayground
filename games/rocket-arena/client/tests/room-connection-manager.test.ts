import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client, Room } from 'colyseus.js';
import type { GameState } from '@rocket-arena/shared';
import { RoomConnectionManager } from '../src/networking/client.js';

type Reservation = Parameters<Client['consumeSeatReservation']>[0];
const reservation = {} as Reservation;
class FakeRoom {
  leaveCount = 0;
  readonly connection = { isOpen: true };
  private readonly handlers: (() => void)[] = [];
  onLeave(handler: () => void): void { this.handlers.push(handler); }
  onMessage(): () => void { return () => {}; }
  leave(): void {
    this.leaveCount++;
    this.connection.isOpen = false;
    this.handlers.forEach(handler => handler());
  }
}
function setup() {
  const rooms = [new FakeRoom(), new FakeRoom()];
  let next = 0;
  const client = { consumeSeatReservation: async () => rooms[next++]! };
  const observed: (Room<GameState> | null)[] = [];
  const manager = new RoomConnectionManager(client as unknown as Client, room => observed.push(room));
  return { rooms, client, manager, observed };
}

test('reservation replacement closes the previous transport and stale leaves cannot clear its successor', async () => {
  const { manager, rooms, observed } = setup();
  const first = await manager.consumePlatformReservation(reservation);
  const second = await manager.consumePlatformReservation(reservation);
  assert.equal(rooms[0]!.leaveCount, 1);
  rooms[0]!.leave();
  assert.equal(manager.getRoom(), second);
  manager.leave(); manager.leave();
  assert.equal(rooms[1]!.leaveCount, 1);
  assert.equal(manager.getRoom(), null);
  assert.deepEqual(observed, [first, second, null]);
});

test('disposing during reservation consumption closes a late transport without claiming it', async () => {
  const { manager, client, rooms, observed } = setup();
  let finish!: (room: FakeRoom) => void;
  client.consumeSeatReservation = () => new Promise(resolve => { finish = resolve; });
  const joining = manager.consumePlatformReservation(reservation);
  manager.leave(); finish(rooms[0]!);
  await assert.rejects(joining, /cancelled/);
  assert.equal(rooms[0]!.leaveCount, 1);
  assert.equal(manager.getRoom(), null);
  assert.deepEqual(observed, []);
});

test('an older overlapping reservation cannot replace the newest room', async () => {
  const { manager, client, rooms } = setup();
  let finish!: (room: FakeRoom) => void;
  client.consumeSeatReservation = () => new Promise(resolve => { finish = resolve; });
  const older = manager.consumePlatformReservation(reservation);
  client.consumeSeatReservation = async () => rooms[1]!;
  const current = await manager.consumePlatformReservation(reservation);
  finish(rooms[0]!);
  await assert.rejects(older, /cancelled/);
  assert.equal(manager.getRoom(), current);
  assert.equal(rooms[0]!.leaveCount, 1);
});

test('rematch disposal never sends another leave packet on a closing transport', async () => {
  const { manager, rooms } = setup();
  await manager.consumePlatformReservation(reservation);
  rooms[0]!.connection.isOpen = false;
  rooms[0]!.leave = () => { rooms[0]!.leaveCount++; throw new Error('WebSocket is already in CLOSING or CLOSED state'); };
  manager.leave(); manager.leave();
  assert.equal(rooms[0]!.leaveCount, 0);
  assert.equal(manager.getRoom(), null);
});

test('a cancelled reservation that already closed is discarded without sending leave', async () => {
  const { manager, client, rooms } = setup();
  let finish!: (room: FakeRoom) => void;
  client.consumeSeatReservation = () => new Promise(resolve => { finish = resolve; });
  const joining = manager.consumePlatformReservation(reservation);
  manager.leave(); rooms[0]!.connection.isOpen = false; finish(rooms[0]!);
  await assert.rejects(joining, /cancelled/);
  assert.equal(rooms[0]!.leaveCount, 0);
  assert.equal(manager.getRoom(), null);
});
