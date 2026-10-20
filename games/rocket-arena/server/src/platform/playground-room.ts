import * as colyseus from '@colyseus/core';
import { randomUUID } from 'node:crypto';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameState } from '@rocket-arena/shared/schema';
import { PHYSICS, MATCH_RULES, type MatchPhase } from '@rocket-arena/shared';
import { createGameRoomCore, initializeGameWorld } from '../rooms/game-room-core.js';
import type { AuthoritativeRoomCore } from '../rooms/authoritative-room-core.js';
import type { AuthoritativeRapierCar } from '../rooms/rapier-room-world.js';
import { broadcastDueV2Snapshot } from '../rooms/room-snapshot-transport.js';
import { createClientMetricsHandler, createClientStallHandler } from './diagnostics.js';
import { AdmissionError, type Admission, type PlatformProfile } from './admission.js';
import { PlatformGateway } from './gateway.js';
import { LaunchTickets } from './tickets.js';
import { PlatformSeats } from './seats.js';
import { createBotController } from './bot-controller.js';
import { isPlatformLogEnabled, platformLog } from './logging.js';
import { captureSeats, restoreSeats, RoomCheckpoints, PAUSED_RETENTION_MS, type SavedRoom } from './checkpoint.js';

export interface RoomDependencies {
  gateway: PlatformGateway;
  tickets: LaunchTickets;
  checkpoints: RoomCheckpoints;
  internalKey: string;
  onReady(roomId: string): number;
  onDispose(sessionId: string, roomId: string): number;
}
let dependencies: RoomDependencies;
export function configurePlatformRooms(value: RoomDependencies): void { dependencies = value; }

type Core = AuthoritativeRoomCore<RAPIER.World, AuthoritativeRapierCar, RAPIER.RigidBody>;
interface CreateOptions { internalKey: string; admission: Admission; allocationId: string; saved?: SavedRoom | null }

/** Authenticated Playground room; the only public game adapter. */
export class PlaygroundRoom extends colyseus.Room<GameState> {
  private core!: Core;
  private seats!: PlatformSeats;
  private sessionId!: string;
  private allocationId!: string;
  private initialized!: Promise<void>;
  private engineReady = false;
  private readonly admitted = new Map<string, Admission>();
  private readonly installed = new Map<string, string>();
  private persistChain: Promise<void> = Promise.resolve();
  private controlChain: Promise<void> = Promise.resolve();
  private pendingControls = 0;
  private readonly controlAt = new Map<string, number>();
  private readonly readyAt = new Map<string, number>();
  private paused = false;
  private pausedAt: number | null = null;
  private saved: SavedRoom | null = null;
  private stoppedBy: string | null = null;
  private disposed = false;
  private sweepRunning = false;
  private createdAt = Date.now();
  private activeAgeMs = 0;
  private maintenanceAt = Date.now();
  private everHadHuman = false;
  private publishedRevision = 0;
  private lastPhase: MatchPhase = 'waiting';
  private completed = false;
  private lastPersistedRoster = new Set<string>();
  private readonly excludedRoster = new Set<string>();
  private wasOpen = false;
  private completedAt = 0;
  private rematch: { accepted: Set<string>; refused: Set<string> } | null = null;
  private rematchStarting = false;
  private closingReason: string | null = null;
  private readonly leaveConsents = new WeakMap<colyseus.Client, boolean>();

