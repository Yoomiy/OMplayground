import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { cpus, availableParallelism } from 'node:os';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../engine/pkg/voxel_engine.js';
import { GameRoom } from '../src/sim/game-room.ts';
import { WorldStore } from '../src/sim/world-store.ts';
import type { AdmittedActor } from '../src/sim/game-room.ts';
import type { RoomCheckpointInput } from '../src/sim/room-checkpoint.ts';
import type { InventoryCheckpoint } from '../src/sim/inventory.ts';
import type { DropsCheckpoint } from '../src/sim/drops.ts';
import type { Cell, ServerMessage } from '../src/shared/protocol.ts';
import { inBounds } from '../src/shared/protocol.ts';
import { makeStack } from '../src/shared/inventory.ts';
import type { InventoryCommand, Slot } from '../src/shared/inventory.ts';
import { NEUTRAL } from '../src/shared/input.ts';
import { CheckpointStorage } from '../src/server/checkpoint-storage.ts';
import { MemoryCheckpoints } from '../tests/fixtures/checkpoint-storage.ts';
import { developmentAdmission } from './development-admission.ts';
import { containedWindows } from './benchmark-windows.ts';
import { SurvivalPeer } from './survival-peer.ts';
import type { Action } from './survival-peer.ts';

const runtime = await loadServerRelease(),
  { build, content } = runtime;
const seconds = Number(process.env.VOXEL_SURVIVAL_SECONDS ?? 180),
  roomCount = Number(process.env.VOXEL_SURVIVAL_ROOMS ?? 2),
  playerCount = Number(process.env.VOXEL_SURVIVAL_PLAYERS ?? 8),
  ioMs = Number(process.env.VOXEL_SURVIVAL_IO_MS ?? 5);
assert(Number.isFinite(seconds) && seconds >= 10);
assert(Number.isSafeInteger(roomCount) && roomCount > 0);
assert(
  Number.isSafeInteger(playerCount) && playerCount >= 2 && playerCount % 2 === 0,
  'paired workload needs an even player count',
);
assert(Number.isFinite(ioMs) && ioMs >= 0);
const destination = new URL('../test-results/survival-workers.json', import.meta.url);
const items = new Map(content.items.map((i) => [i.itemType, i]));
const block = (name: string) => {
  const id = content.blocks.findIndex((b) => b.name === name && b.state === '');
  assert(id > 0, name);
  return id;
};
const stone = block('stone'),
  cobble = block('cobblestone'),
  chest = block('chest');
initSync({ module: fs.readFileSync(new URL('../dist-server/engine.wasm', import.meta.url)) });
set_content(JSON.stringify(content));
const backend = new MemoryCheckpoints(),
  clockStart = performance.now();
Object.defineProperty(backend, 'now', { get: () => performance.now() - clockStart });
const objects = {
  put: async (...args: Parameters<MemoryCheckpoints['put']>) => {
    await delay(ioMs);
    return backend.put(...args);
  },
  get: async (...args: Parameters<MemoryCheckpoints['get']>) => {
    await delay(ioMs);
    return backend.get(...args);
  },
};
type Site = {
  id: string;
  actor: AdmittedActor;
  spawn: readonly [number, number, number];
  mine: Cell;
  chest: Cell;
};
type Group = {
  room: string;
  sites: Site[];
  peers: SurvivalPeer[];
  storage: CheckpointStorage;
  lastCommit: number;
  committedTick: number;
  maxLagSeconds: number;
  checks: number;
};
const groups: Group[] = [],
  allPeers: SurvivalPeer[] = [],
  policy = new Map<string, 'playing' | 'paused'>(),
  metrics: Record<string, string | number | boolean>[] = [],
  events: { name: string; context: Record<string, string | number | boolean> }[] = [];
let phase = 'prepare',
  inputTimer: ReturnType<typeof setInterval> | undefined,
  monitor: ReturnType<typeof setInterval> | undefined,
  monitoring = false,
  monitorError: Error | null = null;
