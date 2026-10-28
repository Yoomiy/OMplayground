// Disposable probe: copy into Blockyard tests/headless/_playground-probe.ts.
// Run with its scripts/headless.mjs at the revision recorded in RESULTS.md.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { GameHost, GeneratedWorld } from '../../src/platform/host/game';
import { RoomCore } from '../../src/platform/host/room';
import { Predictor } from '../../src/platform/client/predict';
import { engine, loadEngineSync, wasmMemory } from '../../src/platform/engine/wasm';
import { worldGenConfig } from '../../src/platform/workers/config';
import { blockIdOf, loadRegistry } from '../../src/platform/world/registry';
import type { GameDefinition } from '../../src/platform/api/types';
import type { PlayerInput } from '../../src/platform/net/protocol';

const wasm = readFileSync('engine/pkg/voxel_engine_bg.wasm');
const def: GameDefinition = {
  id: 'playground-probe', title: 'Playground probe',
  world: { terrain: 'void', ground: { y: 63, depth: 4 }, spawn: { x: 0.5, y: 64, z: 0.5 } },
  player: { build: true, fly: false, health: false, hotbar: 'blocks' },
};
const stats = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return { n: xs.length, mean: xs.reduce((a, b) => a + b, 0) / xs.length, p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
};
const timed = <T>(xs: number[], f: () => T): T => {
  const start = performance.now(); const result = f(); xs.push(performance.now() - start); return result;
};
const controls = (yaw = 0, down = ['KeyW']): PlayerInput => ({ active: true, down, pressed: [], buttons: 0, clicked: 0, mouseX: 0, mouseY: 0, wheel: 0, yaw, pitch: 0, viewSeq: 0 });

function terrain() {
  const gen = new engine.TerrainGen(4242);
  const world = new engine.VoxelWorld();
  const mesher = new engine.ChunkMesher();
  const generate: number[] = [], insert: number[] = [], extract: number[] = [], mesh: number[] = [];
  let generatedBytes = 0, meshBytes = 0, regionBytes = 0;
  // Warm the engine/JIT separately, away from the measured region.
  for (let x = 40; x < 45; x++) gen.generate(x, 40);
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const data = timed(generate, () => gen.generate(x, z));
    generatedBytes += data.byteLength;
    timed(insert, () => world.insert_column(x, z, data));
  }
  for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
    const region = timed(extract, () => world.extract_region(x, z));
    regionBytes += region.byteLength;
    meshBytes += timed(mesh, () => mesher.mesh(region)).byteLength;
  }
  // Include mixed models, cutouts, glass/water and emitters in the central neighborhood.
  const registry = JSON.parse(engine.block_registry_json()).blocks;
  assert(Array.isArray(registry), 'registry must be a list');
  const solid = registry.filter((b: any) => b.id > 0 && b.id < 187);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    world.set_block(x, 100, z, solid[(z * 16 + x) % solid.length].id);
    world.set_block(x, 99, z, 3);
  }
  const mixed: number[] = [], edits: number[] = [];
  for (let i = 0; i < 30; i++) {
    world.set_block(i % 16, 101, Math.floor(i / 16), i % 2 ? 0 : 1);
    timed(mixed, () => mesher.mesh(world.extract_region(0, 0)));
  }
  for (let i = 0; i < 10; i++) {
    world.set_block(8, 101, 8, i % 2 ? 0 : 1);
    timed(edits, () => {
      for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) mesher.mesh(world.extract_region(x, z));
    });
  }
  const memoryBeforeUnload = wasmMemory().buffer.byteLength;
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) world.remove_column(x, z);
  assert.equal(world.column_count(), 0);
  const result = { generateMs: stats(generate), insertMs: stats(insert), extractMs: stats(extract), lightAndMeshMs: stats(mesh), mixedLightAndMeshMs: stats(mixed), nineColumnRemeshMs: stats(edits), averageGeneratedBytes: generatedBytes / generate.length, averageRegionBytes: regionBytes / mesh.length, averageMeshBytes: meshBytes / mesh.length, wasmMemoryHighWaterBytes: memoryBeforeUnload, columnsAfterUnload: world.column_count() };
  gen.free(); world.free(); mesher.free(); return result;
}

function room(players: number, active: boolean) {
  let bytes = 0, messages = 0;
  const core = new RoomCore(def, { game: def.id, instance: 'public', tickRate: 30, cheats: false, dev: false, seed: 4242, saveEvery: 1e9 }, wasm, undefined, {
    send: (_c, text) => { bytes += Buffer.byteLength(text); messages++; }, counts() {}, log() {},
  });
  const internal = core as any;
  clearInterval(internal.timer);
  const ids = Array.from({ length: players }, (_, i) => `client-${i}`);
  for (const id of ids) { core.connect(id); core.command(id, { t: 'start', name: id }); }
  core.host.radius = 3;
  const tick: number[] = [], edit: number[] = [];
  for (let frame = -90; frame < 300; frame++) {
    for (let k = 0; k < ids.length; k++) for (let sub = 0; sub < 2; sub++) core.command(ids[k], { t: 'input', seq: (frame + 91) * 2 + sub, dt: 1 / 60, input: controls(Math.sin(frame / 60 + k) * 2, active ? ['KeyW'] : []) });
    if (frame >= 0 && frame % 6 === 0) {
      const start = performance.now();
      core.host.world.world.set_block(frame % 16, 70, Math.floor(frame / 16) % 16, frame % 12 ? 0 : 1);
      edit.push(performance.now() - start);
    }
    const start = performance.now(); internal.step(1 / 30);
    if (frame === -1) { bytes = 0; messages = 0; }
    if (frame >= 0) tick.push(performance.now() - start);
  }
  const result = { players, active, tickMs: stats(tick), directEditMs: stats(edit), rawBytesPerSecond: bytes / 10, rawBytesPerPlayerSecond: bytes / 10 / players, messages, loadedColumns: core.host.world.world.column_count() };
  core.stop(); return result;
}