  onCreate(options: CreateOptions): void {
    if (!dependencies || options.internalKey !== dependencies.internalKey) throw new AdmissionError('UNAUTHORIZED', 401);
    this.sessionId = options.admission.session.id;
    this.allocationId = options.allocationId;
    this.lastPersistedRoster = new Set(options.admission.session.player_ids);
    this.wasOpen = options.admission.session.is_open;
    this.seats = new PlatformSeats(options.admission.session.host_id);
    this.saved = options.saved ?? null;
    if (this.saved) {
      restoreSeats(this.seats, this.saved, options.admission.session.player_ids);
      if (this.saved.waiting) this.seats.retainHostUntil(Date.now() + 30_000);
      this.paused = !this.saved.waiting;
      this.pausedAt = this.saved.expiresAt - PAUSED_RETENTION_MS;
    }
    this.setState(new GameState());
    this.maxClients = 16;
    this.autoDispose = false; // Reserved human seats outlive their transport for 30 seconds.
    this.setPrivate(true);
    this.setPatchRate(50);
    this.core = createGameRoomCore({ roomId: this.roomId, initializeWorld: initializeGameWorld,
      logger: { info: () => {}, error: (message) => platformLog('error', 'ROCKET_ENGINE_FAILED', { sessionId: this.sessionId, roomId: this.roomId, detail: message }) },
      onFatal: () => { if (this.engineReady) void this.finish('engine-error'); } });
    // Allocation owns startup rollback. A rejected initialization must never
    // complete the saved session before the allocator can release its lease.
    this.initialized = this.initialize().then(() => { this.engineReady = true; });
    void this.initialized.catch(() => {});

    this.onMessage('platform-ready', client => {
      if (Date.now() - (this.readyAt.get(client.sessionId) ?? 0) < 500) return;
      this.readyAt.set(client.sessionId, Date.now()); this.sendPlatformState(client);
    });
    this.onMessage('latency-ping', (client, value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) client.send('latency-pong', value);
    });
    const telemetry = (event: string) => ({ sessionId: connectionId, ...fields }: Record<string, unknown>) => platformLog('debug', event, {
      ...fields, connectionId, sessionId: this.sessionId,
      humans: this.seats.humans().length, bots: this.seats.botCount(),
    });
    const stats = createClientMetricsHandler(this.roomId, () => this.seats.seats.filter(seat => seat.human || seat.bot).length, telemetry('ROCKET_CLIENT_WINDOW'));
    const stalls = createClientStallHandler(this.roomId, telemetry('ROCKET_CLIENT_STALL'));
    // Keep handlers registered for existing clients, but skip report validation
    // and serialization entirely unless diagnostic logging is requested.
    this.onMessage('client-metrics', (client, value: unknown) => { if (isPlatformLogEnabled('debug')) stats(client, value); });
    this.onMessage('client-stall', (client, value: unknown) => { if (isPlatformLogEnabled('debug')) stalls(client, value); });
    for (const type of ['player-input', 'player-neutral']) this.onMessage(type, (client, value: unknown) => {
      if (this.paused || this.completed || this.disposed) return;
      const actorId = this.seats.actorForConnection(client.sessionId);
      if (actorId) this.core.submitPredictionInput(actorId, value, type === 'player-neutral');
    });
    this.onMessage('platform-control', (client, payload: unknown) => {
      if (this.pendingControls >= 8 || Date.now() - (this.controlAt.get(client.sessionId) ?? 0) < 300) {
        client.send('platform-error', { code: 'RATE_LIMITED' }); return;
      }
      this.controlAt.set(client.sessionId, Date.now()); this.pendingControls++;
      this.controlChain = this.controlChain.catch(() => {}).then(() => this.control(client, payload))
        .catch(error => {
          const code = this.errorCode(error);
          platformLog('warn', 'ROCKET_CONTROL_REJECTED', { sessionId: this.sessionId, roomId: this.roomId,
            allocationId: this.allocationId, connectionId: client.sessionId,
            correlationId: this.admitted.get(client.sessionId)?.correlationId,
            userId: this.admitted.get(client.sessionId)?.profile.userId,
            action: payload && typeof payload === 'object' && typeof (payload as { action?: unknown }).action === 'string'
              ? String((payload as { action: string }).action).slice(0, 32) : 'unknown',
            phase: this.core.matchFlowState?.phase, code,
            ...(error instanceof Error && !(error instanceof AdmissionError) ? { err: error } : {}) });
          client.send('platform-error', { code });
        })
        .finally(() => { this.pendingControls--; });
    });
    this.setSimulationInterval(delta => this.advance(delta), PHYSICS.TIMESTEP * 1000);
    this.clock.setInterval(() => this.maintenance(), 1000);
    this.clock.setInterval(() => { void this.sweep(); }, 15_000);
  }

  private async initialize(): Promise<void> {
    await this.core.initialize();
    for (const seat of this.seats.seats) {
      const result = await this.core.queueMutation({ kind: 'join', sessionId: seat.actorId, name: this.botName(seat.index) });
      if (!result.ok) throw new Error(result.code);
    }
    this.installControllers();
    if (this.saved && !this.saved.waiting) {
      this.core.restoreProgressAtKickoff(this.saved.progress);
      this.lastPhase = 'countdown'; this.core.setPaused(true);
    }
    const activeRooms = dependencies.onReady(this.roomId);
    platformLog('info', 'ROCKET_ROOM_READY', { sessionId: this.sessionId, roomId: this.roomId, activeRooms,
      allocationId: this.allocationId, restored: !!this.saved, paused: this.paused,
      phase: this.core.matchFlowState?.phase, duration_ms: Date.now() - this.createdAt });
  }

  async whenReady(): Promise<void> { await this.initialized; }

  async abortInitialization(): Promise<void> {
    this.closingReason = 'initialization-failed';
    this.disposed = true;
    this.core?.setPaused(true);
    await this.disconnect();
  }

  async onAuth(client: colyseus.Client, options: { ticket?: unknown }): Promise<Admission> {
    const connectedAt = Date.now();
    // onLeave is a room-membership callback; on server disconnect Colyseus can
    // call it before closing the actual socket. Observe the transport separately
    // so failed authentication and server-initiated closes are visible too.
    client.ref.once('close', (closeCode: number) => {
      const admission = client.auth as Admission | undefined;
      platformLog(closeCode === 1006 ? 'warn' : 'info', 'ROCKET_SOCKET_CLOSED', {
        sessionId: this.sessionId, roomId: this.roomId, allocationId: this.allocationId,
        connectionId: client.sessionId, userId: admission?.profile.userId, correlationId: admission?.correlationId,
        closeCode, consented: this.leaveConsents.get(client) ?? false,
        reason: this.closingReason ?? (this.leaveConsents.get(client) ? 'client-leave' : 'transport-close'),
        duration_ms: Date.now() - connectedAt,
      });
    });
    try {
      const ticket = dependencies.tickets.consume(options.ticket, this.roomId, this.allocationId);
      if (ticket.sessionId !== this.sessionId || this.seats.banned.has(ticket.userId)) throw new AdmissionError('REMOVED_FROM_ROOM');
      const profile = await dependencies.gateway.profile(ticket.userId);
      return { ...await dependencies.gateway.admit(profile, this.sessionId, ticket.observer, ticket.invitationCode), correlationId: ticket.correlationId };
    } catch (error) {
      platformLog(error instanceof AdmissionError && error.status < 500 ? 'warn' : 'error', 'ROCKET_SOCKET_AUTH_REJECTED', {
        sessionId: this.sessionId, roomId: this.roomId, allocationId: this.allocationId,
        connectionId: client.sessionId, code: this.errorCode(error),
      });
      throw error;
    }
  }

  assertAdmission(admission: Admission): void {
    if (this.disposed || this.completed) throw new AdmissionError('SESSION_RECOVERING', 503);
    if (this.seats.banned.has(admission.profile.userId)) throw new AdmissionError('REMOVED_FROM_ROOM');
    if (admission.observer) {
      if ([...this.admitted.values()].filter(value => value.observer).length >= 8) throw new AdmissionError('OBSERVERS_FULL', 409);
    } else {
      const human = this.seats.humans().find(value => value.userId === admission.profile.userId);
      if (human?.connectionId) throw new AdmissionError('ALREADY_CONNECTED', 409);
      if (!human && this.seats.humans().length >= 8) throw new AdmissionError('ROOM_FULL', 409);
    }
  }

  async authorizeSocial(profile: PlatformProfile): Promise<Admission> {
    if (this.disposed || this.completed) throw new AdmissionError('SESSION_COMPLETED', 409);
    const joined = [...this.admitted.values()].find(admission => admission.profile.userId === profile.userId);
    if (!joined) throw new AdmissionError('NOT_IN_ROOM');
    return dependencies.gateway.admit(profile, this.sessionId, joined.observer);
  }

  async onJoin(client: colyseus.Client, _options?: unknown, admission?: Admission): Promise<void> {
    try { await this.joinClient(client, admission); }
    catch (error) {
      platformLog(error instanceof AdmissionError && error.status < 500 ? 'warn' : 'error', 'ROCKET_JOIN_FAILED', {
        sessionId: this.sessionId, roomId: this.roomId, allocationId: this.allocationId,
        connectionId: client.sessionId, userId: admission?.profile.userId,
        correlationId: admission?.correlationId, code: this.errorCode(error),
      });
      throw error;
    }
  }

  private async joinClient(client: colyseus.Client, admission?: Admission): Promise<void> {
    if (!admission) throw new AdmissionError('UNAUTHORIZED', 401);
    await this.initialized;
    if (this.disposed) throw new AdmissionError('SESSION_RECOVERING', 503);
    if (this.completed) throw new AdmissionError('SESSION_COMPLETED', 409);
    if (admission.observer) {
      if ([...this.admitted.values()].filter(value => value.observer).length >= 8) throw new AdmissionError('OBSERVERS_FULL', 409);
      await dependencies.gateway.audit(admission, 'observe');
    } else {
      if (this.paused && this.core.matchFlowState!.phase === 'waiting') {
        this.paused = false; this.pausedAt = null; this.core.setPaused(false);
      }
      this.excludedRoster.delete(admission.profile.userId);
      this.seats.join(admission.profile.userId, admission.profile.name, client.sessionId, this.core.matchFlowState!.phase, Date.now());
      if (['waiting', 'countdown'].includes(this.core.matchFlowState!.phase)) this.seats.kickoff();
    }
    this.admitted.set(client.sessionId, admission);
    this.installControllers();
    if (!admission.observer) {
      try { await this.persist(); }
      catch (error) {
        this.admitted.delete(client.sessionId);
        this.seats.leave(client.sessionId, true, Date.now(), this.paused); this.installControllers();
        throw error;
      }
      this.everHadHuman = true;
    }
    this.publishPlatformState();
    this.publishSnapshot();
    platformLog('info', 'ROCKET_JOIN_COMPLETED', { sessionId: this.sessionId, roomId: this.roomId,
      allocationId: this.allocationId, connectionId: client.sessionId,
      userId: admission.profile.userId, correlationId: admission.correlationId, observer: admission.observer });
  }

  onLeave(client: colyseus.Client, consented: boolean): void {
    this.leaveConsents.set(client, consented);
    const admission = this.admitted.get(client.sessionId);
    this.admitted.delete(client.sessionId);
    this.controlAt.delete(client.sessionId);
    this.readyAt.delete(client.sessionId);
    if (admission) platformLog('debug', 'ROCKET_LEAVE_RECEIVED', { sessionId: this.sessionId, roomId: this.roomId,
      allocationId: this.allocationId, connectionId: client.sessionId,
      userId: admission.profile.userId, correlationId: admission.correlationId, consented,
      serverClosing: this.disposed, reason: this.closingReason ?? (consented ? 'client-leave' : 'connection-lost') });
    if (this.disposed) return;
    if (admission && !admission.observer) {
      const lastHuman = !this.seats.humans().some(human => human.connectionId && human.connectionId !== client.sessionId);
      if (lastHuman && !this.completed) this.pauseForRetention();
      this.seats.leave(client.sessionId, consented, Date.now(), this.paused);
      this.installControllers();
      void this.persist().catch(() => this.finish('platform-unavailable'));
    }
    this.publishPlatformState();
    if (this.rematch) this.controlChain = this.controlChain.catch(() => {}).then(() => this.tryRematch())
      .catch(error => platformLog('warn', 'ROCKET_REMATCH_FAILED', { sessionId: this.sessionId, code: this.errorCode(error) }));
  }

  private installControllers(): void {
    if (!this.core.canPublishSnapshots) return;
    for (const seat of this.seats.seats) {
      const controllerKey = seat.human ? `${seat.human.userId}:${seat.human.connectionId ?? 'reserved'}` : seat.bot ? 'bot' : 'empty';
      if (this.installed.get(seat.actorId) === controllerKey) continue;
      this.core.setActorEnabled(seat.actorId, !!seat.human || seat.bot);
      this.core.setActorController(seat.actorId, seat.human || !seat.bot ? null
        : createBotController(seat.actorId, seat.index, this.core.getActorInput(seat.actorId)));
      this.core.renameActor(seat.actorId, seat.human?.name ?? this.botName(seat.index));
      this.installed.set(seat.actorId, controllerKey);
    }
    const active = this.seats.seats.filter(seat => seat.human || seat.bot);
    const host = active.find(seat => seat.human?.userId === this.seats.hostUserId)
      ?? active.find(seat => seat.human?.connectionId) ?? active.find(seat => seat.human) ?? active[0];
    if (host) this.core.setHostActor(host.actorId);
  }

  private advance(delta: number): void {
    if (this.disposed || this.completed) return;
    const began = performance.now();
    const frame = this.core.advanceSimulation(delta);
    const phase = this.core.matchFlowState?.phase ?? 'waiting';
    if (phase === 'countdown' && this.lastPhase !== 'countdown') {
      this.seats.kickoff(); this.installControllers(); this.publishPlatformState();
      void this.persist().catch(() => this.finish('platform-unavailable'));
    }
    if (phase === 'ended' && this.lastPhase !== 'ended') {
      void this.completeRound('finished').catch(() => this.finish('platform-unavailable'));
    }
    this.lastPhase = phase;
    if (frame.snapshotDue) {
      this.publishSnapshot({ callbackGapMs: delta, workMs: performance.now() - began, droppedMs: frame.droppedTimeMs });
    }
  }

  private publishSnapshot(serverTiming = { callbackGapMs: 0, workMs: 0, droppedMs: 0 }): void {
    const projection = this.core.projectAuthoritativeState();
    if (!projection) return;
    this.state.applyAuthoritativeProjection(projection);
    broadcastDueV2Snapshot(true, projection, this.core, Date.now(), (type, payload) => this.broadcast(type, payload));
    const frame = this.core.buildPredictionFrame();
    if (frame && !this.paused) this.broadcast('prediction-state', { ...frame, serverTiming });
  }

  private async control(client: colyseus.Client, payload: unknown): Promise<void> {
    if (this.disposed) throw new AdmissionError('SESSION_RECOVERING', 503);
    const admission = this.admitted.get(client.sessionId);
    if (!admission || !payload || typeof payload !== 'object') throw new AdmissionError('CONTROL_FORBIDDEN');
    const request = payload as { action?: unknown; userId?: unknown; count?: unknown; actorId?: unknown; team?: unknown; accept?: unknown };
    if (request.action === 'rematch' || request.action === 'rematch-response') {
      if (!this.completed || admission.observer) throw new AdmissionError('CONTROL_FORBIDDEN');
      const fresh = await dependencies.gateway.admitRematch(await dependencies.gateway.profile(admission.profile.userId), this.sessionId, false);
      if (request.action === 'rematch') {
        if (fresh.profile.userId !== this.seats.hostUserId) throw new AdmissionError('CONTROL_FORBIDDEN');
        this.rematch ??= { accepted: new Set([fresh.profile.userId]), refused: new Set() };
      } else {
        if (!this.rematch || typeof request.accept !== 'boolean') throw new AdmissionError('BAD_CONTROL', 400);
        this.rematch.accepted.delete(fresh.profile.userId); this.rematch.refused.delete(fresh.profile.userId);
        (request.accept ? this.rematch.accepted : this.rematch.refused).add(fresh.profile.userId);
      }
      this.publishPlatformState(); await this.tryRematch();
      this.logControl(client, admission, request.action,
        request.action === 'rematch-response' ? { accept: request.accept } : {});
      return;
    }
    if (this.completed) throw new AdmissionError('SESSION_COMPLETED', 409);
    // Re-read policy for every privileged action, including a revoked teacher role.
    const fresh = await dependencies.gateway.admit(await dependencies.gateway.profile(admission.profile.userId), this.sessionId, admission.observer);
    const staff = fresh.profile.role === 'teacher' || fresh.profile.role === 'admin';
    if (!staff && fresh.profile.userId !== this.seats.hostUserId) throw new AdmissionError('CONTROL_FORBIDDEN');
    if (staff && ['start', 'pause', 'resume', 'end', 'remove', 'bots', 'team', 'assign-pending'].includes(String(request.action))) {
      await dependencies.gateway.audit({ ...fresh, correlationId: admission.correlationId }, String(request.action), typeof request.userId === 'string' ? request.userId : undefined);
    }
    if (request.action === 'assign-pending') {
      this.seats.planPending(request.userId, request.actorId);
      await this.persist();
    } else if (request.action === 'bots' || request.action === 'team') {
      if (this.core.matchFlowState?.phase !== 'waiting') throw new AdmissionError('LOBBY_ONLY', 409);
      if (request.action === 'bots') this.seats.setBots(request.count);
      else this.seats.assignTeam(request.actorId, request.team);
      this.installControllers();
      await this.persist();
    } else if (request.action === 'start') {
      if (this.paused) throw new AdmissionError('CANNOT_START', 409);
      if (!this.seats.humans().some(human => human.connectionId)) throw new AdmissionError('NO_PLAYERS', 409);
      const hostActor = this.core.projectAuthoritativeState()?.hostSessionId;
      if (!hostActor) throw new AdmissionError('NO_PLAYERS', 409);
      const result = await this.core.queueMutation({ kind: 'start', sessionId: hostActor });
      if (!result.ok) throw new AdmissionError('CANNOT_START', 409);
      this.pausedAt = null;
      await this.persist('playing');
    } else if (request.action === 'pause' || request.action === 'resume') {
      if (this.core.matchFlowState?.phase === 'waiting' || this.core.matchFlowState?.phase === 'ended') throw new AdmissionError('CANNOT_PAUSE', 409);
      const paused = request.action === 'pause';
      if (paused === this.paused) return;
      if (!paused && !this.seats.humans().some(human => human.connectionId)) throw new AdmissionError('NO_PLAYERS', 409);
      const previous = this.paused;
      const previousPausedAt = this.pausedAt;
      this.paused = paused; this.core.setPaused(paused);
      this.pausedAt = paused ? Date.now() : null;
      try { await this.persist(paused ? 'paused' : 'playing'); }
      catch (error) { this.paused = previous; this.pausedAt = previousPausedAt; this.core.setPaused(previous); throw error; }
      if (paused) this.seats.retainRoster();
    } else if (request.action === 'end') {
      this.stoppedBy = admission.profile.userId;
      await this.completeRound('stopped');
      this.logControl(client, admission, request.action); return;
    } else if (request.action === 'remove' && staff && typeof request.userId === 'string') {
      this.remove(request.userId, 'REMOVED_FROM_ROOM');
      await this.persist();
    } else throw new AdmissionError('BAD_CONTROL', 400);
    this.publishPlatformState(); this.publishSnapshot();
    this.logControl(client, admission, request.action);
  }

  private logControl(client: colyseus.Client, admission: Admission, action: string, extra: Record<string, unknown> = {}): void {
    platformLog('info', 'ROCKET_CONTROL_COMPLETED', { sessionId: this.sessionId, roomId: this.roomId,
      allocationId: this.allocationId, connectionId: client.sessionId,
      userId: admission.profile.userId, correlationId: admission.correlationId, action, ...extra });
  }

  private remove(userId: string, code: string): void {
    this.excludedRoster.add(userId);
    this.seats.remove(userId, code === 'REMOVED_FROM_ROOM');
    platformLog('warn', 'ROCKET_PARTICIPANT_EVICTED', { sessionId: this.sessionId, roomId: this.roomId, userId, code });
    this.installControllers();
    for (const client of this.clients) if (this.admitted.get(client.sessionId)?.profile.userId === userId) {
      client.send('platform-error', { code }); void client.leave(4003);
    }
  }

  private maintenance(): void {
    if (this.disposed || this.rematchStarting) return;
    const now = Date.now();
    if (this.completed) {
      if (!this.seats.humans().some(human => human.connectionId) || now - this.completedAt > 5 * 60_000) void this.finish('finished');
      return;
    }
    if (!this.paused) this.activeAgeMs += now - this.maintenanceAt;
    this.maintenanceAt = now;
    if (this.pausedAt !== null && Date.now() - this.pausedAt >= PAUSED_RETENTION_MS) { void this.finish('paused-expired'); return; }
    if (!this.paused && this.activeAgeMs > 30 * 60_000) { void this.finish('room-expired'); return; }
    if (!this.paused) this.seats.expire(Date.now());
    if (this.seats.revision !== this.publishedRevision) {
      this.installControllers(); this.publishPlatformState();
      void this.persist().catch(() => this.finish('platform-unavailable'));
    }
    if (Object.keys(this.reservedSeats).length === 0 && !this.seats.humans().some(human => human.connectionId) && (this.everHadHuman || Date.now() - this.createdAt > 90_000)) {
      if (this.seats.humans().length && [...this.admitted.values()].some(value => value.observer)) return;
      if (!this.seats.humans().length) void this.finish('empty');
      else void this.hibernate('empty-paused');
    }
  }

  private sweep(): Promise<void> {
    if (this.sweepRunning || this.disposed || this.completed) return Promise.resolve();
    this.sweepRunning = true;
    // Policy reconciliation and host controls must observe one ordered lifecycle.
    const operation = this.controlChain.catch(() => {}).then(() => this.reconcile());
    this.controlChain = operation;
    return operation.finally(() => { this.sweepRunning = false; });
  }

  private async reconcile(): Promise<void> {
    if (this.disposed || this.completed) return;
    try {
      await this.persistChain;
      const revision = this.seats.revision;
      const session = await dependencies.gateway.session(this.sessionId);
      // Joins/leaves may occur while reading the DB; their queued save is newer.
      if (this.completed || this.disposed || revision !== this.seats.revision) return;
      if (session.status === 'completed' || session.game_state?.allocationId !== this.allocationId) { await this.finish('stopped'); return; }
      if ((session.status === 'paused') !== this.paused) {
        this.paused = session.status === 'paused'; this.core.setPaused(this.paused);
        this.pausedAt = this.paused ? Date.now() : null;
        if (this.paused) this.seats.retainRoster();
      }
      // Authoritative roster removal via the existing app/teacher RPC is honored.
      for (const userId of this.lastPersistedRoster) {
        if (!session.player_ids.includes(userId)) this.remove(userId, 'REMOVED_FROM_ROOM');
      }
      const rejected: { connectionId: string; admission: Admission; code: string }[] = [];
      for (const [connectionId, old] of this.admitted) {
        try {
          const profile = await dependencies.gateway.profile(old.profile.userId);
          await dependencies.gateway.admit(profile, this.sessionId, old.observer);
          this.admitted.set(connectionId, { ...old, profile });
        } catch (error) {
          const code = this.errorCode(error);
          if (code === 'PLATFORM_UNAVAILABLE') throw error;
          rejected.push({ connectionId, admission: old, code });
        }
      }
      // A round can finish while the fresh policy reads are in flight.
      if (this.completed || this.disposed) return;
      const deniedConnections = new Set(rejected.map(value => value.connectionId));
      const eligibleHumanRemains = this.seats.humans().some(human => human.connectionId && !deniedConnections.has(human.connectionId));
      // A class's recess ending must not pause other eligible children.
      // If all humans become ineligible together, retain their whole roster.
      if (!eligibleHumanRemains && rejected.some(value => value.code === 'RECESS_DENIED' && !value.admission.observer)) this.pauseForRetention();
      for (const { connectionId, admission, code } of rejected) {
        if (code === 'RECESS_DENIED' && !admission.observer && this.paused) {
          this.seats.leave(connectionId, true, Date.now(), true);
          const client = this.clients.find(value => value.sessionId === connectionId);
          client?.send('platform-error', { code }); void client?.leave(4003);
        } else this.remove(admission.profile.userId, code);
      }
      await this.persist(); this.publishPlatformState();
      platformLog('debug', 'ROCKET_ROOM_SAMPLE', { sessionId: this.sessionId, roomId: this.roomId,
        humans: this.seats.humans().length, bots: this.seats.botCount(),
        observers: [...this.admitted.values()].filter(admission => admission.observer).length,
        phase: this.core.matchFlowState?.phase, paused: this.paused, tick: this.core.diagnostics.fixedStepsCompleted });
    } catch { await this.finish('platform-unavailable'); }
  }

  private persist(status?: string, extra: Record<string, unknown> = {}): Promise<void> {
    const operation = this.persistChain.catch(() => {}).then(async () => {
      const current = await dependencies.gateway.session(this.sessionId);
      if (current.game_state?.allocationId !== this.allocationId) throw new AdmissionError('ALLOCATION_LOST', 409);
      if (current.status === 'completed') { this.completed = true; return; }
      // Saved membership outlives a live car. Only explicit policy/moderation removal
      // removes it; ordinary departures release capacity without losing re-entry.
      for (const userId of this.lastPersistedRoster) {
        if (!current.player_ids.includes(userId)) this.remove(userId, 'REMOVED_FROM_ROOM');
      }
      const roster = new Map(current.player_ids.map((id, index) => [id, current.player_names[index] ?? ''] as const)
        .filter(([id]) => !this.excludedRoster.has(id)));
      for (const human of this.seats.humans()) roster.set(human.userId, human.name);
      const connected = this.seats.humans().filter(human => human.connectionId);
      const flow = this.core.matchFlowState;
      const nextStatus = status ?? (this.completed ? 'completed' : this.paused ? 'paused' : this.lastPhase === 'waiting' ? 'waiting' : 'playing');
      const activityAt = new Date(nextStatus === 'completed' ? Date.now() : this.pausedAt ?? Date.now()).toISOString();
      const checkpoint = flow && nextStatus !== 'completed' ? dependencies.checkpoints.sign({
        version: 1, sessionId: this.sessionId, expiresAt: (this.pausedAt ?? Date.now()) + PAUSED_RETENTION_MS,
        waiting: flow.phase === 'waiting', ...captureSeats(this.seats), progress: {
          blueScore: flow.blueScore, orangeScore: flow.orangeScore, regulationStepsRemaining: flow.regulationStepsRemaining,
          regulationCutoffResolved: flow.regulationCutoffResolved },
      }) : null;
      const gameState = { ...current.game_state, phase: this.core.matchFlowState?.phase ?? 'waiting',
        checkpoint,
        botCount: this.seats.botCount(),
        teams: this.seats.seats.filter(seat => seat.human || seat.bot).map(seat => ({ actorId: seat.actorId,
          userId: seat.human?.userId ?? null, team: seat.index % 2 === 0 ? 'blue' : 'orange' })),
        leaseUntil: Date.now() + 60_000, blueScore: this.core.matchFlowState?.blueScore ?? 0,
        orangeScore: this.core.matchFlowState?.orangeScore ?? 0,
        regulationStepsRemaining: flow?.regulationStepsRemaining ?? 0,
        regulationCutoffResolved: flow?.regulationCutoffResolved ?? false, ...extra };
      // A teacher can open a waiting room before its host finishes loading.
      // Heartbeats must not erase the original platform roster in that interval.
      await dependencies.gateway.update(current, { status: nextStatus, game_state: gameState,
        connected_player_ids: nextStatus === 'completed' ? [] : connected.map(human => human.userId),
        connected_player_names: nextStatus === 'completed' ? [] : connected.map(human => human.name),
        player_ids: [...roster.keys()], player_names: [...roster.values()],
        last_activity: activityAt, peak_player_count: Math.max(current.peak_player_count ?? 0, this.seats.humans().length),
        ...(current.status === 'waiting' && nextStatus === 'playing' ? { started_at: new Date().toISOString() } : {}),
        ...(this.seats.hostUserId ? { host_id: this.seats.hostUserId,
          host_name: roster.get(this.seats.hostUserId) ?? '' } : {}),
        ...(nextStatus === 'completed' ? { ended_at: activityAt, is_open: false, stopped_by: this.stoppedBy } : {}),
      });
      this.lastPersistedRoster = new Set(roster.keys());
    });
    this.persistChain = operation;
    return operation;
  }

  private sendPlatformState(client: colyseus.Client): void {
    const admission = this.admitted.get(client.sessionId);
    if (!admission) return;
    const actorId = this.seats.actorForConnection(client.sessionId);
    const input = actorId ? this.core.getActorInput(actorId) : null;
    client.send('platform-state', { version: 1, sessionId: this.sessionId, actorId,
      observer: admission.observer, pending: this.seats.pending.has(admission.profile.userId),
      paused: this.paused, phase: this.completed ? 'ended' : this.core.matchFlowState?.phase ?? 'waiting', hostUserId: this.seats.hostUserId,
      selfUserId: admission.profile.userId,
      canRematch: this.completed && !this.disposed,
      score: { blue: this.core.matchFlowState?.blueScore ?? 0, orange: this.core.matchFlowState?.orangeScore ?? 0 },
      rematch: this.rematch ? { accepted: [...this.rematch.accepted], refused: [...this.rematch.refused] } : null,
      pendingPlayers: [...this.seats.pending.values()].map(human => ({ userId: human.userId, name: human.name,
        connected: !!human.connectionId, actorId: this.seats.pendingTargets.get(human.userId) ?? null })),
      observers: [...this.admitted.values()].filter(value => value.observer).map(value => ({
        userId: value.profile.userId, name: value.profile.name, role: value.profile.role })),
      canControl: !this.completed && (admission.profile.role !== 'kid' || admission.profile.userId === this.seats.hostUserId),
      canModerate: admission.profile.role === 'teacher' || admission.profile.role === 'admin',
      inputFloor: input ? { jumpSequence: input.jumpSequence, cameraToggleSequence: input.cameraToggleSequence } : null,
      players: this.seats.seats.map(seat => ({ actorId: seat.actorId, name: seat.human?.name ?? this.botName(seat.index),
        kind: seat.human ? 'human' : seat.bot ? 'bot' : 'empty', userId: seat.human?.userId ?? null, connected: !!seat.human?.connectionId,
        team: seat.index % 2 === 0 ? 'blue' : 'orange' })),
    });
  }
  private publishPlatformState(): void {
    this.publishedRevision = this.seats.revision;
    for (const client of this.clients) this.sendPlatformState(client);
  }

  private async completeRound(reason: string): Promise<void> {
    if (this.completed || this.disposed) return;
    this.completed = true; this.completedAt = Date.now(); this.paused = true; this.core.setPaused(true);
    await this.persist('completed', { reason, phase: 'ended', result: this.core.matchFlowState?.terminalResult ?? null });
    this.publishPlatformState(); this.publishSnapshot();
    platformLog('info', 'ROCKET_ROUND_COMPLETED', { sessionId: this.sessionId, roomId: this.roomId, reason });
  }

  private async tryRematch(): Promise<void> {
    if (!this.rematch || this.rematchStarting || this.disposed) return;
    const connected = this.seats.humans().filter(human => human.connectionId);
    if (!connected.length || connected.some(human => !this.rematch!.accepted.has(human.userId) && !this.rematch!.refused.has(human.userId))) return;
    const accepted = connected.filter(human => this.rematch!.accepted.has(human.userId));
    if (!accepted.length) return;
    this.rematchStarting = true;
    try {
      // Recheck accounts and recess at the boundary, not just when they voted.
      for (const human of accepted) await dependencies.gateway.admitRematch(await dependencies.gateway.profile(human.userId), this.sessionId, false);
      await this.persistChain;
      const session = await dependencies.gateway.session(this.sessionId);
      if (session.status !== 'completed' || session.game_state?.allocationId !== this.allocationId) throw new AdmissionError('SESSION_CHANGED', 409);
      const host = accepted.find(human => human.userId === this.seats.hostUserId) ?? accepted[0]!;
      const ids = new Set(accepted.map(human => human.userId));
      const captured = captureSeats(this.seats);
      const checkpoint: SavedRoom = { version: 1, sessionId: this.sessionId, expiresAt: Date.now() + PAUSED_RETENTION_MS,
        waiting: true, ...captured, hostUserId: host.userId,
        seats: captured.seats.map(seat => ({ ...seat, human: seat.human && ids.has(seat.human.userId) ? seat.human : null })),
        pending: captured.pending.filter(human => ids.has(human.userId)),
        progress: { blueScore: 0, orangeScore: 0, regulationStepsRemaining: MATCH_RULES.regulationActivePlaySteps, regulationCutoffResolved: false } };
      await dependencies.gateway.update(session, { status: 'waiting', host_id: host.userId, host_name: host.name,
        player_ids: accepted.map(human => human.userId), player_names: accepted.map(human => human.name),
        connected_player_ids: [], connected_player_names: [], is_open: this.wasOpen,
        started_at: null, ended_at: null, stopped_by: null, last_activity: new Date().toISOString(),
        game_state: { rocket: true, version: 1, allocationId: randomUUID(), leaseUntil: 0, phase: 'waiting',
          round: Number(session.game_state.round ?? 1) + 1, botCount: this.seats.botCount(), blueScore: 0, orangeScore: 0,
          checkpoint: dependencies.checkpoints.sign(checkpoint) } });
      // Fence the old writer before clients launch a fresh physics/transport lifetime.
      this.closingReason = 'rematch';
      this.disposed = true;
      for (const client of this.clients) {
        const admission = this.admitted.get(client.sessionId);
        client.send('platform-rematch', { join: !!admission && (admission.observer || ids.has(admission.profile.userId)) });
      }
      platformLog('info', 'ROCKET_REMATCH_COMPLETED', { sessionId: this.sessionId, roomId: this.roomId, humans: accepted.length });
      await this.disconnect();
    } finally { this.rematchStarting = false; }
  }

  private pauseForRetention(): void {
    if (!this.paused) this.pausedAt = Date.now();
    this.paused = true; this.core.setPaused(true); this.seats.retainRoster();
  }

  async hibernate(reason: string): Promise<void> {
    if (this.disposed) return;
    if (this.completed || !this.seats.humans().length) { await this.finish(reason); return; }
    this.closingReason = reason;
    this.disposed = true; this.pauseForRetention();
    for (const human of this.seats.humans()) human.connectionId = null;
    let confirmed = false;
    try { await this.persist('paused', { reason, leaseUntil: 0 }); confirmed = true; }
    catch (error) {
      // Keep the previous signed checkpoint. Never turn a save failure into completion.
      platformLog('error', 'ROCKET_PERSISTENCE_FAILED', { sessionId: this.sessionId, roomId: this.roomId, reason, err: error });
    }
    this.broadcast('platform-ended', { reason: this.completed ? 'stopped' : confirmed ? 'saved' : 'save-unconfirmed' });
    platformLog(confirmed ? 'info' : 'error', this.completed ? 'ROCKET_ROOM_CLOSED' : confirmed ? 'ROCKET_ROOM_SAVED' : 'ROCKET_ROOM_SAVE_UNCONFIRMED',
      { sessionId: this.sessionId, roomId: this.roomId, reason });
    await this.disconnect();
  }

  async finish(reason: string): Promise<void> {
    if (this.disposed) return;
    if (reason === 'platform-unavailable' && !this.completed && this.seats.humans().length) {
      await this.hibernate(reason); return;
    }
    this.closingReason = reason;
    this.disposed = true;
    this.core?.setPaused(true);
    try { await this.persist('completed', { reason }); }
    catch { platformLog('error', 'ROCKET_PERSISTENCE_FAILED', { sessionId: this.sessionId, roomId: this.roomId, reason }); }
    this.broadcast('platform-ended', { reason });
    platformLog('info', 'ROCKET_ROOM_CLOSED', { sessionId: this.sessionId, roomId: this.roomId, reason });
    await this.disconnect();
  }

  onDispose(): void {
    this.disposed = true;
    this.core?.dispose(); this.admitted.clear(); this.installed.clear(); this.controlAt.clear(); this.readyAt.clear();
    const activeRooms = dependencies.onDispose(this.sessionId, this.roomId);
    platformLog('info', 'ROCKET_ROOM_DISPOSED', { sessionId: this.sessionId, roomId: this.roomId, activeRooms,
      allocationId: this.allocationId, reason: this.closingReason ?? 'framework-dispose',
      engineReady: this.engineReady, duration_ms: Date.now() - this.createdAt });
  }
  private botName(index: number): string { return `בוט ${index + 1}`; }
  private errorCode(error: unknown): string { return error instanceof AdmissionError ? error.code : 'PLATFORM_UNAVAILABLE'; }
}
