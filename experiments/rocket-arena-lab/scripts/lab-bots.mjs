import { Client } from 'colyseus.js';
import { PracticeBotFleet } from './bot-fleet.mjs';

const endpoint = process.env.LAB_BOT_ENDPOINT ?? 'ws://127.0.0.1:19001';
if (new URL(endpoint).hostname !== '127.0.0.1') throw new Error('Lab bots must use loopback');
const fleet = new PracticeBotFleet(new Client(endpoint));
const discover = () => fleet.discover().catch(error => console.warn(`[LabBots] discovery: ${error.message}`));
const polling = setInterval(discover, 1_000);
// One command per fixed input tick; never burst a backlog after a scheduling gap.
let previous = performance.now(), accumulator = 0;
const driving = setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(50, Math.max(0, now - previous)); previous = now;
  if (accumulator >= 1_000 / 60) { fleet.tick(now); accumulator %= 1_000 / 60; }
}, 8);
void discover();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  clearInterval(polling); clearInterval(driving);
  void fleet.stop().finally(() => process.exit(0));
});