function prediction(jitter: boolean) {
  const host = new GameHost(def, { engine: wasm, seed: 4242, remote: true, radius: 3, budget: Infinity });
  const registry = loadRegistry();
  const mine = new GeneratedWorld(host.seed, worldGenConfig(def, (b) => blockIdOf(registry, b)));
  const ann = host.connect('Ann'); host.command(ann.id, { t: 'start' });
  const player = host.sim.players[0];
  const predictor = new Predictor(mine.world);
  const incoming: { due: number; input: PlayerInput; seq: number }[] = [];
  const outgoing: { due: number; frame: any }[] = [];
  const corrections: number[] = [], ackLag: number[] = [];
  let lastIncoming = 0, lastOutgoing = 0, shove = 0;
  for (let f = 0; f < 900; f++) {
    mine.update([player.state], 3, Infinity);
    const input = controls(Math.sin(f / 120) * 2, ['KeyW', ...(f % 240 > 120 ? ['ControlLeft'] : []), ...(f % 90 < 10 ? ['Space'] : [])]);
    input.pressed = f % 90 === 0 ? ['Space'] : []; input.viewSeq = player.viewSeq;
    predictor.step(input, 1 / 60, f + 1);
    // Preserve reliable ordered delivery, with variable one-way delays and a 300 ms pause.
    const pause = jitter && f >= 360 && f < 378 ? 18 : 0;
    lastIncoming = Math.max(lastIncoming, f + 3 + (jitter ? (f * 17 % 8) : 0) + pause);
    incoming.push({ due: lastIncoming, input, seq: f + 1 });
    while (incoming.length && incoming[0].due <= f) {
      const m = incoming.shift()!; host.command(ann.id, { t: 'input', input: m.input, seq: m.seq, dt: 1 / 60 });
    }
    if (f === 720) player.api.impulse(0, 9, 6);
    if (f % 2) {
      const batch = host.step(1 / 30).get(ann.id)!;
      lastOutgoing = Math.max(lastOutgoing, f + 3 + (jitter ? f * 7 % 8 : 0));
      outgoing.push({ due: lastOutgoing, frame: batch.frame });
    }
    while (outgoing.length && outgoing[0].due <= f) {
      const frame = outgoing.shift()!.frame; const me = frame.players.find((p: any) => p.id === ann.id);
      predictor.reconcile(me);
      assert(Number.isFinite(predictor.shown()!.x));
      if (f > 90 && f < 700) corrections.push(predictor.lastCorrection);
      if (f >= 720) shove = Math.max(shove, predictor.lastCorrection);
      ackLag.push(f + 1 - me.ack);
    }
  }
  const result = { jitter, correctionBlocks: stats(corrections), ackLagInputs: stats(ackLag), shoveCorrectionBlocks: shove };
  assert(shove > .1, 'server shove must be reconciled');
  if (!jitter) assert(stats(corrections).max < .01, 'steady delayed prediction must match');
  mine.dispose(); host.dispose(); return result;
}

function inputTimeProbe(inputsPerTick: number) {
  const host = new GameHost(def, { engine: wasm, seed: 4242, remote: true, radius: 3, budget: Infinity });
  const ann = host.connect('Ann'); host.command(ann.id, { t: 'start' });
  const player = host.sim.players[0]; const start = { ...player.state };
  for (let tick = 0; tick < 30; tick++) {
    // 60 large-duration inputs once a second remains below the socket's 300 msg/s limit.
    const n = tick === 0 ? inputsPerTick : 2;
    for (let i = 0; i < n; i++) host.command(ann.id, { t: 'input', seq: tick * 100 + i + 1, dt: inputsPerTick === 60 && tick === 0 ? .1 : 1 / 60, input: controls() });
    host.step(1 / 30);
  }
  const result = { initialBurst: inputsPerTick, simulatedWallSeconds: 1, distanceBlocks: Math.hypot(player.state.x - start.x, player.state.z - start.z), lastAck: player.ack };
  host.dispose(); return result;
}

export default function probe() {
  const start = performance.now(); loadEngineSync(wasm);
  const results = { wasmBytes: wasm.byteLength, compileAndInitMs: performance.now() - start, terrain: terrain(), rooms: [room(1, true), room(8, false), room(8, true), room(16, true)], prediction: [prediction(false), prediction(true)], inputTime: [inputTimeProbe(2), inputTimeProbe(60)] };
  writeFileSync(process.env.PROBE_OUTPUT ?? '/tmp/voxel-runtime-blockyard-results.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
