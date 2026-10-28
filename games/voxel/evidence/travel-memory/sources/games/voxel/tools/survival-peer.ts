import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { parseServerMessage, around } from '../src/shared/protocol.ts';
import type { ClientMessage, ServerMessage, Cell } from '../src/shared/protocol.ts';
import { decodeChunk, localIndex } from '../src/shared/chunk-wire.ts';
import type { ChunkFrame } from '../src/shared/chunk-wire.ts';
import { NEUTRAL } from '../src/shared/input.ts';
import type { Controls } from '../src/shared/input.ts';
import type { InventoryView } from '../src/shared/inventory.ts';
import type { VitalsView } from '../src/shared/vitals.ts';
import { TimingHistogram } from '../src/server/timing-histogram.ts';
type Event = ServerMessage | ChunkFrame;
export type Action = Extract<ClientMessage, { sequence: number }>;
type Result = Extract<ServerMessage, { type: 'result' }>;

/** Headless workload client: normal public commands, latest views and bounded
 * event retention. It grants no authority and never supplies server coordinates.
 */
export class SurvivalPeer {
  readonly id: string;
  readonly socket: WebSocket;
  readonly events: { serial: number; event: Event }[] = [];
  readonly columns = new Map<
    string,
    { revision: number; subscription: number; edits: Map<number, number> }
  >();
  readonly listeners = new Set<() => void>();
  readonly sent = new Map<number, number>();
  readonly ackMs = new TimingHistogram();
  readonly commandMs = new TimingHistogram();
  readonly outcomes: Record<string, number> = {};
  serial = 0;
  epoch = 0;
  sequence = 0;
  input = 0;
  ack = 0;
  tick = 0;
  body: readonly number[] = [];
  controls: Controls = { ...NEUTRAL };
  inventory: InventoryView | null = null;
  vitals: VitalsView | null = null;
  baseline: Extract<ServerMessage, { type: 'baseline' }> | null = null;
  joinedReadyBoundary = false;
  welcome: Extract<ServerMessage, { type: 'welcome' }> | null = null;
  enabled = false;
  focusWanted = false;
  stopping = false;
  closed = false;
  error: Error | null = null;
  messages = 0;
  bytes = 0;
  resyncs = 0;
  retainedHighWater = 0;
  lostAckSamples = 0;
  constructor(id: string, url: string, states: number) {
    this.id = id;
    this.socket = new WebSocket(url);
    this.socket.on('error', (e) => {
      this.error = e;
      this.notify();
    });
    this.socket.on('close', () => {
      this.closed = true;
      this.notify();
    });
    this.socket.on('message', (raw, binary) => {
      try {
        this.messages++;
        this.bytes += (raw as Buffer).byteLength;
        const event = binary
          ? decodeChunk(new Uint8Array(raw as Buffer), states)
          : parseServerMessage(raw.toString());
        assert(event, 'valid public server event');
        if ('kind' in event) {
          const key = `${event.x},${event.z}`;
          if (event.kind === 'baseline')
            this.columns.set(key, {
              revision: event.revision,
              subscription: event.subscription,
              edits: new Map(event.edits),
            });
          else {
            const c = this.columns.get(key);
            assert(c && c.subscription === event.subscription);
            assert(event.revision >= c.revision);
            c.revision = event.revision;
            for (const [index, state] of event.edits) c.edits.set(index, state);
          }
        } else if (event.type === 'welcome') {
          this.welcome = event;
          this.epoch = event.epoch;
        } else if (event.type === 'error') throw new Error(`server ${event.code}`);
        else if (event.type === 'baseline') {
          if (event.epoch !== this.epoch) {
            this.epoch = event.epoch;
            this.sequence = 0;
            this.input = event.ack;
            this.ack = event.ack;
            this.sent.clear();
          }
          this.body = event.state;
          this.baseline = event;
          if (event.reason === 'join') this.joinedReadyBoundary = true;
          if (event.reason === 'resync') this.resyncs++;
          // Resume can invalidate a focus request made while policy still paused
          // the room. Reassert intent against the new baseline, like the browser.
          if (this.focusWanted && event.phase === 'playing' && event.state[12] !== 0)
            this.send({ type: 'focus', epoch: event.epoch, active: true });
        } else if (event.type === 'inventory' && event.epoch === this.epoch)
          this.inventory = event.view;
        else if (event.type === 'vitals' && event.epoch === this.epoch) this.vitals = event.view;
        else if (event.type === 'unload') this.columns.delete(`${event.x},${event.z}`);
        else if (event.type === 'snapshot') {
          this.tick = event.tick;
          if (event.self?.epoch === this.epoch) {
            this.body = event.self.state;
            this.ack = event.self.ack;
            const sent = this.sent.get(this.ack);
            if (sent !== undefined) this.ackMs.record(performance.now() - sent);
            for (const n of this.sent.keys()) if (n <= this.ack) this.sent.delete(n);
          }
        }
        this.events.push({ serial: ++this.serial, event });
        if (this.events.length > 256) this.events.splice(0, this.events.length - 256);
        this.retainedHighWater = Math.max(this.retainedHighWater, this.events.length);
      } catch (e) {
        this.error = e instanceof Error ? e : new Error('invalid workload event');
      }
      this.notify();
    });
  }
  private notify() {
    for (const f of this.listeners) f();
  }
  until(predicate: () => boolean, label: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        this.listeners.delete(check);
        error ? reject(error) : resolve();
      };
      const check = () => {
        try {
          if (predicate()) finish();
          else if (this.error || this.closed)
            finish(this.error ?? new Error(`closed while ${label}`));
        } catch (e) {
          finish(e as Error);
        }
      };
      const timer = setTimeout(() => finish(new Error(`timeout: ${this.id} ${label}`)), timeoutMs);
      this.listeners.add(check);
      check();
    });
  }
  async event<T extends Event>(
    predicate: (e: Event) => e is T,
    after: number,
    label: string,
  ): Promise<T> {
    let found: T | undefined;
    await this.until(() => {
      const row = this.events.find((r) => r.serial > after && predicate(r.event));
      found = row?.event as T | undefined;
      return !!found;
    }, label);
    return found!;
  }
  send(m: ClientMessage) {
    assert.equal(this.socket.readyState, WebSocket.OPEN);
    this.socket.send(JSON.stringify(m));
  }
  batch() {
    if (!this.enabled || this.socket.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    this.send({
      type: 'input',
      frames: [1, 2].map(() => {
        const sequence = ++this.input;
        this.sent.set(sequence, now);
        return { ...this.controls, epoch: this.epoch, sequence };
      }),
    });
    while (this.sent.size > 256) {
      this.sent.delete(this.sent.keys().next().value!);
      this.lostAckSamples++;
    }
  }
  view() {
    assert(this.inventory);
    return this.inventory;
  }
  cell(c: Cell) {
    return this.columns.get(`${c[0] >> 4},${c[2] >> 4}`)?.edits.get(localIndex(...c));
  }
  revision(c: Cell) {
    const col = this.columns.get(`${c[0] >> 4},${c[2] >> 4}`);
    assert(col);
    return col.revision;
  }
  async transact(message: Action) {
    const after = this.serial,
      started = performance.now();
    this.send(message);
    const result = await this.event(
      (e): e is Result =>
        'type' in e &&
        e.type === 'result' &&
        e.epoch === message.epoch &&
        e.sequence === message.sequence,
      after,
      'command result',
    );
    this.commandMs.record(performance.now() - started);
    const reason = result.outcome?.reason ?? result.status;
    this.outcomes[reason] = (this.outcomes[reason] ?? 0) + 1;
    return { message, result };
  }
  request(make: (epoch: number, sequence: number) => Action) {
    return this.transact(make(this.epoch, ++this.sequence));
  }
  async ready() {
    await this.until(
      () =>
        this.joinedReadyBoundary &&
        !!this.baseline &&
        around(Math.floor(this.body[0] / 16), Math.floor(this.body[2] / 16), 1).every((c) =>
          this.columns.has(`${c.x},${c.z}`),
        ),
      'nearby columns',
    );
    let after = this.serial;
    this.send({
      type: 'ready',
      epoch: this.epoch,
      columns: around(Math.floor(this.body[0] / 16), Math.floor(this.body[2] / 16), 1).map((c) => ({
        ...c,
        revision: this.columns.get(`${c.x},${c.z}`)!.revision,
      })),
    });
    await this.event(
      (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in e && e.type === 'baseline' && e.reason === 'ready',
      after,
      'ready baseline',
    );
    after = this.serial;
    this.focusWanted = true;
    this.send({ type: 'focus', epoch: this.epoch, active: true });
    await this.until(
      () => this.serial > after && this.baseline?.phase === 'playing' && this.body[12] === 0,
      'active focus',
    );
    this.enabled = true;
  }
  async aim(point: readonly number[]) {
    const dx = point[0] - this.body[0],
      dy = point[1] - this.body[1] - 1.62,
      dz = point[2] - this.body[2];
    this.controls = {
      ...NEUTRAL,
      yaw: Math.atan2(dx, -dz),
      pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    };
    const boundary = this.input + 2;
    await this.until(() => this.ack >= boundary, 'aim acknowledgement');
  }
  summary() {
    return {
      id: this.id,
      messages: this.messages,
      bytes: this.bytes,
      resyncs: this.resyncs,
      retainedEvents: this.events.length,
      retainedHighWater: this.retainedHighWater,
      pendingWaiters: this.listeners.size,
      lostAckSamples: this.lostAckSamples,
      ackMs: this.ackMs.take(),
      commandMs: this.commandMs.take(),
      outcomes: this.outcomes,
      inventorySummary: this.inventory
        ? {
            revision: this.inventory.revision,
            items: this.inventory.bag
              .filter((s) => s !== null)
              .map((s) => ({ itemType: s.itemType, count: s.count })),
          }
        : null,
      lastBaseline: this.baseline
        ? {
            reason: this.baseline.reason,
            phase: this.baseline.phase,
            epoch: this.baseline.epoch,
            position: this.baseline.state.slice(0, 3),
          }
        : null,
    };
  }
}
