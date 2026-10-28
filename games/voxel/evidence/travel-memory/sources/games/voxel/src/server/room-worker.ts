import { ActionLedger } from '../sim/action-ledger.ts';
import { readStaffCommand } from '../shared/staff.ts';
import type { StaffResult } from '../shared/staff.ts';
import { parentPort, workerData } from 'node:worker_threads';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../../engine/pkg/voxel_engine.js';
import { GameRoom } from '../sim/game-room.ts';
import { WorldStore } from '../sim/world-store.ts';
import { encodeChunk } from '../shared/chunk-wire.ts';
import type { RoomPorts, AdmittedActor } from '../sim/game-room.ts';
import type { FromRoom, ToRoom, RoomWorkerData } from './room-worker-protocol.ts';
import { OWNER_AUTHORIZATION_MS } from './owner-authorization.ts';
import { readAuthorization } from './admission.ts';
import { ROOM_POLICY_MS } from './room-policy.ts';
import { SnapshotEncoder } from './snapshot-encoder.ts';
import { TimingHistogram } from './timing-histogram.ts';
import type { WorldState, PauseReason } from '../shared/lifecycle.ts';
const data = workerData as RoomWorkerData;
let ownershipDeadline = data.ownershipDeadline ?? Infinity;
const authorizations = new Map<string, number>();
if (!parentPort) throw new Error('room worker requires supervisor');
const send = (event: FromRoom) => parentPort!.postMessage(event);
try {
  if (ownershipDeadline <= performance.now() || Number.isNaN(ownershipDeadline))
    throw new Error('room ownership expired');
  const encoder = new SnapshotEncoder();
  const worldStep = new TimingHistogram(),
    observerStep = new TimingHistogram(),
    workerTurn = new TimingHistogram(),
    generationJob = new TimingHistogram(),
    command = new TimingHistogram();
  initSync({ module: data.module });
  set_content(JSON.stringify(data.content));
  const ports: RoomPorts = {
    onStep(kind, elapsedMs) {
      (kind === 'world' ? worldStep : observerStep).record(elapsedMs);
    },
    send(connection, event) {
      if (performance.now() >= ownershipDeadline) throw new Error('room ownership expired');
      const until = authorizations.get(connection);
      if (until === undefined || performance.now() >= until) return;
      if ('kind' in event) {
        const payload = encodeChunk(event);
        parentPort!.postMessage(
          { type: 'send', connection, kind: 'reliable', payload } satisfies FromRoom,
          [payload.buffer as ArrayBuffer],
        );
      } else
        send({
          type: 'send',
          connection,
          kind: event.type === 'snapshot' ? 'snapshot' : 'reliable',
          payload: encoder.encode(event),
        });
    },
    close: (connection, reason) => {
      authorizations.delete(connection);
      send({ type: 'close', connection, reason });
    },
  };
  let room: GameRoom;
  if (data.start.type === 'restore') {
    const owners = new Map<string, AdmittedActor | null>();
    for (const pair of data.start.owners) {
      if (!Array.isArray(pair) || pair.length !== 2 || owners.has(pair[0]))
        throw new Error('invalid restored owner resolution');
      owners.set(pair[0], pair[1]);
    }
    // Header validation in GameRoom precedes any generation or publication.
    const value = data.start.checkpoint as { seed: number };
    const world = new VoxelWorld(),
      generator = new TerrainGen(value.seed);
    try {
      room = GameRoom.fromCheckpoint(
        world,
        generator,
        data.content,
        data.build,
        ports,
        data.start.checkpoint,
        performance.now(),
        owners,
      );
    } catch (error) {
      world.free();
      generator.free();
      throw error;
    }
  } else if (data.start.type === 'fresh') {
    const start = data.start;
    room = new GameRoom(
      new WorldStore(new VoxelWorld(), new TerrainGen(start.seed)),
      data.content,
      data.build,
      ports,
      start.worldId,
      start.seed,
      performance.now(),
      start.initialTick,
      start.mode,
    );
  } else throw new Error('invalid room startup');
  const store = room.store;
  const staffLedger = new ActionLedger<StaffResult>(1);
  let policyState: WorldState = 'paused',
    policyUntil = 0,
    policySequence = 0,
    nextPolicyCheck = 0,
    terminalSent = false,
    manualPause = false;
  let pendingPolicy: { requestId: number; deadline: number } | null = null;
  const applyLifecycle = (now: number) => {
    if (!data.enforceLifecycle) return;
    if (policyState === 'ended') {
      room.end(now);
      if (!terminalSent) {
        terminalSent = true;
        send({ type: 'session-ended' });
      }
      return;
    }
    const participant = [...room.actors.values()].some(
      (actor) =>
        actor.connection &&
        actor.role === 'participant' &&
        (authorizations.get(actor.connection) ?? 0) > now,
    );
    const reason: PauseReason =
      now >= policyUntil
        ? 'policy_unavailable'
        : policyState === 'paused'
          ? 'session'
          : manualPause
            ? 'manual'
            : participant
              ? 'allowed'
              : 'no_participants';
    room.setPaused(reason !== 'allowed', now, reason);
  };
  const refreshPolicy = (now: number) => {
    if (!data.enforceLifecycle || terminalSent || pendingPolicy || now < nextPolicyCheck) return;
    if (policySequence === Number.MAX_SAFE_INTEGER)
      throw new Error('room policy sequence exhausted');
    pendingPolicy = { requestId: ++policySequence, deadline: now + ROOM_POLICY_MS };
    send({ type: 'room-policy-needed', ...pendingPolicy });
  };
  let nextProjection = 0,
    lastProjection = '',
    nextPresenceHeartbeat = 0;
  const projectSession = (now: number) => {
    if (!data.projectSession || now < nextProjection) return;
    nextProjection = now + 100;
    const view = {
      state: room.lifecycle().state,
      participants: [...room.actors.values()]
        .filter(
          (actor) =>
            actor.role === 'participant' &&
            actor.connection &&
            (authorizations.get(actor.connection) ?? 0) > now,
        )
        .map((actor) => actor.id)
        .sort(),
    };
    const key = JSON.stringify(view);
    if (key === lastProjection && now < nextPresenceHeartbeat) return;
    lastProjection = key;
    nextPresenceHeartbeat = now + 10000;
    send({ type: 'session-projection', ...view });
  };
  applyLifecycle(performance.now());
  if (data.refreshOwners) room.requireOwnerAuthorizations();
  let ownerRequest = 0,
    nextOwnerCheck = 0,
    ownerDeadline = 0,
    appliedOwners = '';
  let pendingOwners: { requestId: number; owners: readonly string[]; deadline: number } | null =
    null;
  const refreshOwners = (now: number) => {
    if (!data.refreshOwners || pendingOwners || now < nextOwnerCheck) return;
    nextOwnerCheck = now + 250;
    const owners = room.explosives.owners(),
      key = JSON.stringify(owners);
    if (!owners.length) {
      room.authorizeOwners([], now);
      appliedOwners = key;
      return;
    }
    if (key === appliedOwners && now < ownerDeadline - OWNER_AUTHORIZATION_MS / 2) return;
    if (ownerRequest === Number.MAX_SAFE_INTEGER)
      throw new Error('owner authorization sequence exhausted');
    pendingOwners = { requestId: ++ownerRequest, owners, deadline: now + OWNER_AUTHORIZATION_MS };
    send({ type: 'owner-authorization-needed', ...pendingOwners });
  };
  const expireAuthorizations = (now: number) => {
    for (const [connection, until] of authorizations)
      if (now >= until) {
        authorizations.delete(connection);
        room.disconnect(connection, now);
        send({ type: 'close', connection, reason: 'UNAUTHORIZED' });
      }
  };
  let ticks = 0,
    overrunMs = 0,
    closed = false,
    lastCheckpoint = 0;
  const close = (fault: boolean) => {
    if (closed) return;
    closed = true;
    if (fault) send({ type: 'fault' });
    clearInterval(timer);
    clearInterval(metrics);
    room.dispose();
    authorizations.clear();
    parentPort!.close();
    if (fault) process.exitCode = 1;
  };
  const timer = setInterval(() => {
    const started = performance.now();
    try {
      if (performance.now() >= ownershipDeadline) throw new Error('room ownership expired');
      expireAuthorizations(performance.now());
      applyLifecycle(performance.now());
      projectSession(performance.now());
      refreshPolicy(performance.now());
      refreshOwners(performance.now());
      const result = room.advance(performance.now());
      ticks += result.steps;
      overrunMs += result.droppedMs;
      const deadline = performance.now() + 4;
      while (performance.now() < deadline) {
        const jobStarted = performance.now();
        if (!store.generateOne()) break;
        generationJob.record(performance.now() - jobStarted);
      }
    } catch {
      close(true);
    } finally {
      workerTurn.record(performance.now() - started);
    }
  }, 4);
  let windowStarted = performance.now();
  const metrics = setInterval(() => {
    const now = performance.now();
    send({
      type: 'metrics',
      ticks,
      columns: store.world.column_count(),
      overrunMs,
      windowMs: now - windowStarted,
      windowStartedAtMs: windowStarted,
      windowEndedAtMs: now,
      timings: {
        worldStep: worldStep.take(),
        observerStep: observerStep.take(),
        workerTurn: workerTurn.take(),
        generationJob: generationJob.take(),
        command: command.take(),
      },
    });
    windowStarted = now;
    ticks = 0;
    overrunMs = 0;
  }, 10000);
  parentPort.on('message', (message: ToRoom) => {
    if (closed) return;
    const started = performance.now();
    try {
      if (performance.now() >= ownershipDeadline) throw new Error('room ownership expired');
      const now = performance.now();
      expireAuthorizations(now);
      applyLifecycle(now);
      if (message.type === 'staff') {
        const command = readStaffCommand(message.command);
        if (
          !command ||
          typeof message.requestId !== 'string' ||
          !message.requestId.length ||
          message.requestId.length > 128 ||
          typeof message.actorId !== 'string' ||
          !message.actorId.length ||
          message.actorId.length > 128 ||
          !Number.isSafeInteger(message.revision) ||
          message.revision < 1 ||
          !Number.isFinite(message.deadline) ||
          message.deadline > now + 5000
        )
          throw new Error('invalid staff command');
        const outcome = staffLedger.run(1, message.revision, () =>
          message.deadline <= performance.now()
            ? { ok: false, reason: 'expired' }
            : room.staff(message.actorId, command, performance.now()),
        );
        send({
          type: 'staff-result',
          requestId: message.requestId,
          revision: message.revision,
          result: 'value' in outcome ? outcome.value : { ok: false, reason: 'retired' },
        });
      } else if (message.type === 'join') {
        if (terminalSent) {
          send({ type: 'close', connection: message.connection, reason: 'SESSION_ENDED' });
          return;
        }
        if (!Number.isFinite(message.authorizationUntil))
          throw new Error('invalid actor authorization');
        if (message.authorizationUntil <= now) {
          send({ type: 'close', connection: message.connection, reason: 'UNAUTHORIZED' });
          return;
        }
        authorizations.set(message.connection, message.authorizationUntil);
        room.join(message.actor, message.connection, now);
        applyLifecycle(performance.now());
      } else if (message.type === 'authorization') {
        if (!Number.isFinite(message.deadline)) throw new Error('invalid actor authorization');
        if (authorizations.has(message.connection))
          authorizations.set(message.connection, message.deadline);
        expireAuthorizations(performance.now());
      } else if (message.type === 'owner-authorization-unavailable') {
        if (pendingOwners?.requestId !== message.requestId) return;
        pendingOwners = null;
        nextOwnerCheck = now + 500;
      } else if (message.type === 'owner-authorization') {
        const pending = pendingOwners;
        if (!pending || pending.requestId !== message.requestId) return;
        pendingOwners = null;
        nextOwnerCheck = now + 500;
        if (!Number.isFinite(message.deadline) || message.deadline > pending.deadline)
          throw new Error('invalid owner authorization deadline');
        if (message.deadline <= now) return;
        if (!Array.isArray(message.owners) || message.owners.length !== pending.owners.length)
          throw new Error('incomplete owner authorization');
        const values = new Map<string, AdmittedActor | null>();
        const expected = new Set(pending.owners);
        for (const pair of message.owners) {
          if (
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            !expected.has(pair[0]) ||
            values.has(pair[0])
          )
            throw new Error('invalid owner authorization identities');
          const actor =
            pair[1] === null
              ? null
              : readAuthorization(
                  { actor: pair[1], expiresAt: Date.now() + OWNER_AUTHORIZATION_MS },
                  Date.now(),
                  pair[0],
                ).actor;
          values.set(pair[0], actor);
        }
        room.authorizeOwners([...values], message.deadline);
        appliedOwners = JSON.stringify(pending.owners);
        ownerDeadline = message.deadline;
      } else if (message.type === 'room-policy-unavailable') {
        if (pendingPolicy?.requestId !== message.requestId) return;
        pendingPolicy = null;
        nextPolicyCheck = now + 500;
      } else if (message.type === 'room-policy') {
        const pending = pendingPolicy;
        if (!pending || message.requestId !== pending.requestId || terminalSent) return;
        pendingPolicy = null;
        nextPolicyCheck = now + 500;
        if (
          !['playing', 'paused', 'ended'].includes(message.state) ||
          !Number.isFinite(message.deadline) ||
          message.deadline > pending.deadline
        )
          throw new Error('invalid room policy reply');
        if (message.deadline <= now) return;
        policyState = message.state;
        policyUntil = message.deadline;
        nextPolicyCheck = now + (policyUntil - now) / 2;
        applyLifecycle(now);
      } else if (message.type === 'leave') {
        authorizations.delete(message.connection);
        room.disconnect(message.connection, now);
        applyLifecycle(performance.now());
      } else if (message.type === 'message')
        room.receive(message.connection, message.message, performance.now());
      else if (message.type === 'checkpoint') {
        if (
          !Number.isSafeInteger(message.requestId) ||
          message.requestId <= lastCheckpoint ||
          typeof message.pause !== 'boolean'
        )
          throw new Error('invalid checkpoint request');
        lastCheckpoint = message.requestId;
        if (message.pause) {
          if (data.enforceLifecycle) {
            manualPause = true;
            applyLifecycle(performance.now());
          } else room.setPaused(true, performance.now());
        }
        try {
          send({
            type: 'checkpoint',
            requestId: message.requestId,
            checkpoint: room.checkpoint(performance.now()),
          });
        } catch {
          // A failed capture is never reported as saved. A requested pause stays paused.
          send({ type: 'checkpoint-failed', requestId: message.requestId });
        }
      } else if (message.type === 'end') {
        policyState = 'ended';
        room.end(now);
        if (!terminalSent) {
          terminalSent = true;
          send({ type: 'session-ended' });
        }
      } else if (message.type === 'resume' || message.type === 'pause') {
        if (data.enforceLifecycle) {
          manualPause = message.type === 'pause';
          applyLifecycle(performance.now());
        } else room.setPaused(message.type === 'pause', performance.now());
      } else if (message.type === 'ownership') {
        if (!Number.isFinite(message.deadline) || message.deadline < ownershipDeadline)
          throw new Error('invalid room ownership deadline');
        ownershipDeadline = message.deadline;
      } else if (message.type === 'stop') close(false);
      else throw new Error('invalid supervisor command');
    } catch {
      close(true);
    } finally {
      command.record(performance.now() - started);
    }
  });
  send({ type: 'ready' });
} catch {
  send({ type: 'fault' });
  process.exitCode = 1;
}
