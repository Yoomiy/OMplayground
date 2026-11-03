import { failureDetails } from './failure.ts';
import type { StaffResult } from '../shared/staff.ts';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { WebSocket, WebSocketServer } from 'ws';
import { parseClientMessage, MAX_CONTROL_BYTES, PROTOCOL } from '../shared/protocol.ts';
import { ENVIRONMENT_VERSION } from '../shared/environment.ts';
import type { BuildIdentity, ServerMessage } from '../shared/protocol.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { AdmittedActor } from '../sim/game-room.ts';
import type { GameMode } from '../shared/gameplay.ts';
import type { FromRoom, ToRoom, RoomWorkerData } from './room-worker-protocol.ts';
import { RoomDurability } from './room-durability.ts';
import type { PersistencePorts } from './room-durability.ts';
import { Explosives } from '../sim/explosives.ts';
import { ConnectionAuthorization, readAuthorization, isSessionEnded } from './admission.ts';
import type { AdmissionRequest, AdmissionGrant, Authorization } from './admission.ts';
import { resolveOwnerAuthorizations } from './owner-authorization.ts';
import type { OwnerResolver } from './owner-authorization.ts';
import { readRoomPolicy } from './room-policy.ts';
import type { RoomPolicyReader } from './room-policy.ts';
import { SessionOutbox } from './session-projection.ts';
import type { SessionProjection } from './session-projection.ts';
import type { ControlPolicy, ControlGrant } from './control.ts';
export type AdmissionPolicy = (
  request: IncomingMessage,
  body: AdmissionRequest,
  response: ServerResponse,
) => Promise<AdmissionGrant | null>;
/** Trusted service API port; never decoded from a gameplay socket. */
export type GatewayApiContext = Readonly<{
  revoke(room: string, actor: string, revision: number): void;
  actor(
    room: string,
    actor: string,
  ): Readonly<{
    connection: string;
    role: 'participant' | 'observer';
    admissionRevision: number;
    expiresAt: number;
    worldId: string;
    owner: string;
    epoch: number;
  }> | null;
}>;
export type GatewayOptions = {
  build: BuildIdentity;
  content: ContentManifest;
  admit: AdmissionPolicy;
  port?: number;
  host?: string;
  worldDefaults?: Readonly<{ seed?: number; initialTick?: number; mode?: GameMode }>;
  allowedOrigins?: readonly string[];
  resolveOwner?: OwnerResolver;
  roomPolicy?: RoomPolicyReader;
  sessions?: SessionProjection;
  control?: ControlPolicy;
  api?: Readonly<
    Record<
      string,
      (
        request: IncomingMessage,
        body: unknown,
        response: ServerResponse,
        context?: GatewayApiContext,
      ) => Promise<unknown>
    >
  >;
  persistence?: PersistencePorts & {
    resolveOwner?: (room: string, id: string) => Promise<AdmittedActor | null>;
  };
  handleClient?: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void;
  /** Trusted external transport; its owner closes all accepted sockets on drain. */
  upgradeClient?: (request: IncomingMessage, socket: Duplex, head: Buffer) => boolean;
  onEvent?: (event: string, context: Record<string, string | number | boolean>) => void;
};
type RoomHandle = {
  sessionId: string;
  instanceId: string;
  startedAt: number;
  retirementReason?: string;
  worker: Worker;
  ready: Promise<void>;
  connections: Set<string>;
  revocations: Map<string, number>;
  closing: boolean;
  heartbeat: number;
  worldId: string;
  durability: RoomDurability | null;
  rejectStartup: () => void;
  retiring: boolean;
  ending: boolean;
  idle: Promise<void> | null;
  hasJoined: boolean;
  projection: SessionOutbox | null;
  controlBusy: Promise<void> | null;
  staffPending: {
    requestId: string;
    revision: number;
    resolve(value: StaffResult): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  } | null;
};
export async function createGateway(options: GatewayOptions) {
  if (options.sessions && (!options.persistence || !options.roomPolicy))
    throw new Error('session projection requires durable ownership and lifecycle policy');
  if (options.control && !options.sessions)
    throw new Error('control requires authoritative session projection');
  const apiRoutes = new Map(Object.entries(options.api ?? {}));
  for (const path of apiRoutes.keys())
    if (
      !/^\/api\/voxel\/[a-z-]+$/.test(path) ||
      ['/api/voxel/admission', '/api/voxel/control'].includes(path)
    )
      throw new Error('invalid service API route');
  const commandQueues = new Map<string, Promise<void>>();
  const resolveOwner = options.resolveOwner ?? options.persistence?.resolveOwner;
  if (
    options.build.protocol !== PROTOCOL ||
    options.build.environmentVersion !== ENVIRONMENT_VERSION ||
    options.content.hash !== options.build.contentHash
  )
    throw new Error('incompatible server content/protocol');
  const seed = options.worldDefaults?.seed,
    initialTick = options.worldDefaults?.initialTick ?? 0,
    mode = options.worldDefaults?.mode ?? 'creative';
  if (
    (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) ||
    !Number.isSafeInteger(initialTick) ||
    initialTick < 0 ||
    !['creative', 'survival'].includes(mode)
  )
    throw new Error('invalid world defaults');
  const wasm = await readFile(
    new URL(
      import.meta.url.endsWith('.ts') ? '../../engine/pkg/voxel_engine_bg.wasm' : './engine.wasm',
      import.meta.url,
    ),
  );
  if (createHash('sha256').update(wasm).digest('hex') !== options.build.engineHash)
    throw new Error('incompatible server engine artifact');
  const module = await WebAssembly.compile(wasm);
  const rooms = new Map<string, RoomHandle>(),
    admitting = new Map<string, number>(),
    allocations = new Map<string, Promise<RoomHandle>>(),
    connections = new Map<
      string,
      { socket: WebSocket; room: RoomHandle | null; authorization: ConnectionAuthorization | null }
    >(),
    tickets = new Map<
      string,
      {
        grant: AdmissionGrant;
        actor: AdmittedActor;
        room: string;
        expires: number;
        admissionId: string;
      }
    >();
  let draining = false;
  const chunkDrains = new Map<string, number>();
  let chunkDrainFlush: ReturnType<typeof setImmediate> | null = null;
  const columnDrained = (connection: string, bytes: number) => {
    if (draining) return;
    chunkDrains.set(connection, (chunkDrains.get(connection) ?? 0) + bytes);
    if (chunkDrainFlush) return;
    chunkDrainFlush = setImmediate(() => {
      chunkDrainFlush = null;
      for (const [id, count] of chunkDrains) {
        const room = connections.get(id)?.room;
        if (room && !room.closing)
          room.worker.postMessage({
            type: 'column-drained',
            connection: id,
            bytes: count,
          } satisfies ToRoom);
      }
      chunkDrains.clear();
    });
  };
  const event = (name: string, context: Record<string, string | number | boolean> = {}) => {
    if (
      typeof context.connectionId === 'string' &&
      [
        'VOXEL_ACTOR_DISCONNECTED',
        'VOXEL_CONNECTION_FAILED',
        'VOXEL_BACKPRESSURE_RECOVERY',
      ].includes(name)
    ) {
      const socket = connections.get(context.connectionId)?.socket;
      const state = socket && socketContexts.get(socket);
      if (state) state.reportedEvent = name;
    }
    options.onEvent?.(name, { buildId: options.build.buildId, ...context });
  };
  const roomContext = (handle: RoomHandle) => ({
    room: handle.sessionId,
    worldId: handle.worldId,
    roomInstanceId: handle.instanceId,
  });
  const socketContexts = new WeakMap<WebSocket, Record<string, string | number | boolean>>();
  const closeSocket = (socket: WebSocket, code: number, reason = 'policy_rejected') => {
    const context = socketContexts.get(socket);
    if (context && !context.reason) context.reason = reason.replaceAll(' ', '_');
    socket.close(code, reason);
  };
  const allowedOrigin = (req: IncomingMessage) =>
    !req.headers.origin ||
    options.allowedOrigins?.includes(req.headers.origin) ||
    req.headers.origin === `http://${req.headers.host}` ||
    req.headers.origin === `https://${req.headers.host}`;
  const reply = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  const failRoom = (
    handle: RoomHandle,
    reason = 'room_failure',
    details: Record<string, string> = {},
  ) => {
    if (handle.closing) return;
    handle.closing = true;
    handle.retirementReason = reason;
    if (handle.staffPending) {
      clearTimeout(handle.staffPending.timer);
      handle.staffPending.reject(new Error('staff outcome unconfirmed'));
      handle.staffPending = null;
    }
    handle.rejectStartup();
    handle.projection?.close();
    for (const id of handle.connections) {
      const c = connections.get(id);
      if (c) {
        c.socket.send(
          JSON.stringify({
            type: 'error',
            code: 'RECOVERING',
            retryable: true,
          } satisfies ServerMessage),
        );
        const state = socketContexts.get(c.socket);
        if (state) state.reportedEvent = 'VOXEL_ROOM_FAILED';
        closeSocket(c.socket, 1012, 'recovering');
      }
    }
    for (const [key, value] of rooms) if (value === handle) rooms.delete(key);
    event('VOXEL_ROOM_FAILED', {
      ...roomContext(handle),
      reason,
      ...details,
      connections: handle.connections.size,
    });
    void handle.worker
      .terminate()
      .then(
        () => handle.durability?.close(),
        () => handle.durability?.close(),
      )
      .catch(() => event('VOXEL_LEASE_RELEASE_FAILED', roomContext(handle)));
  };
  const detach = (id: string) => {
    chunkDrains.delete(id);
    const entry = connections.get(id);
    if (!entry) return;
    entry.authorization?.close();
    const room = entry.room;
    entry.room = null;
    room?.connections.delete(id);
    room?.worker.postMessage({ type: 'leave', connection: id } satisfies ToRoom);
    if (
      !draining &&
      room &&
      (room.durability || options.roomPolicy) &&
      !room.closing &&
      !room.connections.size
    )
      void retireRoom(room);
  };
  const apiContext: GatewayApiContext = Object.freeze({
    actor(roomId: string, actorId: string) {
      const room = rooms.get(roomId);
      if (draining || !room || room.closing || room.retiring || !room.durability?.owned())
        return null;
      for (const id of room.connections) {
        const entry = connections.get(id),
          authorization = entry?.authorization;
        if (
          !entry ||
          entry.socket.readyState !== WebSocket.OPEN ||
          !authorization ||
          authorization.actorId !== actorId ||
          !authorization.valid()
        )
          continue;
        const remaining = Math.min(
          5000,
          authorization.until - performance.now(),
          room.durability.ownershipDeadline - performance.now(),
        );
        if (remaining <= 0) continue;
        const lease = room.durability.ownership;
        return Object.freeze({
          connection: id,
          role: authorization.actorRole,
          admissionRevision: authorization.admissionRevision,
          expiresAt: Date.now() + remaining,
          worldId: lease.worldId,
          owner: lease.owner,
          epoch: lease.epoch,
        });
      }
      return null;
    },
    revoke(roomId: string, actor: string, revision: number) {
      if (
        !/^[a-zA-Z0-9_-]{1,64}$/.test(roomId) ||
        !actor.length ||
        actor.length > 128 ||
        !Number.isSafeInteger(revision) ||
        revision < 1
      )
        throw new Error('invalid actor revocation');
      const room = rooms.get(roomId);
      if (!room || room.closing) return;
      const cutoff = Math.max(room.revocations.get(actor) ?? 0, revision);
      room.revocations.set(actor, cutoff);
      let revoked = 0;
      for (const id of room.connections) {
        const entry = connections.get(id),
          authorization = entry?.authorization;
        if (
          !entry ||
          !authorization ||
          authorization.actorId !== actor ||
          authorization.admissionRevision >= cutoff
        )
          continue;
        if (entry.socket.readyState === WebSocket.OPEN)
          entry.socket.send(
            JSON.stringify({
              type: 'error',
              code: 'UNAUTHORIZED',
              retryable: false,
            } satisfies ServerMessage),
          );
        // Stop publication/input immediately and queue leave before any later
        // checkpoint/join. The normal last-leave save/retirement remains owned.
        detach(id);
        closeSocket(entry.socket, 1008, 'room access revoked');
        revoked++;
      }
      event('VOXEL_ACTOR_REVOKED', {
        ...roomContext(room),
        revision: cutoff,
        connections: revoked,
      });
    },
  });
  async function roomFor(id: string): Promise<RoomHandle> {
    const existing = rooms.get(id);
    if (existing) {
      if (existing.retiring) {
        await retireRoom(existing);
        return roomFor(id);
      }
      await existing.ready;
      if (existing.closing) throw new Error('room recovering');
      return existing;
    }
    const pending = allocations.get(id);
    if (pending) return pending;
    const allocation = allocate(id);
    allocations.set(id, allocation);
    try {
      return await allocation;
    } finally {
      if (allocations.get(id) === allocation) allocations.delete(id);
    }
  }
  function retireRoom(handle: RoomHandle): Promise<void> {
    if (handle.idle) return handle.idle;
    if (handle.closing) return Promise.resolve();
    if (!handle.retiring) {
      handle.retirementReason = handle.ending
        ? 'session_ended'
        : handle.hasJoined
          ? 'last_connection_left'
          : 'admission_cancelled';
      event('VOXEL_ROOM_RETIRING', {
        ...roomContext(handle),
        reason: handle.retirementReason,
        duration_ms: Math.round(performance.now() - handle.startedAt),
      });
    }
    handle.retiring = true;
    if (handle.controlBusy) {
      const waiting = handle.controlBusy.then(() => retireRoom(handle));
      void waiting.catch(() => event('VOXEL_DEFERRED_RETIREMENT_FAILED', roomContext(handle)));
      return waiting;
    }
    const task = (async () => {
      if (!handle.ending && handle.hasJoined) await handle.durability?.save(true);
      await handle.projection?.finish();
      if (handle.closing) return;
      handle.closing = true;
      handle.rejectStartup();
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(
          () =>
            void handle.worker.terminate().then(
              () => resolve(),
              () => resolve(),
            ),
          3000,
        );
        handle.worker.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
        handle.worker.postMessage({ type: 'stop' } satisfies ToRoom);
      });
      await handle.durability?.close();
      for (const [key, value] of rooms) if (value === handle) rooms.delete(key);
      event(
        handle.ending
          ? 'VOXEL_SESSION_ENDED'
          : handle.durability
            ? handle.hasJoined
              ? 'VOXEL_ROOM_SAVED_AND_RELEASED'
              : 'VOXEL_UNUSED_ROOM_RELEASED'
            : 'VOXEL_EMPTY_ROOM_STOPPED',
        {
          ...roomContext(handle),
          reason: handle.retirementReason ?? 'retired',
        },
      );
    })().finally(() => {
      handle.idle = null;
      if (handle.closing) for (const [key, value] of rooms) if (value === handle) rooms.delete(key);
    });
    handle.idle = task;
    void task.catch(() => event('VOXEL_CHECKPOINT_FAILED', roomContext(handle)));
    return task;
  }
  async function allocate(id: string): Promise<RoomHandle> {
    let durability: RoomDurability | null = null,
      handle: RoomHandle | null = null,
      ownershipLost = false;
    const loadStarted = performance.now(),
      timings: Record<string, number> = {};
    let loadPhase = 'ownership';
    const measure = async <T>(phase: string, work: () => Promise<T>): Promise<T> => {
      loadPhase = phase;
      const started = performance.now();
      try {
        return await work();
      } finally {
        timings[`${phase}_ms`] = Math.round(performance.now() - started);
      }
    };
    try {
      if (options.persistence)
        durability = await measure('ownership', () =>
          RoomDurability.acquire(
            options.persistence!,
            options.content,
            options.build,
            id,
            randomUUID(),
            () => {
              ownershipLost = true;
              if (handle) failRoom(handle, 'ownership_lost');
            },
          ),
        );
      if (options.sessions && durability)
        await measure('session_initialize', () =>
          options.sessions!.initialize(durability!.ownership),
        );
      const snapshot = durability
        ? await measure('checkpoint_load', () => durability!.load())
        : null;
      let start: RoomWorkerData['start'];
      const worldId = durability?.worldId ?? randomUUID();
      if (snapshot) {
        const ids = [
          ...new Set(
            Explosives.fromCheckpoint(options.content, snapshot.explosives)
              .checkpoint(options.content)
              .entries.map((body) => body.owner),
          ),
        ];
        if (ids.length && !resolveOwner)
          throw new Error('restored explosive owner resolver unavailable');
        const owners = ids.length
          ? await measure('owner_policy', () => resolveOwnerAuthorizations(resolveOwner!, id, ids))
          : [];
        start = { type: 'restore', checkpoint: snapshot, owners };
      } else
        start = {
          type: 'fresh',
          worldId,
          // School metadata reserves unique seeds transactionally. Standalone
          // development ports derive a stable seed from their world identity.
          seed:
            seed ??
            durability?.ownership.seed ??
            createHash('sha256').update(worldId).digest().readUInt32LE(0),
          initialTick,
          mode,
        };
      if (draining || ownershipLost || (durability && !durability.owned()))
        throw new Error('room ownership unavailable');
      loadPhase = 'worker_startup';
      handle = spawnRoom(id, worldId, start, durability, {
        started: loadStarted,
        restored: !!snapshot,
        timings,
      });
      await handle.ready;
      if (draining || handle.closing || (durability && !durability.owned()))
        throw new Error('room startup cancelled');
      return handle;
    } catch (error) {
      if (handle) failRoom(handle, 'allocation_failed', failureDetails(error));
      else {
        event('VOXEL_ROOM_LOAD_FAILED', {
          room: id,
          phase: loadPhase,
          duration_ms: Math.round(performance.now() - loadStarted),
          ...timings,
          ...failureDetails(error),
        });
        await durability?.close().catch(() => event('VOXEL_LEASE_RELEASE_FAILED'));
      }
      throw error;
    }
  }
  function spawnRoom(
    id: string,
    worldId: string,
    start: RoomWorkerData['start'],
    durability: RoomDurability | null,
    load: { started: number; restored: boolean; timings: Record<string, number> },
  ): RoomHandle {
    // Allocation is idempotent. No room-count or player-count ceilings participate.
    const worker = new Worker(
      new URL(
        import.meta.url.endsWith('.ts') ? './room-worker.ts' : './room-worker.js',
        import.meta.url,
      ),
      {
        workerData: {
          module,
          start,
          ...(durability ? { ownershipDeadline: durability.ownershipDeadline } : {}),
          refreshOwners: !!resolveOwner,
          enforceLifecycle: !!options.roomPolicy,
          projectSession: !!options.sessions,
          build: options.build,
          content: options.content,
        } satisfies RoomWorkerData,
      },
    );
    let resolve!: () => void, reject!: (error: Error) => void;
    const ready = new Promise<void>((r, j) => {
      resolve = r;
      reject = j;
    });
    const handle: RoomHandle = {
      sessionId: id,
      instanceId: randomUUID(),
      startedAt: performance.now(),
      worker,
      ready,
      connections: new Set(),
      revocations: new Map(),
      closing: false,
      heartbeat: Date.now(),
      worldId,
      durability,
      rejectStartup: () => reject(new Error('room failed')),
      retiring: false,
      ending: false,
      idle: null,
      hasJoined: false,
      controlBusy: null,
      staffPending: null,
      projection:
        options.sessions && durability
          ? new SessionOutbox(
              (sequence, view) => options.sessions!.project(durability.ownership, sequence, view),
              () => event('VOXEL_SESSION_PROJECTION_FAILED', roomContext(handle)),
            )
          : null,
    };
    rooms.set(id, handle);
    durability?.attach((message) => worker.postMessage(message));
    const deadline = setTimeout(() => {
      reject(new Error('room startup timed out'));
      failRoom(handle, 'startup_timeout');
    }, 15000);
    worker.on('message', (message: FromRoom) => {
      if (handle.closing || (durability && !durability.owned())) return;
      if (message.type === 'staff-result') {
        const pending = handle.staffPending;
        if (pending?.requestId === message.requestId && pending.revision === message.revision) {
          clearTimeout(pending.timer);
          handle.staffPending = null;
          pending.resolve(message.result);
        }
      } else if (message.type === 'ready') {
        handle.heartbeat = Date.now();
        clearTimeout(deadline);
        resolve();
        event('VOXEL_ROOM_READY', {
          ...roomContext(handle),
          restored: load.restored,
          load_ms: Math.round(performance.now() - load.started),
          ...load.timings,
          duration_ms: Math.round(performance.now() - handle.startedAt),
        });
      } else if (message.type === 'room-policy-needed') {
        const unavailable = () => {
          if (!handle.closing && (!durability || durability.owned()))
            worker.postMessage({
              type: 'room-policy-unavailable',
              requestId: message.requestId,
            } satisfies ToRoom);
        };
        if (!options.roomPolicy || draining || performance.now() >= message.deadline) {
          unavailable();
          return;
        }
        void Promise.resolve()
          .then(() => options.roomPolicy!(id))
          .then(
            (value) => {
              if (handle.closing || (durability && !durability.owned())) return;
              try {
                const now = Date.now(),
                  policy = readRoomPolicy(value, now),
                  until = Math.min(message.deadline, performance.now() + policy.expiresAt - now);
                if (performance.now() >= until) {
                  unavailable();
                  return;
                }
                worker.postMessage({
                  type: 'room-policy',
                  requestId: message.requestId,
                  state: policy.state,
                  deadline: until,
                } satisfies ToRoom);
              } catch {
                unavailable();
              }
            },
            () => {
              event('VOXEL_ROOM_POLICY_UNAVAILABLE', roomContext(handle));
              unavailable();
            },
          );
      } else if (message.type === 'session-projection') {
        handle.projection?.offer(message);
      } else if (message.type === 'session-ended') {
        handle.ending = true;
        handle.projection?.offer({ state: 'ended', participants: [] });
        void retireRoom(handle);
      } else if (message.type === 'owner-authorization-needed') {
        const unavailable = () => {
          if (!handle.closing && (!durability || durability.owned()))
            worker.postMessage({
              type: 'owner-authorization-unavailable',
              requestId: message.requestId,
            } satisfies ToRoom);
        };
        if (!resolveOwner || draining || performance.now() >= message.deadline) {
          unavailable();
          return;
        }
        void resolveOwnerAuthorizations(resolveOwner, id, message.owners).then(
          (owners) => {
            if (handle.closing || (durability && !durability.owned())) return;
            if (performance.now() >= message.deadline) {
              unavailable();
              return;
            }
            worker.postMessage({
              type: 'owner-authorization',
              requestId: message.requestId,
              owners,
              deadline: message.deadline,
            } satisfies ToRoom);
          },
          () => {
            event('VOXEL_OWNER_POLICY_UNAVAILABLE', roomContext(handle));
            unavailable();
          },
        );
      } else if (message.type === 'fault') {
        reject(new Error('room failed'));
        failRoom(handle, message.reason ?? 'worker_fault', {
          failureType: message.failureType ?? 'unknown',
        });
      } else if (message.type === 'metrics') {
        handle.heartbeat = Date.now();
        const timings: Record<string, number> = {};
        for (const [kind, summary] of Object.entries(message.timings))
          for (const [measure, value] of Object.entries(summary))
            timings[`${kind}_${measure}`] = value;
        event('VOXEL_ROOM_METRICS', {
          ...roomContext(handle),
          ticks: message.ticks,
          columns: message.columns,
          overrunMs: message.overrunMs,
          windowMs: message.windowMs,
          windowStartedAtMs: message.windowStartedAtMs,
          windowEndedAtMs: message.windowEndedAtMs,
          ...timings,
        });
      } else if (message.type === 'checkpoint' || message.type === 'checkpoint-failed') {
        durability?.receive(message);
      } else {
        const c = connections.get(message.connection);
        if (!c || c.room !== handle || c.socket.readyState !== WebSocket.OPEN) return;
        if (message.type === 'close') {
          // Preserve the policy's terminal recess reason if the worker expires first.
          if (message.cause === 'authorization_expired' && !c.authorization?.valid()) return;
          if (message.reason === 'SESSION_ENDED') handle.ending = true;
          event('VOXEL_ACTOR_DISCONNECTED', {
            ...roomContext(handle),
            ...socketContexts.get(c.socket),
            reason: message.reason,
            origin: 'worker',
            ...(message.cause ? { cause: message.cause, authorizationFailure: 'expired' } : {}),
          });
          detach(message.connection);
          c.socket.send(
            JSON.stringify({
              type: 'error',
              code: message.reason,
              retryable: message.reason === 'RECOVERING',
            } satisfies ServerMessage),
          );
          closeSocket(
            c.socket,
            message.reason === 'RECOVERING'
              ? 1012
              : ['UNAUTHORIZED', 'SESSION_ENDED'].includes(message.reason)
                ? 1008
                : 4001,
            message.reason.toLowerCase(),
          );
        } else {
          if (!c.authorization?.valid()) return;
          // Preserve the ordered delta stream until the shared recovery budget
          // is exceeded. Dropping an unsent snapshot would lose its actor changes.
          const bufferedBytes = c.socket.bufferedAmount;
          if (bufferedBytes > 1024 * 1024) {
            event('VOXEL_BACKPRESSURE_RECOVERY', {
              ...roomContext(handle),
              ...socketContexts.get(c.socket),
              bufferedBytes,
            });
            closeSocket(c.socket, 1013, 'resynchronize');
            return;
          }
          c.socket.send(
            message.payload,
            { binary: typeof message.payload !== 'string' },
            (error) => {
              if (error) c.socket.terminate();
              else if (
                message.kind === 'column' &&
                typeof message.payload !== 'string' &&
                connections.get(message.connection)?.room === handle
              )
                columnDrained(message.connection, message.payload.byteLength);
            },
          );
        }
      }
    });
    worker.on('error', (error) => {
      clearTimeout(deadline);
      reject(new Error('room worker error'));
      failRoom(handle, 'worker_error', failureDetails(error));
    });
    worker.on('exit', (code) => {
      clearTimeout(deadline);
      const expected = handle.closing;
      if (!expected) {
        reject(new Error('room exited'));
        failRoom(handle, 'unexpected_exit');
      }
      event('VOXEL_ROOM_EXITED', {
        ...roomContext(handle),
        code,
        expected,
        reason: handle.retirementReason ?? 'unexpected_exit',
      });
    });
    // Startup rejection is also observed when a client disconnects before awaiting admission.
    void ready.catch(() => {});
    return handle;
  }
  async function executeControl(grant: ControlGrant): Promise<unknown> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(grant.room)) throw new Error('invalid control room');
    const previous = commandQueues.get(grant.room) ?? Promise.resolve();
    const task = previous.then(async () => {
      if (draining) throw new Error('service draining');
      const room = await roomFor(grant.room);
      if (!room.durability || room.closing || !room.durability.owned())
        throw new Error('durable control room unavailable');
      let release!: () => void;
      room.controlBusy = new Promise<void>((resolve) => (release = resolve));
      try {
        return await grant.execute({
          lease: room.durability.ownership,
          staff: (request) => {
            const now = Date.now(),
              remaining = request.expiresAt - now;
            if (
              !room.durability!.owned() ||
              room.closing ||
              room.staffPending ||
              !Number.isFinite(remaining) ||
              remaining <= 0 ||
              remaining > 5000
            )
              throw new Error('staff authority unavailable');
            return new Promise<StaffResult>((resolve, reject) => {
              const timer = setTimeout(() => {
                if (room.staffPending?.requestId === request.requestId) room.staffPending = null;
                reject(new Error('staff outcome unconfirmed'));
              }, remaining);
              room.staffPending = {
                requestId: request.requestId,
                revision: request.revision,
                resolve,
                reject,
                timer,
              };
              room.worker.postMessage({
                type: 'staff',
                requestId: request.requestId,
                revision: request.revision,
                actorId: request.actorId,
                command: request.command,
                deadline: performance.now() + remaining,
              } satisfies ToRoom);
            });
          },
          savePaused: () => room.durability!.save(true),
          resume: () => {
            if (!room.durability!.owned() || room.closing) throw new Error('room ownership lost');
            room.worker.postMessage({ type: 'resume', confirmed: true } satisfies ToRoom);
          },
          end: () => {
            if (!room.durability!.owned() || room.closing) throw new Error('room ownership lost');
            room.ending = true;
            room.worker.postMessage({ type: 'end' } satisfies ToRoom);
          },
        });
      } finally {
        room.controlBusy = null;
        release();
        if (!draining && !room.closing && !room.connections.size) void retireRoom(room);
      }
    });
    // The awaiting HTTP handler reports failure. A failed command must not poison
    // later authorized commands in this room's ordering queue.
    const tail = task.then(
      () => {},
      () => {},
    );
    commandQueues.set(grant.room, tail);
    try {
      return await task;
    } finally {
      if (commandQueues.get(grant.room) === tail) commandQueues.delete(grant.room);
    }
  }
  const http = createServer((req, res) => {
    const correlationId = randomUUID();
    res.setHeader('x-correlation-id', correlationId);
    void (async () => {
      if (req.url === '/health') {
        reply(res, 200, { ok: true });
        return;
      }
      if (req.url === '/ready') {
        reply(res, draining ? 503 : 200, { ready: !draining });
        return;
      }
      if (
        (req.url !== '/api/voxel/admission' &&
          !(req.url === '/api/voxel/control' && options.control) &&
          !apiRoutes.has(req.url ?? '')) ||
        (req.method !== 'POST' && req.method !== 'OPTIONS')
      ) {
        if (req.method === 'GET' && options.handleClient) {
          await options.handleClient(req, res);
          return;
        }
        reply(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      if (!allowedOrigin(req)) {
        reply(res, 403, { error: 'ORIGIN' });
        return;
      }
      res.setHeader('Vary', 'Origin');
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      if (req.method === 'OPTIONS') {
        const method = req.headers['access-control-request-method'];
        const headers = req.headers['access-control-request-headers'];
        if (
          (method !== undefined && method !== 'POST') ||
          (headers !== undefined &&
            (typeof headers !== 'string' ||
              headers
                .split(',')
                .some(
                  (header) =>
                    !['authorization', 'content-type'].includes(header.trim().toLowerCase()),
                )))
        ) {
          reply(res, 403, { error: 'ORIGIN' });
          return;
        }
        res.writeHead(204, {
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Cache-Control': 'no-store',
        });
        res.end();
        return;
      }
      if (draining) {
        reply(res, 503, { error: 'RECOVERING' });
        return;
      }
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2048) {
          reply(res, 413, { error: 'TOO_LARGE' });
          return;
        }
      }
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        reply(res, 400, { error: 'INVALID' });
        return;
      }
      const serviceApi = apiRoutes.get(req.url ?? '');
      if (serviceApi) {
        const result = await serviceApi(req, body, res, apiContext);
        if (!res.writableEnded) reply(res, 200, result);
        return;
      }
      if (req.url === '/api/voxel/control') {
        const grant = await options.control!(req, body, res);
        if (res.writableEnded) return;
        if (!grant) {
          reply(res, 403, { error: 'UNAUTHORIZED' });
          return;
        }
        try {
          const result = await executeControl(grant);
          if (!res.writableEnded) reply(res, 200, result);
        } catch {
          event('VOXEL_CONTROL_FAILED');
          if (!res.writableEnded) reply(res, 503, { error: 'RECOVERING', saved: false });
        }
        return;
      }
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some(
          (key) => !['room', 'invitationCode', 'participation'].includes(key),
        ) ||
        !('room' in body) ||
        typeof body.room !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(body.room) ||
        ('invitationCode' in body &&
          (typeof body.invitationCode !== 'string' || body.invitationCode.length > 128)) ||
        ('participation' in body && !['player', 'observer'].includes(body.participation as string))
      ) {
        reply(res, 400, { error: 'INVALID' });
        return;
      }
      const input = body as AdmissionRequest;
      const admissionStartedAt = performance.now();
      const admissionId = correlationId;
      const grant = await options.admit(req, input, res);
      if (res.writableEnded) return;
      if (draining) {
        reply(res, 503, { error: 'RECOVERING' });
        return;
      }
      if (!grant || (grant.actor.role === 'observer' && !grant.actor.capabilities.observe)) {
        reply(res, 403, { error: 'UNAUTHORIZED' });
        return;
      }
      if (typeof grant.revalidate !== 'function')
        throw new Error('admission revalidation required');
      const initial = readAuthorization(
        { actor: grant.actor, expiresAt: grant.expiresAt },
        Date.now(),
      );
      const ticket = randomBytes(32).toString('base64url');
      tickets.set(ticket, {
        grant,
        admissionId,
        actor: initial.actor,
        room: body.room,
        expires: Date.now() + 30000,
      });
      reply(res, 200, { ticket, buildId: options.build.buildId });
      event('VOXEL_ADMISSION_ISSUED', {
        room: input.room,
        admissionId,
        duration_ms: Math.round(performance.now() - admissionStartedAt),
      });
    })().catch((error) => {
      event('VOXEL_HTTP_FAILED', { correlationId, ...failureDetails(error) });
      if (!res.headersSent) reply(res, 500, { error: 'INTERNAL' });
      else res.end();
    });
  });
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CONTROL_BYTES,
    perMessageDeflate: false,
  });
  http.on('upgrade', (req, socket, head) => {
    if (draining || !allowedOrigin(req)) {
      socket.destroy();
      return;
    }
    if (req.url !== '/voxel') {
      try {
        if (options.upgradeClient?.(req, socket, head)) return;
      } catch {
        event('VOXEL_CLIENT_UPGRADE_FAILED');
      }
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit('connection', ws));
  });
  sockets.on('connection', (socket) => {
    const id = randomUUID(),
      entry = {
        socket,
        room: null as RoomHandle | null,
        authorization: null as ConnectionAuthorization | null,
      };
    const startedAt = performance.now();
    const context: Record<string, string | number | boolean> = {
      connectionId: id,
      phase: 'awaiting_hello',
    };
    socketContexts.set(socket, context);
    connections.set(id, entry);
    let authenticated = false,
      joining = false,
      windowStart = Date.now(),
      messages = 0;
    let deadline = setTimeout(() => closeSocket(socket, 1008, 'hello timeout'), 5000);
    let progress: ReturnType<typeof setInterval> | null = null;
    let phaseStarted = performance.now();
    const measure = async <T>(phase: string, work: () => Promise<T>): Promise<T> => {
      context.phase = phase;
      phaseStarted = performance.now();
      try {
        return await work();
      } finally {
        context[`${phase}_ms`] =
          Number(context[`${phase}_ms`] ?? 0) + Math.round(performance.now() - phaseStarted);
      }
    };
    socket.on('error', () => {
      context.reason ??= 'transport_error';
      socket.terminate();
    });
    socket.on('close', (code, peerReason) => {
      if (!context.reason && [1000, 1001].includes(code)) {
        const reason = peerReason.toString();
        if (['client_left', 'client_reconnecting'].includes(reason)) context.reason = reason;
      }
      clearTimeout(deadline);
      if (progress) clearInterval(progress);
      event('VOXEL_CONNECTION_CLOSED', {
        ...context,
        code,
        phase_duration_ms: Math.round(performance.now() - phaseStarted),
        reason: context.reason ?? (authenticated ? 'peer_closed' : 'admission_interrupted'),
        duration_ms: Math.round(performance.now() - startedAt),
      });
      detach(id);
      connections.delete(id);
    });
    socket.on('message', (bytes, binary) => {
      void (async () => {
        if (Date.now() - windowStart >= 1000) {
          windowStart = Date.now();
          messages = 0;
        }
        if (++messages > 300 || binary) {
          closeSocket(socket, 1008, 'invalid control stream');
          return;
        }
        const message = parseClientMessage(bytes.toString());
        if (!message) {
          socket.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID',
              retryable: false,
            } satisfies ServerMessage),
          );
          return;
        }
        if (!authenticated) {
          if (joining || message.type !== 'hello') {
            closeSocket(socket, 1008, 'admission required');
            return;
          }
          joining = true;
          const ticket = tickets.get(message.ticket);
          tickets.delete(message.ticket);
          if (ticket)
            Object.assign(context, { room: ticket.room, admissionId: ticket.admissionId });
          if (!ticket || ticket.expires < Date.now()) {
            socket.send(
              JSON.stringify({
                type: 'error',
                code: 'UNAUTHORIZED',
                retryable: false,
              } satisfies ServerMessage),
            );
            closeSocket(socket, 1008, ticket ? 'ticket expired' : 'ticket invalid');
            return;
          }
          if (message.buildId !== options.build.buildId) {
            socket.send(
              JSON.stringify({
                type: 'error',
                code: 'INCOMPATIBLE',
                retryable: false,
              } satisfies ServerMessage),
            );
            closeSocket(socket, 1008, 'build incompatible');
            return;
          }
          clearTimeout(deadline);
          const loading = () => {
            if (socket.readyState === WebSocket.OPEN && !authenticated)
              socket.send(JSON.stringify({ type: 'joining' } satisfies ServerMessage));
          };
          loading();
          progress = setInterval(loading, 2000);
          deadline = setTimeout(() => {
            if (socket.readyState !== WebSocket.OPEN) return;
            socket.send(
              JSON.stringify({
                type: 'error',
                code: 'RECOVERING',
                retryable: true,
              } satisfies ServerMessage),
            );
            closeSocket(socket, 1013, 'join timeout');
          }, 30000);
          admitting.set(ticket.room, (admitting.get(ticket.room) ?? 0) + 1);
          try {
            const validate = async (): Promise<Authorization | null> => {
              const next = await measure('revalidating', () => ticket.grant.revalidate('ticket'));
              return next === null ? null : readAuthorization(next, Date.now(), ticket.actor.id);
            };
            let authorization = await validate();
            if (!authorization) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  code: 'UNAUTHORIZED',
                  retryable: false,
                } satisfies ServerMessage),
              );
              closeSocket(socket, 1008, 'authorization denied');
              return;
            }
            let room: RoomHandle;
            let acceptedBy: RoomHandle | null = null;
            for (;;) {
              if (socket.readyState !== WebSocket.OPEN) return;
              room = await measure('allocating_room', () => roomFor(ticket.room));
              Object.assign(context, roomContext(room));
              if (socket.readyState !== WebSocket.OPEN) return;
              if (room.retiring) continue;
              if (authorization.expiresAt <= Date.now()) {
                authorization = await validate();
                if (!authorization) {
                  closeSocket(socket, 1008, 'authorization expired');
                  return;
                }
                // Every await can cross retirement/replacement; reacquire before attaching.
                continue;
              }
              if (options.sessions && room.durability && acceptedBy !== room) {
                await measure('accepting_membership', () =>
                  options.sessions!.accept(
                    room.durability!.ownership,
                    authorization!.actor,
                    authorization!,
                  ),
                );
                acceptedBy = room;
                // Authorization may expire or the allocation may retire during platform IO.
                continue;
              }
              break;
            }
            if (
              socket.readyState !== WebSocket.OPEN ||
              room.closing ||
              (room.durability && !room.durability.owned())
            )
              return;
            // A moderation transaction may commit while membership acceptance
            // IO is returning. Never attach that earlier admission afterward.
            if (
              (authorization.membershipRevision ?? 0) <
              (room.revocations.get(authorization.actor.id) ?? 0)
            ) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  code: 'UNAUTHORIZED',
                  retryable: false,
                } satisfies ServerMessage),
              );
              closeSocket(socket, 1008, 'room access revoked');
              return;
            }
            context.phase = 'active';
            phaseStarted = performance.now();
            context.actorId = authorization.actor.id;
            context.role = authorization.actor.role;
            Object.assign(context, roomContext(room));
            entry.room = room;
            room.hasJoined = true;
            room.connections.add(id);
            authenticated = true;
            clearTimeout(deadline);
            entry.authorization = new ConnectionAuthorization(
              ticket.grant,
              authorization,
              (until) =>
                entry.room?.worker.postMessage({
                  type: 'authorization',
                  connection: id,
                  deadline: until,
                } satisfies ToRoom),
              (reason, detail) => {
                event('VOXEL_ACTOR_DISCONNECTED', {
                  ...context,
                  ...roomContext(room),
                  reason,
                  origin: 'authorization',
                  ...detail,
                });
                detach(id);
                if (socket.readyState === WebSocket.OPEN)
                  socket.send(
                    JSON.stringify({
                      type: 'error',
                      code: reason,
                      retryable: reason === 'RECOVERING',
                    } satisfies ServerMessage),
                  );
                closeSocket(socket, reason === 'RECOVERING' ? 1012 : 1008, reason.toLowerCase());
              },
            );
            room.worker.postMessage({
              type: 'join',
              actor: authorization.actor,
              connection: id,
              authorizationUntil: entry.authorization.until,
            } satisfies ToRoom);
            event('VOXEL_ADMISSION_ACCEPTED', {
              ...context,
              duration_ms: Math.round(performance.now() - startedAt),
              connections: room.connections.size,
            });
            return;
          } finally {
            clearTimeout(deadline);
            if (progress) clearInterval(progress);
            progress = null;
            const remaining = (admitting.get(ticket.room) ?? 1) - 1;
            if (remaining) admitting.set(ticket.room, remaining);
            else admitting.delete(ticket.room);
            const handle = rooms.get(ticket.room);
            if (
              !draining &&
              !remaining &&
              handle &&
              !handle.closing &&
              !handle.connections.size &&
              (!handle.hasJoined || handle.durability || options.roomPolicy)
            )
              void retireRoom(handle);
          }
        }
        if (message.type === 'hello') {
          closeSocket(socket, 1008, 'ticket already used');
          return;
        }
        if (!entry.room || !entry.authorization?.valid()) {
          closeSocket(socket, 1008, 'authorization expired');
          return;
        }
        if (entry.room.closing || (entry.room.durability && !entry.room.durability.owned())) {
          closeSocket(socket, 1012, 'recovering');
          return;
        }
        entry.room!.worker.postMessage({
          type: 'message',
          connection: id,
          message,
        } satisfies ToRoom);
      })().catch((error) => {
        const ended = isSessionEnded(error);
        event('VOXEL_CONNECTION_FAILED', {
          ...context,
          reason: ended ? 'session_ended' : 'connection_operation_failed',
          ...failureDetails(error),
        });
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({
              type: 'error',
              code: ended ? 'SESSION_ENDED' : 'RECOVERING',
              retryable: !ended,
            } satisfies ServerMessage),
          );
        closeSocket(socket, ended ? 1008 : 1012, ended ? 'session ended' : 'recovering');
      });
    });
  });
  const sweep = setInterval(() => {
    for (const [key, ticket] of tickets) if (ticket.expires < Date.now()) tickets.delete(key);
    for (const handle of rooms.values())
      if (Date.now() - handle.heartbeat > 25000) failRoom(handle, 'heartbeat_timeout');
  }, 5000);
  const autosave = setInterval(() => {
    for (const handle of rooms.values())
      if (handle.durability && !handle.closing && handle.retiring) void retireRoom(handle);
      else if (handle.durability && !handle.closing && !handle.ending)
        void handle.durability.save(false).then(
          (pointer) =>
            event('VOXEL_CHECKPOINT_COMMITTED', {
              ...roomContext(handle),
              sequence: pointer.sequence,
            }),
          () => event('VOXEL_CHECKPOINT_FAILED', roomContext(handle)),
        );
  }, 15000);
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      http.off('error', reject);
      resolve();
    });
  });
  return {
    http,
    sockets,
    rooms,
    address: http.address(),
    async save(room: string, pause = false) {
      const handle = rooms.get(room);
      if (!handle?.durability || handle.closing) throw new Error('durable room unavailable');
      return handle.durability.save(pause);
    },
    resume(room: string) {
      const handle = rooms.get(room);
      if (!handle || handle.closing || (handle.durability && !handle.durability.owned()))
        throw new Error('room unavailable');
      handle.worker.postMessage({ type: 'resume' } satisfies ToRoom);
    },
    async close() {
      draining = true;
      if (chunkDrainFlush) clearImmediate(chunkDrainFlush);
      chunkDrainFlush = null;
      chunkDrains.clear();
      clearInterval(sweep);
      clearInterval(autosave);
      tickets.clear();
      await Promise.allSettled([...commandQueues.values()]);
      await Promise.allSettled([...rooms.values()].map((handle) => handle.idle));
      const handles = [...rooms.values()];
      // A successful drain is acknowledged only after every requested pause checkpoint commits.
      const saved = await Promise.allSettled(
        handles.map(async (handle) => {
          if (!handle.ending && handle.hasJoined) await handle.durability?.save(true);
          await handle.projection?.finish();
        }),
      );
      for (const c of connections.values()) {
        const context = socketContexts.get(c.socket);
        if (context) context.reason = 'service_shutdown';
        c.socket.terminate();
      }
      const closed = new Promise<void>((resolve) => http.close(() => resolve()));
      const force = setTimeout(() => http.closeAllConnections(), 3500);
      for (const handle of rooms.values()) {
        handle.closing = true;
        handle.retirementReason = 'service_shutdown';
        handle.projection?.close();
        handle.worker.postMessage({ type: 'stop' } satisfies ToRoom);
      }
      await Promise.all(
        [...rooms.values()].map(
          (handle) =>
            new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                void handle.worker.terminate().then(
                  () => resolve(),
                  () => resolve(),
                );
              }, 3000);
              handle.worker.once('exit', () => {
                clearTimeout(timeout);
                resolve();
              });
            }),
        ),
      );
      await Promise.allSettled(handles.map((handle) => handle.durability?.close()));
      rooms.clear();
      await Promise.allSettled([...allocations.values()]);
      sockets.close();
      await closed;
      clearTimeout(force);
      for (const result of saved) if (result.status === 'rejected') throw result.reason;
    },
  };
}