const counts = {
  rounds: 0,
  mined: 0,
  placed: 0,
  crafted: 0,
  consumed: 0,
  containerRaces: 0,
  containerConflicts: 0,
  cachedReplays: 0,
  hits: 0,
  staleEpochReplays: 0,
  skippedInputBatches: 0,
};
const lastCraft = new Map<string, Action>();
const report: Record<string, unknown> = {
  result: 'RUNNING',
  startedAt: new Date().toISOString(),
  buildId: build.buildId,
  configuration: { seconds, roomCount, playerCount, ioMs },
  host: {
    node: process.version,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    availableParallelism: availableParallelism(),
  },
  scope:
    'Packaged gateway/native workers, UUID actors, ordinary survival inputs/actions, fixture-owned kits and prepared natural-world work platforms, contested containers and commit/worker-crash recovery. Delayed in-memory metadata/object contract backend with advancing clock; no actual Supabase/Auth/SQL/Storage/SFU, rendering, real devices/networks, TNT or school-capacity signoff.',
};
const sum = (slots: readonly Slot[], item: string) =>
  slots.reduce((n, s) => n + (s?.itemType === item ? s.count : 0), 0);
function tokens(snapshot: RoomCheckpointInput) {
  const inventory = snapshot.inventories as InventoryCheckpoint,
    drops = snapshot.drops as DropsCheckpoint;
  return (
    inventory.players.reduce(
      (n, p) => n + sum([...p.bag, ...p.craft2, ...p.craft3, ...p.equipment], 'iron_ingot'),
      0,
    ) +
    inventory.chests.reduce((n, c) => n + sum(c.slots, 'iron_ingot'), 0) +
    drops.entries.reduce((n, d) => n + (d.stack.itemType === 'iron_ingot' ? d.stack.count : 0), 0)
  );
}
function assertTokens(snapshot: RoomCheckpointInput) {
  assert.equal(
    tokens(snapshot),
    31 * playerCount,
    'owned token conservation across bags/crafting/chests/drops',
  );
}
async function eventually(check: () => boolean, label: string, ms = 10000) {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw Error('timeout: ' + label);
    await delay(20);
  }
}
async function seed(roomId: string): Promise<Group> {
  const pairColumns = Math.ceil(Math.sqrt(playerCount / 2)),
    pairRows = Math.ceil(playerCount / 2 / pairColumns),
    sites: Site[] = [];
  for (let i = 0; i < playerCount; i++) {
    const pair = Math.floor(i / 2),
      x = (pair % pairColumns) * 12 - Math.floor((pairColumns * 12) / 2) + (i % 2) * 6,
      z = Math.floor(pair / pairColumns) * 10 - Math.floor((pairRows * 10) / 2),
      id = randomUUID();
    const actor: AdmittedActor = {
      id,
      role: 'participant',
      capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
    };
    assert(inBounds(x, 160, z), 'work site must fit the configured world');
    sites.push({
      id,
      actor,
      spawn: [x + 0.5, 160, z + 0.5],
      mine: [x, 160, z - 2],
      chest: [x - (i % 2) * 6 + 3, 160, z - 2],
    });
  }
  const lease = (await backend.acquire(roomId, 'fixture-seed'))!,
    store = new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
    room = new GameRoom(
      store,
      content,
      build,
      { send() {}, close() {} },
      lease.worldId,
      4242,
      0,
      0,
      'survival',
    );
  try {
    for (const s of sites) room.join(s.actor, s.id, 0);
    for (const s of sites) {
      const a = room.actors.get(s.id)!,
        p = store.world.player_state(a.slot);
      p[0] = s.spawn[0];
      p[1] = s.spawn[1];
      p[2] = s.spawn[2];
      store.world.player_restore(a.slot, p);
      a.vitals.effort(16);
      a.vitals.damage(4);
      for (const [name, n] of [
        ['stone_pickaxe', 1],
        ['oak_log', 64],
        ['iron_ingot', 31],
        ['apple', 16],
      ] as const)
        assert.equal(room.inventories.receive(s.id, makeStack(items.get(name)!, n)), n);
    }
    store.require(sites.map((s) => s.spawn));
    while (store.generateOne()) {}
    const xs = sites.map((s) => s.mine[0]),
      zs = sites.map((s) => s.mine[2]);
    for (let x = Math.min(...xs) - 5; x <= Math.max(...xs) + 5; x++)
      for (let z = Math.min(...zs) - 5; z <= Math.max(...zs) + 8; z++) {
        assert(inBounds(x, 159, z), 'fixture platform must fit the world');
        store.set(x, 159, z, stone);
        for (let y = 160; y <= 163; y++) store.set(x, y, z, 0);
      }
    for (const s of sites) {
      store.set(...s.mine, cobble);
      store.set(...s.chest, chest);
    }
    const snapshot = { ...room.checkpoint(0), spawn: sites[0].spawn };
    assertTokens(snapshot);
    const storage = new CheckpointStorage(lease.worldId, objects, backend, content, build);
    await storage.save(lease, 1, snapshot);
    await backend.release(lease);
    policy.set(roomId, 'playing');
    return {
      room: roomId,
      sites,
      peers: [],
      storage,
      lastCommit: 1,
      committedTick: 0,
      maxLagSeconds: 0,
      checks: 0,
    };
  } finally {
    room.dispose();
  }
}
function create() {
  return runtime.createGateway({
    build,
    content,
    persistence: {
      objects,
      metadata: backend,
      resolveOwner: async (room, id) =>
        groups.find((g) => g.room === room)?.sites.find((s) => s.id === id)?.actor ?? null,
    },
    roomPolicy: async (room) => ({
      state: policy.get(room) ?? 'paused',
      expiresAt: Date.now() + 5000,
    }),
    admit: async (req, body) => {
      const actor = groups
        .find((g) => g.room === body.room)
        ?.sites.find((s) => s.id === String(req.headers['x-workload-actor']))?.actor;
      return actor ? developmentAdmission(actor) : null;
    },
    onEvent(name, context) {
      if (name === 'VOXEL_ROOM_METRICS') metrics.push(context);
      else if (/FAILED|FAULT|OVERFLOW|RECOVER/.test(name)) events.push({ name, context });
    },
  });
}
let gateway: Awaited<ReturnType<typeof create>> | undefined;
async function connect(group: Group, activate = true) {
  assert(gateway);
  const address = gateway.address;
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const peers = await Promise.all(
    group.sites.map(async (s) => {
      const response = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workload-actor': s.id },
        body: JSON.stringify({ room: group.room }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as { ticket: string; buildId: string };
      const p = new SurvivalPeer(
        s.id,
        origin.replace(/^http/, 'ws') + '/voxel',
        content.blocks.length,
      );
      allPeers.push(p);
      await once(p.socket, 'open');
      p.send({ type: 'hello', ...ticket });
      await p.until(() => !!p.welcome && !!p.inventory && !!p.vitals && !!p.baseline, 'join views');
      if (activate) await p.ready();
      return p;
    }),
  );
  group.peers = peers;
  return peers;
}
function startInputs() {
  if (inputTimer) clearInterval(inputTimer);
  const start = performance.now();
  let last = -1;
  inputTimer = setInterval(() => {
    const ordinal = Math.floor(((performance.now() - start) * 30) / 1000);
    if (ordinal <= last) return;
    counts.skippedInputBatches += Math.max(0, ordinal - last - 1);
    last = ordinal;
    for (const g of groups) for (const p of g.peers) p.batch();
  }, 4);
}
async function inventory(p: SurvivalPeer, operation: InventoryCommand) {
  return p.request((epoch, sequence) => ({ type: 'inventory', epoch, sequence, operation }));
}
function ok(r: Awaited<ReturnType<SurvivalPeer['request']>>) {
  assert.equal(r.result.outcome?.ok, true, JSON.stringify(r.result));
  return r;
}
async function select(p: SurvivalPeer, item: string) {
  let slot = p.view().bag.findIndex((s) => s?.itemType === item);
  assert(slot >= 0, `owned ${item}`);
  if (slot > 8) {
    ok(
      await inventory(p, {
        kind: 'move',
        from: { area: 'bag', slot },
        to: { area: 'bag', slot: 8 },
        count: p.view().bag[slot]!.count,
        revision: p.view().revision,
        containerId: null,
        containerRevision: null,
      }),
    );
    slot = 8;
  }
  ok(await inventory(p, { kind: 'select', slot, revision: p.view().revision }));
  return slot;
}
async function go(
  p: SurvivalPeer,
  point: readonly number[],
  done = () => Math.hypot(p.body[0] - point[0], p.body[2] - point[2]) < 0.22,
) {
  const end = performance.now() + 7000;
  try {
    while (!done()) {
      if (p.error) throw p.error;
      if (performance.now() > end)
        throw Error(
          `movement timeout ${p.id}: ${JSON.stringify({ body: p.body.slice(0, 3), point })}`,
        );
      p.controls = {
        ...NEUTRAL,
        yaw: Math.atan2(point[0] - p.body[0], -(point[2] - p.body[2])),
        z: -1,
      };
      await delay(25);
    }
  } finally {
    p.controls = { ...NEUTRAL };
  }
  await delay(100);
}
async function mineAndPlace(p: SurvivalPeer, s: Site) {
  await go(p, s.spawn);
  await select(p, 'stone_pickaxe');
  await p.aim([s.mine[0] + 0.5, s.mine[1] + 0.5, s.mine[2] + 0.5]);
  const before = sum(p.view().bag, 'cobblestone');
  for (let n = 0; ; n++) {
    const r = await p.request((epoch, sequence) => ({
      type: 'mining',
      epoch,
      sequence,
      inputSequence: p.ack,
      target: s.mine,
      revision: p.revision(s.mine),
      inventoryRevision: p.view().revision,
    }));
    if (r.result.outcome?.ok) break;
    assert(n < 5 && r.result.outcome?.reason === 'conflict', JSON.stringify(r.result));
    await delay(80);
  }
  await p.until(() => p.cell(s.mine) === 0, 'mining patch');
  counts.mined++;
  await go(
    p,
    [s.mine[0] + 0.5, 160, s.mine[2] + 0.5],
    () => sum(p.view().bag, 'cobblestone') === before + 1,
  );
  await go(p, s.spawn);
  await select(p, 'cobblestone');
  const floor: Cell = [s.mine[0], 159, s.mine[2]];
  for (let n = 0; ; n++) {
    await p.aim([floor[0] + 0.5, floor[1] + 0.999, floor[2] + 0.5]);
    const r = await p.request((epoch, sequence) => ({
      type: 'action',
      kind: 'place',
      epoch,
      sequence,
      inputSequence: p.ack,
      target: floor,
      state: cobble,
      inventoryRevision: p.view().revision,
      revisions: [{ x: floor[0] >> 4, z: floor[2] >> 4, revision: p.revision(floor) }],
    }));
    if (r.result.outcome?.ok) break;
    assert(n < 5 && r.result.outcome?.reason === 'conflict', JSON.stringify(r.result));
    await delay(80);
  }
  await p.until(() => p.cell(s.mine) === cobble, 'placed patch');
  assert.equal(sum(p.view().bag, 'cobblestone'), before);
  counts.placed++;
}
async function craft(p: SurvivalPeer) {
  const slot = p.view().bag.findIndex((s) => s?.itemType === 'oak_log');
  if (slot < 0) return;
  const before = sum(p.view().bag, 'oak_planks');
  ok(
    await inventory(p, {
      kind: 'move',
      from: { area: 'bag', slot },
      to: { area: 'craft2', slot: 3 },
      count: 1,
      revision: p.view().revision,
      containerId: null,
      containerRevision: null,
    }),
  );
  const r = ok(
    await inventory(p, { kind: 'craft', grid: 2, count: 1, revision: p.view().revision }),
  );
  lastCraft.set(p.id, r.message);
  assert.equal(sum(p.view().bag, 'oak_planks'), before + 4);
  const revision = p.view().revision;
  const replay = await p.transact(r.message);
  assert.equal(replay.result.status, 'cached');
  assert.equal(p.view().revision, revision);
  counts.crafted++;
  counts.cachedReplays++;
}
async function race(a: SurvivalPeer, b: SurvivalPeer, cell: Cell) {
  await Promise.all(
    [a, b].map(async (p) => {
      await p.aim([cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5]);
      ok(await inventory(p, { kind: 'open', target: cell }));
    }),
  );
  const donor = sum(a.view().bag, 'iron_ingot') >= sum(b.view().bag, 'iron_ingot') ? a : b,
    v = donor.view(),
    slot = v.bag.findIndex((s) => s?.itemType === 'iron_ingot');
  assert(slot >= 0 && v.container && v.container.slots[0] === null);
  ok(
    await inventory(donor, {
      kind: 'move',
      from: { area: 'bag', slot },
      to: { area: 'container', slot: 0 },
      count: 1,
      revision: v.revision,
      containerId: v.container.id,
      containerRevision: v.container.revision,
    }),
  );
  await Promise.all(
    [a, b].map((p) =>
      p.until(() => p.view().container?.slots[0]?.itemType === 'iron_ingot', 'shared deposit'),
    ),
  );
  const revision = a.view().container!.revision;
  assert.equal(b.view().container!.revision, revision);
  const result = await Promise.all(
    [a, b].map((p) => {
      const v = p.view(),
        to = v.bag.findIndex((s) => s?.itemType === 'iron_ingot');
      assert(to >= 0);
      return inventory(p, {
        kind: 'move',
        from: { area: 'container', slot: 0 },
        to: { area: 'bag', slot: to },
        count: 1,
        revision: v.revision,
        containerId: v.container!.id,
        containerRevision: revision,
      });
    }),
  );
  assert.equal(result.filter((r) => r.result.outcome?.ok).length, 1);
  assert.equal(result.filter((r) => r.result.outcome?.reason === 'conflict').length, 1);
  const index = result.findIndex((r) => r.result.outcome?.ok),
    winner = [a, b][index],
    before = sum(winner.view().bag, 'iron_ingot');
  assert.equal((await winner.transact(result[index].message)).result.status, 'cached');
  assert.equal(sum(winner.view().bag, 'iron_ingot'), before);
  counts.cachedReplays++;
  counts.containerRaces++;
  counts.containerConflicts++;
  await Promise.all(
    [a, b].map(async (p) => {
      ok(await inventory(p, { kind: 'close' }));
    }),
  );
}
async function fight(a: SurvivalPeer, b: SurvivalPeer, round: number, as: Site, bs: Site) {
  const attacker = round % 2 ? a : b,
    target = round % 2 ? b : a;
  if (!target.vitals || target.vitals.health <= 8) return;
  const slot = attacker
    .view()
    .bag.findIndex(
      (s, i) =>
        i < 9 &&
        (s === null ||
          s.itemType === 'oak_log' ||
          s.itemType === 'oak_planks' ||
          s.itemType === 'iron_ingot'),
    );
  assert(slot >= 0);
  ok(await inventory(attacker, { kind: 'select', slot, revision: attacker.view().revision }));
  const direction = attacker.body[0] < target.body[0] ? -1 : 1;
  await go(attacker, [target.body[0] + direction * 2.4, 160, target.body[2]]);
  await attacker.aim([target.body[0], target.body[1] + 0.9, target.body[2]]);
  const r = await attacker.request((epoch, sequence) => ({
    type: 'attack',
    epoch,
    sequence,
    inputSequence: attacker.ack,
    inventoryRevision: attacker.view().revision,
  }));
  ok(r);
  assert.equal(r.result.outcome?.reason, 'hit');
  counts.hits++;
  await Promise.all([go(a, as.spawn), go(b, bs.spawn)]);
}
async function consume(p: SurvivalPeer) {
  if (!p.vitals || p.vitals.food >= 20) return;
  const slot = p.view().bag.findIndex((s) => s?.itemType === 'apple');
  if (slot < 0) return;
  const r = await inventory(p, { kind: 'consume', slot, revision: p.view().revision });
  if (r.result.outcome?.ok) counts.consumed++;
  else
    assert(['full', 'cooldown'].includes(r.result.outcome?.reason ?? ''), JSON.stringify(r.result));
}
async function scan() {
  if (monitoring) return;
  monitoring = true;
  try {
    for (const g of groups) {
      const pointer = backend.rows.get(g.room)!.checkpoint;
      if (pointer && pointer.sequence !== g.lastCommit) {
        const snapshot = await g.storage.load(pointer);
        assertTokens(snapshot);
        g.lastCommit = pointer.sequence;
        g.committedTick = snapshot.tick;
        g.checks++;
      }
      const live = Math.max(...g.peers.map((p) => p.tick));
      g.maxLagSeconds = Math.max(g.maxLagSeconds, Math.max(0, live - g.committedTick) / 30);
    }
  } finally {
    monitoring = false;
  }
}
function checkHealth() {
  if (monitorError) throw monitorError;
  for (const p of groups.flatMap((g) => g.peers)) {
    if (p.error) throw p.error;
    assert(!p.closed, 'live client');
    assert(!p.vitals?.dead, 'survival worker remains alive during mixed activity');
  }
}
async function snapshot(g: Group, pause: boolean) {
  assert(gateway);
  const pointer = await gateway.save(g.room, pause),
    saved = await g.storage.load(pointer);
  assertTokens(saved);
  return saved;
}

try {
  for (let i = 0; i < roomCount; i++) groups.push(await seed(randomUUID()));
  gateway = await create();
  await Promise.all(groups.map((g) => connect(g)));
  startInputs();
  phase = 'load';
  const started = performance.now();
  monitor = setInterval(
    () =>
      void scan().catch((e) => {
        monitorError = e as Error;
      }),
    500,
  );
  while (performance.now() - started < seconds * 1000) {
    checkHealth();
    await Promise.all(groups.flatMap((g) => g.peers.map((p, i) => mineAndPlace(p, g.sites[i]))));
    await Promise.all(groups.flatMap((g) => g.peers.map(craft)));
    await Promise.all(
      groups.flatMap((g) =>
        g.peers.flatMap((p, i) => (i % 2 ? [] : [race(p, g.peers[i + 1], g.sites[i].chest)])),
      ),
    );
    await Promise.all(groups.flatMap((g) => g.peers.map(consume)));
    await Promise.all(
      groups.flatMap((g) =>
        g.peers.flatMap((p, i) =>
          i % 2 ? [] : [fight(p, g.peers[i + 1], counts.rounds, g.sites[i], g.sites[i + 1])],
        ),
      ),
    );
    counts.rounds++;
    checkHealth();
    await scan();
    console.log(
      JSON.stringify({
        phase: 'round',
        round: counts.rounds,
        elapsedSeconds: (performance.now() - started) / 1000,
        ...counts,
      }),
    );
  }
  const samplingEnd = performance.now();
  clearInterval(monitor);
  monitor = undefined;
  await eventually(() => !monitoring, 'monitor idle');
  await scan();
  report.sample = {
    startedAtMs: started,
    endedAtMs: samplingEnd,
    elapsedMs: samplingEnd - started,
  };
  const saved = await Promise.all(
    groups.map(async (g) => {
      policy.set(g.room, 'paused');
      return snapshot(g, true);
    }),
  );
  clearInterval(inputTimer);
  inputTimer = undefined;
  for (const p of groups.flatMap((g) => g.peers)) {
    p.enabled = false;
    p.stopping = true;
  }
  const oldEpochs = groups.map((g) => g.peers.map((p) => p.epoch));
  phase = 'crash';
  await Promise.all([...gateway.rooms.values()].map((h) => h.worker.terminate()));
  await eventually(
    () => gateway!.rooms.size === 0 && groups.every((g) => g.peers.every((p) => p.closed)),
    'crash cleanup',
  );
  await eventually(
    () => groups.every((g) => backend.rows.get(g.room)!.deadline <= backend.now),
    'lease release',
  );
  await gateway.close();
  gateway = await create();
  phase = 'restore';
  await Promise.all(groups.map((g) => connect(g, false)));
  for (let r = 0; r < groups.length; r++) {
    const g = groups[r],
      checkpoint = saved[r],
      own = checkpoint.inventories as InventoryCheckpoint;
    for (let i = 0; i < g.peers.length; i++) {
      const p = g.peers[i],
        expected = own.players.find((a) => a.id === p.id)!;
      assert.equal(p.welcome!.worldId, checkpoint.worldId);
      assert(p.epoch > oldEpochs[r][i]);
      assert.equal(p.welcome!.tick, checkpoint.tick);
      assert.deepEqual(p.view().bag, expected.bag);
      assert.equal(p.view().revision, expected.revision);
      assert.equal(p.vitals?.health, checkpoint.players.find((a) => a.id === p.id)!.vitals.health);
      const replay = lastCraft.get(p.id);
      if (replay) {
        const before = JSON.stringify(p.view().bag);
        assert.equal((await p.transact(replay)).result.status, 'stale_epoch');
        assert.equal(JSON.stringify(p.view().bag), before);
        counts.staleEpochReplays++;
      }
    }
  }
  for (const g of groups) {
    policy.set(g.room, 'playing');
    gateway.resume(g.room);
  }
  await Promise.all(groups.flatMap((g) => g.peers.map((p) => p.ready())));
  startInputs();
  await Promise.all(groups.map((g) => craft(g.peers[0])));
  for (const g of groups) policy.set(g.room, 'paused');
  await Promise.all(groups.map((g) => snapshot(g, true)));
  clearInterval(inputTimer);
  inputTimer = undefined;
  for (const p of groups.flatMap((g) => g.peers)) p.stopping = true;
  await gateway.close();
  assert.equal(gateway.rooms.size, 0);
  gateway = undefined;
  phase = 'complete';
  assert(
    counts.rounds > 0 &&
      counts.mined > 0 &&
      counts.placed === counts.mined &&
      counts.crafted > 0 &&
      counts.containerConflicts > 0 &&
      counts.hits > 0 &&
      counts.consumed > 0 &&
      counts.staleEpochReplays > 0,
  );
  assert.equal(
    events.filter((e) => e.name !== 'VOXEL_ROOM_FAILED').length,
    0,
    JSON.stringify(events),
  );
  const steady = containedWindows(
    metrics as (Record<string, string | number | boolean> & {
      windowMs: number;
      windowStartedAtMs?: number;
      windowEndedAtMs?: number;
    })[],
    started,
    samplingEnd,
  );
  if (seconds >= 25) assert.equal(new Set(steady.map((m) => m.worldId)).size, roomCount);
  if (seconds >= 30)
    for (const g of groups) assert(g.checks > 0 && g.maxLagSeconds <= 30, 'healthy durable lag');
  report.result = 'PACKAGED_SUSTAINED_SURVIVAL_AND_COMMITTED_CRASH_RECOVERY_PASS';
  report.counts = counts;
  report.roomMetrics = metrics;
  report.steadyRoomMetrics = steady;
  report.events = events;
  report.rooms = groups.map((g) => ({
    room: g.room,
    worldId: backend.rows.get(g.room)!.worldId,
    ownerEpoch: backend.rows.get(g.room)!.epoch,
    checkpointSequence: backend.rows.get(g.room)!.sequence,
    readbackChecks: g.checks,
    maxDurableLagSeconds: g.maxLagSeconds,
  }));
} catch (e) {
  report.result = 'FAIL';
  report.failure = {
    phase,
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  };
  throw e;
} finally {
  if (inputTimer) clearInterval(inputTimer);
  if (monitor) clearInterval(monitor);
  for (const p of allPeers) {
    p.stopping = true;
    p.socket.terminate();
  }
  await gateway?.close();
  await eventually(() => allPeers.every((p) => p.closed), 'client cleanup');
  report.finishedAt = new Date().toISOString();
  report.peers = allPeers.map((p) => p.summary());
  report.cleanup = {
    rooms: gateway?.rooms.size ?? 0,
    closedClients: allPeers.filter((p) => p.closed).length,
    totalClients: allPeers.length,
    pendingWaiters: allPeers.reduce((n, p) => n + p.listeners.size, 0),
  };
  report.storage = {
    objects: backend.objects.size,
    bytes: [...backend.objects.values()].reduce((n, b) => n + b.byteLength, 0),
    puts: backend.puts.length,
    commits: backend.commits.length,
  };
  fs.mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, counts, cleanup: report.cleanup }));
}
