// Copy into Blockyard tests/headless/_playground-input-time-socket.ts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { serveGame } from '../../src/platform/host/server';
import { encode, decode } from '../../src/platform/net/codec';
import type { GameDefinition } from '../../src/platform/api/types';

const def: GameDefinition = { id: 'input-time-probe', title: 'Input time probe', world: { terrain: 'void', ground: { y: 63, depth: 4 }, spawn: { x: .5, y: 64, z: .5 } }, player: { fly: false, health: false, hotbar: 'blocks' } };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function trial(burst: boolean) {
  const server = await serveGame(def, { port: 0, seed: 4242, wasm: readFileSync('engine/pkg/voxel_engine_bg.wasm'), tickRate: 30 });
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/`);
  let joined = false, sent = 0, seq = 0;
  ws.onmessage = e => {
    const message = decode<any>(String(e.data));
    if (message.t === 'welcome') ws.send(encode({ t: 'start', name: 'Probe' }));
    if (message.events?.some((e: any) => e.t === 'joined')) joined = true;
  };
  try {
    for (let i = 0; i < 200 && !joined; i++) await wait(10);
    assert(joined, 'client must join');
    const player = server.host(def.id)!.sim.players[0];
    const start = { ...player.state };
    const input = { active: true, down: ['KeyW'], pressed: [], buttons: 0, clicked: 0, mouseX: 0, mouseY: 0, wheel: 0, yaw: 0, pitch: 0, viewSeq: player.viewSeq };
    const send = (dt: number) => { ws.send(encode({ t: 'input', input, seq: ++seq, dt })); sent++; };
    const startTime = performance.now();
    if (burst) for (let i = 0; i < 60; i++) send(.1);
    const timer = setInterval(() => { send(1 / 60); send(1 / 60); }, 1000 / 30);
    await wait(1000); clearInterval(timer); await wait(50);
    return { burst, wallSeconds: (performance.now() - startTime) / 1000, sent, socketOpen: ws.readyState === WebSocket.OPEN, distanceBlocks: Math.hypot(player.state.x - start.x, player.state.z - start.z), lastAck: player.ack };
  } finally { ws.close(); await server.close(); }
}

export default async function probe() {
  const results = [await trial(false), await trial(true)];
  assert(results.every(r => r.sent < 300 && r.socketOpen), 'both trials stay connected below the default 300 messages/s limit');
  writeFileSync('/tmp/voxel-runtime-input-time-socket.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  assert(results[1].distanceBlocks <= results[0].distanceBlocks * 1.2 + .5,
    'Movement-time invariant violated: the burst client moved substantially farther in the same wall time');
}
