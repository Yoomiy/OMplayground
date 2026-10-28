import { developmentAdmission } from '../../tools/development-admission.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
import { parseServerMessage, around } from '../../src/shared/protocol.ts';
import type {
  ClientMessage,
  ServerMessage,
  BuildIdentity,
  Cell,
} from '../../src/shared/protocol.ts';
import { decodeChunk, worldCell, localIndex } from '../../src/shared/chunk-wire.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
import type { ContentManifest } from '../../src/shared/content.ts';
import type { InventoryCommand, InventoryView } from '../../src/shared/inventory.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import { stepBoundedMovement } from '../../src/shared/movement.ts';
import type { MovementModifiers } from '../../src/shared/movement.ts';
import { DAY_TICKS, ENVIRONMENT_VERSION, sampleEnvironment } from '../../src/shared/environment.ts';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../../engine/pkg/voxel_engine.js';
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
) as BuildIdentity;
const content = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
) as ContentManifest;
initSync({
  module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
});
set_content(JSON.stringify(content));
class Probe {
  socket: WebSocket;
  events: (ServerMessage | ChunkFrame)[] = [];
  listeners = new Set<() => void>();
  columns = new Map<string, ChunkFrame>();
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on('error', () => {});
    this.socket.on('message', (raw, binary) => {
      const event = binary
        ? decodeChunk(new Uint8Array(raw as Buffer), content.blocks.length)
        : parseServerMessage(raw.toString());
      assert.ok(event);
      this.events.push(event);
      if ('kind' in event) this.columns.set(`${event.x},${event.z}`, event);
      for (const f of this.listeners) f();
    });
  }
  send(m: ClientMessage) {
    this.socket.send(JSON.stringify(m));
  }
  wait<T extends ServerMessage | ChunkFrame>(
    predicate: (e: ServerMessage | ChunkFrame) => e is T,
    after = 0,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = this.events.slice(after).find(predicate);
        if (found) {
          clearTimeout(timer);
          this.listeners.delete(check);
          resolve(found as T);
        }
      };
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        reject(new Error('probe event timeout'));
      }, 10000);
      this.listeners.add(check);
      check();
    });
  }
  async ready() {
    const preparing = await this.wait(
      (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in e && e.type === 'baseline' && e.reason === 'join',
    );
    const columns = around(
      Math.floor(preparing.state[0] / 16),
      Math.floor(preparing.state[2] / 16),
      1,
    ).map((p) => ({ ...p, revision: this.columns.get(`${p.x},${p.z}`)!.revision }));
    this.send({ type: 'ready', epoch: preparing.epoch, columns });
    const playing = await this.wait(
      (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in e && e.type === 'baseline' && e.reason === 'ready',
    );
    this.send({ type: 'focus', epoch: playing.epoch, active: true });
    return this.wait(
      (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in e && e.type === 'baseline' && e.reason === 'focus' && e.state[12] === 0,
    );
  }
}
test(
  'survival gateway mines natural terrain on room time, replicates a real drop and picks it into a private owned hotbar',
  { timeout: 20000 },
  async () => {
    const gateway = await createGateway({
      build,
      content,
      worldDefaults: { mode: 'survival' },
      admit: async () =>
        developmentAdmission({
          id: 'survivor',
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        }),
    });
    const address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`,
      probe = new Probe(`ws://127.0.0.1:${address.port}/voxel`),
      world = new VoxelWorld(),
      generator = new TerrainGen(4242);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const response = await fetch(`${origin}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'survival' }),
      });
      const ticket = (await response.json()) as { ticket: string; buildId: string };
      if (probe.socket.readyState !== WebSocket.OPEN) await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...ticket });
      const baseline = await probe.ready(),
        welcome = await probe.wait(
          (e): e is Extract<ServerMessage, { type: 'welcome' }> =>
            'type' in e && e.type === 'welcome',
        );
      assert.equal(welcome.mode, 'survival');
      const view = () => {
        const event = probe.events.findLast(
          (e): e is Extract<ServerMessage, { type: 'inventory' }> =>
            'type' in e && e.type === 'inventory',
        );
        assert.ok(event);
        return event.view;
      };
      assert.equal(view().catalog, false);
      assert.ok(view().bag.every((stack) => stack === null));
      let action = 0;
      const result = async (message: ClientMessage) => {
        const at = probe.events.length;
        probe.send(message);
        return probe.wait(
          (e): e is Extract<ServerMessage, { type: 'result' }> =>
            'type' in e && e.type === 'result' && e.sequence === action,
          at,
        );
      };
      assert.equal(
        (
          await result({
            type: 'inventory',
            epoch: baseline.epoch,
            sequence: ++action,
            operation: { kind: 'give', itemType: 'stone', count: 64, revision: 0 },
          })
        ).outcome?.reason,
        'forbidden',
      );
      assert.equal(
        (await result({ type: 'flight', epoch: baseline.epoch, sequence: ++action, on: true }))
          .outcome?.reason,
        'forbidden',
      );
      for (const frame of probe.columns.values())
        world.insert_column(frame.x, frame.z, generator.generate(frame.x, frame.z));
      const p = baseline.state;
      let selection: { target: Cell; yaw: number; pitch: number; distance: number } | null = null;
      for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI])
        for (const pitch of [-0.7, -0.9, -1.1, 0]) {
          const hit = world.raycast(
            p[0],
            p[1] + 1.62,
            p[2],
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch),
            6,
          );
          if (!hit[0]) continue;
          const block = content.blocks[world.get_block(hit[1], hit[2], hit[3])],
            rule = content.behavior.find((b) => b.family === block?.name);
          const distance = Math.hypot(hit[1] + 0.5 - p[0], hit[3] + 0.5 - p[2]);
          if (
            rule?.drops.length &&
            !rule.mining.requiresTool &&
            block.breakable !== false &&
            distance > 0.8 &&
            (!selection || distance < selection.distance)
          )
            selection = { target: [hit[1], hit[2], hit[3]], yaw, pitch, distance };
        }
      assert.ok(selection);
      let input = 0,
        controls = { ...NEUTRAL, yaw: selection.yaw, pitch: selection.pitch };
      timer = setInterval(() => {
        if (probe.socket.readyState === WebSocket.OPEN)
          probe.send({
            type: 'input',
            frames: [{ ...controls, epoch: baseline.epoch, sequence: ++input }],
          });
      }, 1000 / 60);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dependency = input,
        at = probe.events.length;
      const start = await result({
        type: 'mining',
        epoch: baseline.epoch,
        sequence: ++action,
        inputSequence: dependency,
        target: selection.target,
        revision: probe.columns.get(`${selection.target[0] >> 4},${selection.target[2] >> 4}`)!
          .revision,
        inventoryRevision: 0,
      });
      assert.equal(start.outcome?.ok, true, JSON.stringify(start));
      const mining = await probe.wait(
        (e): e is Extract<ServerMessage, { type: 'mining' }> =>
          'type' in e && e.type === 'mining' && e.target !== null,
        at,
      );
      assert.equal(mining.elapsed, 0);
      assert.ok(mining.total >= 1);
      const patch = await probe.wait(
        (e): e is ChunkFrame =>
          'kind' in e &&
          e.kind === 'patch' &&
          e.edits.some(
            ([index, state]) =>
              state === 0 && worldCell(e.x, e.z, index).every((n, i) => n === selection!.target[i]),
          ),
        at,
      );
      assert.ok(patch.revision > 0);
      const visible = await probe.wait(
        (e): e is Extract<ServerMessage, { type: 'drops' }> =>
          'type' in e && e.type === 'drops' && e.upsert.length > 0,
        at,
      );
      const drop = visible.upsert[0];
      assert.equal(drop.stack.count, 1);
      const deadline = performance.now() + 6000;
      while (
        !view().bag.some((stack) => stack?.itemType === drop.stack.itemType) &&
        performance.now() < deadline
      ) {
        const snapshot = probe.events.findLast(
          (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
            'type' in e && e.type === 'snapshot' && !!e.self,
        );
        const state = snapshot!.self!.state,
          dx = drop.position[0] - state[0],
          dz = drop.position[2] - state[2];
        controls = { ...NEUTRAL, yaw: Math.atan2(dx, -dz), z: Math.hypot(dx, dz) > 0.35 ? -1 : 0 };
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      controls = { ...NEUTRAL };
      assert.equal(
        view().bag.reduce(
          (sum, stack) => sum + (stack?.itemType === drop.stack.itemType ? stack.count : 0),
          0,
        ),
        1,
      );
      await probe.wait(
        (e): e is Extract<ServerMessage, { type: 'drops' }> =>
          'type' in e && e.type === 'drops' && e.removed.includes(drop.id),
        at,
      );
    } finally {
      if (timer) clearInterval(timer);
      probe.socket.terminate();
      world.free();
      generator.free();
      await gateway.close();
    }
  },
);
test(
  'real inventory commands craft once across cache eviction/reconnect and shared chest withdrawals cannot duplicate',
  { timeout: 30000 },
  async () => {
    const gateway = await createGateway({
      build,
      content,
      admit: async (req) => {
        const id = String(req.headers['x-test-actor']);
        return developmentAdmission({
          id,
          role: id === 'observer' ? 'observer' : 'participant',
          capabilities: {
            build: id !== 'blocked',
            fly: true,
            observe: id === 'observer',
            combat: id !== 'blocked' && id !== 'observer',
            explosives: id !== 'blocked' && id !== 'observer',
          },
        });
      },
    });
    const address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`,
      probes: Probe[] = [];
    const join = async (id: string) => {
      const response = await fetch(`${origin}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'inventory' }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as { ticket: string; buildId: string },
        probe = new Probe(`ws://127.0.0.1:${address.port}/voxel`);
      probes.push(probe);
      await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...ticket });
      return { probe, baseline: await probe.ready(), sequence: 0 };
    };
    const view = (probe: Probe) => {
      const event = probe.events.findLast(
        (e): e is Extract<ServerMessage, { type: 'inventory' }> =>
          'type' in e && e.type === 'inventory',
      );
      assert.ok(event);
      return event.view;
    };
    const command = async (
      actor: Awaited<ReturnType<typeof join>>,
      operation: InventoryCommand,
      sequence = ++actor.sequence,
      epoch = actor.baseline.epoch,
    ) => {
      const after = actor.probe.events.length;
      actor.probe.send({ type: 'inventory', epoch, sequence, operation });
      const result = await actor.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === sequence,
        after,
      );
      await actor.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'inventory' }> =>
          'type' in e && e.type === 'inventory',
        after,
      );
      return result;
    };
    const world = new VoxelWorld(),
      generator = new TerrainGen(4242);
    try {
      const a = await join('owner'),
        b = await join('peer');
      assert.equal(
        (await command(a, { kind: 'give', itemType: 'oak_log', count: 2, revision: 0 })).outcome
          ?.ok,
        true,
      );
      assert.equal(
        (
          await command(a, {
            kind: 'move',
            from: { area: 'bag', slot: 0 },
            to: { area: 'craft2', slot: 3 },
            count: 2,
            revision: 1,
            containerId: null,
            containerRevision: null,
          })
        ).outcome?.ok,
        true,
      );
      const craft: InventoryCommand = { kind: 'craft', grid: 2, count: 2, revision: 2 };
      assert.equal((await command(a, craft)).outcome?.ok, true);
      assert.equal(view(a.probe).bag[0]?.count, 8);
      assert.equal((await command(a, craft, 3)).status, 'cached');
      assert.equal(view(a.probe).revision, 3);
      for (let sequence = 4; sequence <= 136; sequence++)
        a.probe.send({
          type: 'inventory',
          epoch: a.baseline.epoch,
          sequence,
          operation: { kind: 'craft', grid: 2, count: 1, revision: 3 },
        });
      await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 136,
      );
      a.sequence = 136;
      assert.equal((await command(a, craft, 3)).status, 'retired');
      assert.equal(view(a.probe).bag[0]?.count, 8);
      assert.ok(
        view(b.probe).bag.every((stack) => stack === null),
        'inventory contents are private',
      );
      for (const id of ['blocked', 'observer']) {
        const denied = await join(id);
        assert.equal(view(denied.probe).catalog, false);
        assert.equal(
          (await command(denied, { kind: 'give', itemType: 'stone', count: 64, revision: 0 }))
            .outcome?.reason,
          'forbidden',
        );
      }
      for (const frame of a.probe.columns.values()) {
        world.insert_column(frame.x, frame.z, generator.generate(frame.x, frame.z));
        for (const [local, state] of frame.edits)
          world.mirror_block(...worldCell(frame.x, frame.z, local), state);
      }
      for (const actor of [a, b])
        world.player_add(...(actor.baseline.state.slice(0, 3) as [number, number, number]));
      const chestState = content.blocks.findIndex((block) => block.name === 'chest'),
        p = a.baseline.state;
      let chosen: {
        target: [number, number, number];
        destination: [number, number, number];
        yaw: number;
        pitch: number;
      } | null = null;
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
        for (const pitch of [-0.45, -0.65, -0.85]) {
          const hit = world.raycast(
            p[0],
            p[1] + 1.62,
            p[2],
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch),
            6,
          );
          if (!hit[0]) continue;
          const offset = content.blocks[world.get_block(hit[1], hit[2], hit[3])]?.replaceable
            ? 0
            : 1;
          const x = hit[1] + hit[4] * offset,
            y = hit[2] + hit[5] * offset,
            z = hit[3] + hit[6] * offset;
          const block = content.blocks[world.get_block(x, y, z)];
          if (
            block &&
            (block.shape === 'air' || block.replaceable) &&
            !world.player_overlaps(x, y, z, chestState)
          )
            chosen = { target: [hit[1], hit[2], hit[3]], destination: [x, y, z], yaw, pitch };
          if (chosen) break;
        }
      assert.ok(chosen);
      a.probe.send({
        type: 'input',
        frames: [
          {
            epoch: a.baseline.epoch,
            sequence: 1,
            x: 0,
            z: 0,
            yaw: chosen.yaw,
            pitch: chosen.pitch,
            jump: false,
            sneak: false,
            sprint: false,
          },
        ],
      });
      const placedSequence = ++a.sequence,
        at = a.probe.events.length;
      const revisions = [
        ...new Map(
          [chosen.target, chosen.destination].map((cell) => {
            const x = cell[0] >> 4,
              z = cell[2] >> 4;
            return [`${x},${z}`, { x, z, revision: a.probe.columns.get(`${x},${z}`)!.revision }];
          }),
        ).values(),
      ];
      a.probe.send({
        type: 'action',
        epoch: a.baseline.epoch,
        sequence: placedSequence,
        inputSequence: 1,
        kind: 'place',
        target: chosen.target,
        state: chestState,
        inventoryRevision: 0,
        revisions,
      });
      const placed = await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === placedSequence,
        at,
      );
      assert.equal(placed.outcome?.ok, true, JSON.stringify(placed));
      const cell = placed.outcome!.cell!;
      assert.equal((await command(a, { kind: 'open', target: cell })).outcome?.ok, true);
      assert.equal((await command(b, { kind: 'open', target: cell })).outcome?.ok, true);
      assert.equal(view(a.probe).container!.id, view(b.probe).container!.id);
      const beforeDeposit = view(a.probe);
      assert.equal(
        (
          await command(a, {
            kind: 'move',
            from: { area: 'bag', slot: 0 },
            to: { area: 'container', slot: 0 },
            count: 8,
            revision: beforeDeposit.revision,
            containerId: beforeDeposit.container!.id,
            containerRevision: beforeDeposit.container!.revision,
          })
        ).outcome?.ok,
        true,
      );
      await b.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'inventory' }> =>
          'type' in e && e.type === 'inventory' && e.view.container?.revision === 1,
      );
      const aimX = cell[0] + 0.5 - p[0],
        aimY = cell[1] + 0.5 - p[1] - 1.62,
        aimZ = cell[2] + 0.5 - p[2];
      a.probe.send({
        type: 'input',
        frames: [
          {
            epoch: a.baseline.epoch,
            sequence: 2,
            x: 0,
            z: 0,
            yaw: Math.atan2(aimX, -aimZ),
            pitch: Math.atan2(aimY, Math.hypot(aimX, aimZ)),
            jump: false,
            sneak: false,
            sprint: false,
          },
        ],
      });
      const removeSequence = ++a.sequence,
        removeAt = a.probe.events.length;
      a.probe.send({
        type: 'action',
        epoch: a.baseline.epoch,
        sequence: removeSequence,
        inputSequence: 2,
        kind: 'remove',
        target: cell,
        state: 0,
        inventoryRevision: 0,
        revisions: [
          {
            x: cell[0] >> 4,
            z: cell[2] >> 4,
            revision: a.probe.columns.get(`${cell[0] >> 4},${cell[2] >> 4}`)!.revision,
          },
        ],
      });
      const blockedRemoval = await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === removeSequence,
        removeAt,
      );
      assert.equal(blockedRemoval.outcome?.reason, 'container_not_empty');
      assert.equal(view(a.probe).container!.slots[0]?.count, 8);
      const withdraw = (v: InventoryView): InventoryCommand => ({
        kind: 'move',
        from: { area: 'container', slot: 0 },
        to: { area: 'bag', slot: 0 },
        count: 8,
        revision: v.revision,
        containerId: v.container!.id,
        containerRevision: v.container!.revision,
      });
      const outcomes = await Promise.all([
        command(a, withdraw(view(a.probe))),
        command(b, withdraw(view(b.probe))),
      ]);
      assert.deepEqual(outcomes.map((r) => r.outcome?.reason).sort(), ['conflict', 'move']);
      assert.equal((view(a.probe).bag[0]?.count ?? 0) + (view(b.probe).bag[0]?.count ?? 0), 8);
      assert.equal(view(a.probe).container!.slots[0], null);
      assert.equal(
        (await command(a, { kind: 'open', target: [0, 250, 0] })).outcome?.reason,
        'out_of_reach',
      );
      const beforeReconnect = view(a.probe);
      a.probe.socket.terminate();
      await once(a.probe.socket, 'close');
      const reconnect = await join('owner');
      assert.deepEqual(view(reconnect.probe).bag, beforeReconnect.bag);
      assert.equal(view(reconnect.probe).container, null);
      assert.equal((await command(reconnect, craft, 3, a.baseline.epoch)).status, 'stale_epoch');
      assert.deepEqual(view(reconnect.probe).bag, beforeReconnect.bag);
    } finally {
      for (const probe of probes) probe.socket.terminate();
      world.free();
      generator.free();
      await gateway.close();
    }
  },
);
test(
  'room-owned world clock survives late joins/reconnects and rejects browser time changes',
  { timeout: 15000 },
  async () => {
    const initialTick = DAY_TICKS / 2;
    const options = {
      build,
      content,
      worldDefaults: { seed: 4242, initialTick },
      admit: async (req: import('node:http').IncomingMessage) =>
        developmentAdmission({
          id: String(req.headers['x-test-actor']),
          role: 'participant' as const,
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        }),
    };
    await assert.rejects(
      createGateway({ ...options, worldDefaults: { seed: -1 } }),
      /invalid world defaults/,
    );
    await assert.rejects(
      createGateway({ ...options, worldDefaults: { initialTick: -1 } }),
      /invalid world defaults/,
    );
    await assert.rejects(
      createGateway({ ...options, build: { ...build, environmentVersion: 999 } }),
      /incompatible/,
    );
    const gateway = await createGateway(options),
      address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`,
      probes: Probe[] = [];
    const join = async (id: string) => {
      const response = await fetch(`${origin}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'clock' }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as { ticket: string; buildId: string };
      const probe = new Probe(`ws://127.0.0.1:${address.port}/voxel`);
      probes.push(probe);
      await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...ticket });
      const welcome = await probe.wait(
        (e): e is Extract<ServerMessage, { type: 'welcome' }> =>
          'type' in e && e.type === 'welcome',
      );
      await probe.ready();
      return { probe, welcome };
    };
    try {
      const first = await join('early');
      assert.equal(first.welcome.environmentVersion, ENVIRONMENT_VERSION);
      assert.ok(first.welcome.tick >= initialTick);
      assert.ok(sampleEnvironment(first.welcome.tick, first.welcome.seed).daylight < 0.1);
      const snapshot = await first.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
          'type' in e && e.type === 'snapshot' && e.tick >= initialTick + 6,
      );
      const late = await join('late');
      assert.equal(late.welcome.worldId, first.welcome.worldId);
      assert.ok(late.welcome.tick >= snapshot.tick);
      const at = first.probe.events.length;
      first.probe.socket.send(JSON.stringify({ type: 'environment', tick: 999999999 }));
      const rejected = await first.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'error' }> =>
          'type' in e && e.type === 'error' && e.code === 'INVALID',
        at,
      );
      assert.ok(rejected);
      first.probe.socket.terminate();
      await once(first.probe.socket, 'close');
      const rejoined = await join('early');
      assert.equal(rejoined.welcome.worldId, late.welcome.worldId);
      assert.ok(rejoined.welcome.tick >= late.welcome.tick);
      assert.ok(
        rejoined.welcome.tick < initialTick + 900,
        'client time command cannot advance room clock',
      );
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'supervised creative room shares authoritative edits, admits late joins/reconnects, and rejects replay/time forgery',
  { timeout: 30000 },
  async () => {
    const gateway = await createGateway({
      build,
      content,
      admit: async (req) =>
        developmentAdmission({
          id: String(req.headers['x-test-actor']),
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        }),
    });
    const address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const http = `http://127.0.0.1:${address.port}`,
      ws = `ws://127.0.0.1:${address.port}/voxel`,
      probes: Probe[] = [];
    const admission = async (id: string) => {
      const response = await fetch(`${http}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'integration' }),
      });
      assert.equal(response.status, 200);
      return response.json() as Promise<{ ticket: string; buildId: string }>;
    };
    const join = async (id: string) => {
      const ticket = await admission(id),
        p = new Probe(ws);
      probes.push(p);
      await once(p.socket, 'open');
      p.send({ type: 'hello', ...ticket });
      return { probe: p, ticket, baseline: await p.ready() };
    };
    const world = new VoxelWorld(),
      generator = new TerrainGen(4242);
    try {
      const [a, b] = await Promise.all([join('a'), join('b')]);
      assert.equal(gateway.rooms.size, 1);
      for (const frame of a.probe.columns.values()) {
        world.insert_column(frame.x, frame.z, generator.generate(frame.x, frame.z));
        for (const [local, state] of frame.edits)
          world.mirror_block(...worldCell(frame.x, frame.z, local), state);
      }
      for (const p of [a, b])
        world.player_add(p.baseline.state[0], p.baseline.state[1], p.baseline.state[2]);
      const state = a.baseline.state,
        glow = content.blocks.findIndex((b) => b.name === 'glowstone');
      let selection: { hit: Float64Array; yaw: number; pitch: number } | null = null;
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
        for (const pitch of [-0.45, -0.65, -0.85]) {
          const hit = world.raycast(
            state[0],
            state[1] + 1.62,
            state[2],
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch),
            6,
          );
          if (!hit[0]) continue;
          const replaceable = content.blocks[world.get_block(hit[1], hit[2], hit[3])]?.replaceable,
            offset = replaceable ? 0 : 1;
          const x = hit[1] + hit[4] * offset,
            y = hit[2] + hit[5] * offset,
            z = hit[3] + hit[6] * offset,
            block = content.blocks[world.get_block(x, y, z)];
          if (
            block &&
            (block.shape === 'air' || block.replaceable) &&
            !world.player_overlaps(x, y, z, glow)
          ) {
            selection = { hit, yaw, pitch };
            break;
          }
        }
      assert.ok(selection, 'spawn needs a visible buildable cell');
      const { hit, yaw, pitch } = selection;
      const target: [number, number, number] = [hit[1], hit[2], hit[3]],
        destination: [number, number, number] = content.blocks[world.get_block(...target)]
          ?.replaceable
          ? target
          : [hit[1] + hit[4], hit[2] + hit[5], hit[3] + hit[6]];
      const revisions = [
        ...new Map(
          [target, destination].map((c) => {
            const x = c[0] >> 4,
              z = c[2] >> 4;
            return [`${x},${z}`, { x, z, revision: a.probe.columns.get(`${x},${z}`)!.revision }];
          }),
        ).values(),
      ];
      const frame = {
        epoch: a.baseline.epoch,
        sequence: 1,
        x: 0,
        z: 0,
        yaw,
        pitch,
        jump: false,
        sneak: false,
        sprint: false,
      };
      a.probe.send({ type: 'input', frames: [frame] });
      const action: Extract<ClientMessage, { type: 'action' }> = {
        type: 'action',
        epoch: a.baseline.epoch,
        sequence: 1,
        inputSequence: 1,
        kind: 'place',
        target,
        state: glow,
        inventoryRevision: 0,
        revisions,
      };
      a.probe.send(action);
      const result = await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
      );
      assert.equal(result.outcome?.ok, true, JSON.stringify(result));
      const patch = await b.probe.wait((e): e is ChunkFrame => 'kind' in e && e.kind === 'patch');
      assert.equal(patch.edits[0][1], glow);
      const before = a.probe.events.length;
      a.probe.send(action);
      const repeated = await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
        before,
      );
      assert.equal(repeated.status, 'cached');
      const late = await join('late');
      const column = late.probe.columns.get(`${destination[0] >> 4},${destination[2] >> 4}`)!;
      assert.ok(
        column.edits.some(
          ([local, state]) => local === localIndex(...destination) && state === glow,
        ),
      );
      for (let sequence = 2; sequence <= 140; sequence++)
        a.probe.send({ ...action, sequence, target: [0, 250, 0] });
      await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 140,
      );
      const replayAfter = a.probe.events.length;
      a.probe.send(action);
      const retired = await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
        replayAfter,
      );
      assert.equal(retired.status, 'retired');
      a.probe.socket.send(
        JSON.stringify({
          type: 'input',
          frames: [{ ...frame, sequence: 2, dt: 100, position: [100, 100, 100] }],
        }),
      );
      a.probe.socket.send(JSON.stringify({ type: 'dev', source: 'move 10000' }));
      await a.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'error' }> =>
          'type' in e && e.type === 'error' && e.code === 'INVALID',
      );
      const reconnect = await join('a');
      assert.ok(reconnect.baseline.epoch > a.baseline.epoch);
      const oldAfter = reconnect.probe.events.length;
      reconnect.probe.send(action);
      const stale = await reconnect.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
        oldAfter,
      );
      assert.equal(stale.status, 'stale_epoch');
      const replayTicket = new Probe(ws);
      probes.push(replayTicket);
      await once(replayTicket.socket, 'open');
      replayTicket.send({ type: 'hello', ...a.ticket });
      const denied = await replayTicket.wait(
        (e): e is Extract<ServerMessage, { type: 'error' }> => 'type' in e && e.type === 'error',
      );
      assert.equal(denied.code, 'UNAUTHORIZED');
      assert.equal((await fetch(`${http}/ready`)).status, 200);
    } finally {
      for (const p of probes) p.socket.terminate();
      world.free();
      generator.free();
      await gateway.close();
    }
  },
);

test(
  'the actual gateway bounds burst movement time and enforces participant/observer capabilities',
  { timeout: 20000 },
  async () => {
    const gateway = await createGateway({
      build,
      content,
      admit: async (req) => {
        const id = String(req.headers['x-test-actor']),
          observer = id.includes('observer');
        return developmentAdmission({
          id,
          role: observer ? 'observer' : 'participant',
          capabilities: {
            build: id !== 'blocked',
            fly: id !== 'blocked',
            observe: observer && id !== 'denied-observer',
            combat: !observer && id !== 'blocked',
            explosives: !observer && id !== 'blocked',
          },
        });
      },
    });
    const address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}`,
      probes: Probe[] = [];
    const ticket = async (id: string) =>
      fetch(`${url}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'authority' }),
      });
    const join = async (id: string) => {
      const response = await ticket(id);
      assert.equal(response.status, 200);
      const admission = (await response.json()) as { ticket: string; buildId: string },
        probe = new Probe(`ws://127.0.0.1:${address.port}/voxel`);
      probes.push(probe);
      await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...admission });
      return { probe, baseline: await probe.ready() };
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const [normal, burst] = await Promise.all([join('normal'), join('burst')]);
      const fly = async (client: typeof normal) => {
        const at = client.probe.events.length;
        client.probe.send({ type: 'flight', epoch: client.baseline.epoch, sequence: 1, on: true });
        return client.probe.wait(
          (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
            'type' in e && e.type === 'baseline' && e.reason === 'flight',
          at,
        );
      };
      const [normalStart, burstStart] = await Promise.all([fly(normal), fly(burst)]);
      let normalSequence = 0,
        burstSequence = 0;
      const input = (epoch: number, sequence: number) => ({
        epoch,
        sequence,
        x: 1,
        z: 0,
        yaw: 0,
        pitch: 0,
        jump: false,
        sneak: false,
        sprint: false,
      });
      // Use ordinary authorized flight controls to get above the forest canopy. Geometry
      // must not conceal an input-time regression by blocking both clients against a tree.
      timer = setInterval(() => {
        normal.probe.send({
          type: 'input',
          frames: Array.from({ length: 2 }, () => ({
            ...input(normalStart.epoch, ++normalSequence),
            x: 0,
            jump: true,
          })),
        });
        burst.probe.send({
          type: 'input',
          frames: Array.from({ length: 2 }, () => ({
            ...input(burstStart.epoch, ++burstSequence),
            x: 0,
            jump: true,
          })),
        });
      }, 1000 / 30);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      clearInterval(timer);
      timer = undefined;
      const snapshots = (probe: Probe) =>
        new Map(
          probe.events
            .filter(
              (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
                'type' in e && e.type === 'snapshot' && !!e.self,
            )
            .map((e) => [e.tick, e.self!.state]),
        );
      const lastCommon = (a: Map<number, readonly number[]>, b: Map<number, readonly number[]>) =>
        Math.max(...[...a.keys()].filter((tick) => b.has(tick)));
      const normalBefore = snapshots(normal.probe),
        burstBefore = snapshots(burst.probe),
        startTick = lastCommon(normalBefore, burstBefore);
      assert.ok(Number.isSafeInteger(startTick));
      normal.probe.send({ type: 'input', frames: [input(normalStart.epoch, ++normalSequence)] });
      for (let i = 0; i < 15; i++)
        burst.probe.send({
          type: 'input',
          frames: Array.from({ length: 4 }, () => input(burstStart.epoch, ++burstSequence)),
        });
      timer = setInterval(() => {
        normal.probe.send({
          type: 'input',
          frames: Array.from({ length: 2 }, () => input(normalStart.epoch, ++normalSequence)),
        });
        burst.probe.send({
          type: 'input',
          frames: Array.from({ length: 2 }, () => input(burstStart.epoch, ++burstSequence)),
        });
      }, 1000 / 30);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      clearInterval(timer);
      timer = undefined;
      // Both clients are bounded by the same earned room time. A normally paced
      // sender can miss timer callbacks under CI load, so it is not a speed oracle.
      const normalSnapshots = snapshots(normal.probe),
        burstSnapshots = snapshots(burst.probe);
      const commonTick = lastCommon(normalSnapshots, burstSnapshots);
      assert.ok(Number.isSafeInteger(commonTick));
      assert.ok(commonTick > startTick);
      const maximumDistance = (start: readonly number[], movement: MovementModifiers) => {
        const reference = new VoxelWorld(),
          empty = new TerrainGen(4242),
          loaded = new Set<string>();
        try {
          empty.set_void();
          const slot = reference.player_add(start[0], start[1], start[2]);
          reference.player_restore(slot, new Float64Array(start));
          assert.equal(start[10], 1, 'reference begins in authorized flight');
          for (let step = 0; step < (commonTick - startTick) * 2; step++) {
            const body = reference.player_state(slot);
            for (const column of around(Math.floor(body[0] / 16), Math.floor(body[2] / 16), 1)) {
              const key = `${column.x},${column.z}`;
              if (!loaded.has(key)) {
                reference.insert_column(column.x, column.z, empty.generate(column.x, column.z));
                loaded.add(key);
              }
            }
            stepBoundedMovement(reference, slot, { ...NEUTRAL, x: 1 }, movement);
          }
          return reference.player_state(slot)[0] - start[0];
        } finally {
          reference.free();
          empty.free();
        }
      };
      const normalDistance = normalSnapshots.get(commonTick)![0] - normalBefore.get(startTick)![0],
        burstDistance = burstSnapshots.get(commonTick)![0] - burstBefore.get(startTick)![0];
      assert.ok(normalDistance > 5);
      for (const [name, distance, state, movement] of [
        ['normal', normalDistance, normalBefore.get(startTick)!, normalStart.movement],
        ['burst', burstDistance, burstBefore.get(startTick)!, burstStart.movement],
      ] as const) {
        const maximum = maximumDistance(state, movement);
        assert.ok(
          distance <= maximum + 0.001,
          `ticks ${startTick}–${commonTick}: ${name} moved ${distance}, native limit ${maximum}`,
        );
      }
      assert.ok(
        burst.probe.events.some(
          (e) => 'type' in e && e.type === 'baseline' && e.reason === 'resync',
        ),
      );
      const observer = await join('hidden-observer');
      observer.probe.send({
        type: 'action',
        epoch: observer.baseline.epoch,
        sequence: 1,
        inputSequence: 0,
        kind: 'remove',
        target: [0, 100, 0],
        state: 0,
        inventoryRevision: 0,
        revisions: [{ x: 0, z: 0, revision: 0 }],
      });
      const denied = await observer.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
      );
      assert.equal(denied.outcome?.reason, 'forbidden');
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        normal.probe.events.some(
          (e) => 'type' in e && e.type === 'actor_joined' && e.actor.id === 'hidden-observer',
        ),
        false,
      );
      assert.ok(
        observer.probe.events.some(
          (e) => 'type' in e && e.type === 'actor_joined' && e.actor.id === 'normal',
        ),
      );
      const blocked = await join('blocked');
      blocked.probe.send({ type: 'flight', epoch: blocked.baseline.epoch, sequence: 1, on: true });
      const noFlight = await blocked.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === 1,
      );
      assert.equal(noFlight.outcome?.reason, 'forbidden');
      assert.equal((await ticket('denied-observer')).status, 403);
    } finally {
      clearInterval(timer);
      for (const p of probes) p.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'survival sockets resolve authoritative melee, cache once, bound bursts and enforce combat independently of build permission',
  { timeout: 20000 },
  async () => {
    const gateway = await createGateway({
      build,
      content,
      worldDefaults: { mode: 'survival' },
      admit: async (req) =>
        developmentAdmission({
          id: String(req.headers['x-test-actor']),
          role: 'participant',
          capabilities: {
            build: true,
            fly: false,
            observe: false,
            combat: req.headers['x-test-actor'] !== 'peaceful',
            explosives: true,
          },
        }),
    });
    const address = gateway.address;
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`,
      probes: Probe[] = [];
    let timer: ReturnType<typeof setInterval> | undefined;
    const join = async (id: string) => {
      const response = await fetch(`${origin}/api/voxel/admission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'combat' }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as { ticket: string; buildId: string },
        probe = new Probe(`ws://127.0.0.1:${address.port}/voxel`);
      probes.push(probe);
      if (probe.socket.readyState !== WebSocket.OPEN) await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...ticket });
      return { probe, baseline: await probe.ready() };
    };
    try {
      const { probe: a, baseline } = await join('attacker'),
        { probe: b, baseline: target } = await join('target'),
        { probe: peaceful, baseline: peaceEpoch } = await join('peaceful');
      b.send({ type: 'focus', epoch: target.epoch, active: false });
      peaceful.send({ type: 'focus', epoch: peaceEpoch.epoch, active: false });
      let sequence = 0,
        action = 0,
        controls = { ...NEUTRAL, z: 1 };
      timer = setInterval(() => {
        if (a.socket.readyState === WebSocket.OPEN)
          a.send({
            type: 'input',
            frames: [{ ...controls, epoch: baseline.epoch, sequence: ++sequence }],
          });
      }, 1000 / 60);
      await a.wait(
        (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
          'type' in e &&
          e.type === 'snapshot' &&
          !!e.self &&
          e.self.state[2] > baseline.state[2] + 0.75,
      );
      controls = { ...NEUTRAL };
      await new Promise((resolve) => setTimeout(resolve, 100));
      const start = a.events.length;
      const request: ClientMessage = {
        type: 'attack',
        epoch: baseline.epoch,
        sequence: ++action,
        inputSequence: sequence,
        inventoryRevision: 0,
      };
      a.send(request);
      const hit = await a.wait(
        (e): e is Extract<ServerMessage, { type: 'hit' }> => 'type' in e && e.type === 'hit',
        start,
      );
      assert.equal(hit.attacker, 'attacker');
      assert.equal(hit.target, 'target');
      assert.equal(hit.damage, 2);
      await b.wait(
        (e): e is Extract<ServerMessage, { type: 'vitals' }> =>
          'type' in e && e.type === 'vitals' && e.view.health === 18,
      );
      const cached = a.events.length;
      a.send(request);
      assert.equal(
        (
          await a.wait(
            (e): e is Extract<ServerMessage, { type: 'result' }> =>
              'type' in e && e.type === 'result' && e.sequence === 1,
            cached,
          )
        ).status,
        'cached',
      );
      const burst = a.events.length;
      for (let n = 0; n < 20; n++)
        a.send({
          type: 'attack',
          epoch: baseline.epoch,
          sequence: ++action,
          inputSequence: sequence,
          inventoryRevision: 0,
        });
      await a.wait(
        (e): e is Extract<ServerMessage, { type: 'result' }> =>
          'type' in e && e.type === 'result' && e.sequence === action,
        burst,
      );
      assert.ok(
        a.events
          .slice(burst)
          .filter(
            (e): e is Extract<ServerMessage, { type: 'result' }> =>
              'type' in e && e.type === 'result',
          )
          .every((e) => e.outcome?.reason === 'cooldown'),
      );
      assert.equal(a.events.filter((e) => 'type' in e && e.type === 'hit').length, 1);
      const pbase = peaceful.events.findLast(
        (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
          'type' in e && e.type === 'baseline',
      )!;
      peaceful.send({ type: 'focus', epoch: pbase.epoch, active: true });
      const focused = await peaceful.wait(
        (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
          'type' in e && e.type === 'baseline' && e.epoch > pbase.epoch,
      );
      peaceful.send({ type: 'input', frames: [{ ...NEUTRAL, epoch: focused.epoch, sequence: 1 }] });
      peaceful.send({
        type: 'attack',
        epoch: focused.epoch,
        sequence: 1,
        inputSequence: 1,
        inventoryRevision: 0,
      });
      assert.equal(
        (
          await peaceful.wait(
            (e): e is Extract<ServerMessage, { type: 'result' }> =>
              'type' in e && e.type === 'result',
          )
        ).outcome?.reason,
        'forbidden',
      );
      assert.ok(
        a.events.every((e) => !('type' in e) || e.type !== 'vitals' || e.view.health === 20),
      );
      assert.ok(
        peaceful.events.every((e) => !('type' in e) || e.type !== 'vitals' || e.view.health === 20),
      );
    } finally {
      clearInterval(timer);
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);
