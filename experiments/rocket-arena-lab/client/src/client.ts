import { applyDocumentLocale } from './ui/i18n.js';
/**
 * Rocket Arena — Client Entry Point
 *
 * Bootstraps renderer, connects to server, and presents synchronized entities.
 */

import {
  RESOLVED_ARENA_GEOMETRY,
  resolveBoostPadDescriptors,
} from '@rocket-arena/shared';
import { initScene, setRenderScale } from './renderer/scene.js';
import { createLighting } from './renderer/lighting.js';
import { createArena } from './renderer/arena.js';
import { createBallFieldMarker } from './renderer/ball-field-marker.js';
import { createBoostPadVisuals } from './renderer/boost-pads.js';
import { getRoom, getLocalActorId, bindLocalActor, joinPlatformReservation, leaveRoom } from './networking/client.js';
import { isPlatformView, type PlatformView, type PlatformReservation } from './platform/protocol.js';
import { acceptedSnapshotStore } from './networking/accepted-snapshot-store.js';
import {
  getBallMesh,
  getCarMeshes,
  getLocalState,
  updateInterpolatedEntities,
  setupStateListener,
  setInterpolationDelay,
  clearEntityMeshes,
} from './networking/state-listener.js';
import {
  getCurrentInput,
  getCurrentInputCommandV2,
  observeInputCommand,
  initializeKeyboardInput,
  isInputSuspended,
  setInputSuspended,
  releaseHeldInput,
  advanceInputFloors,
} from './input/keyboard-handler.js';
import { createHUD, destroyHUD, resetHUD, updateHUD } from './hud/hud.js';
import {
  projectBallIndicator,
  type BallIndicatorProjection,
} from './hud/ball-indicator.js';
import { createPauseMenu, destroyPauseMenu, closePauseMenu } from './ui/pause-menu.js';
import {
  beginGameplayCameraSession,
  getCameraMode,
  setOrbitMode,
  updateCamera,
} from './renderer/camera-controller.js';
import { updateEntityEffects } from './renderer/entity-effects.js';
import { initializeAudio, updateAudio, cleanupAudio } from './audio/audio-manager.js';
import type { Room } from 'colyseus.js';
import { WorkerDrivingLab } from './lab/worker-driving-lab.js';
import { readTimingProfile } from './lab/timing-profile.js';
import { ClientLoop } from './client-loop.js';
import { createPlayerLabels } from './hud/player-labels.js';
import { Light } from 'three';

export interface RocketClient {
  readonly disposed: boolean;
  readonly suspended: boolean;
  /** Local client suspension; the authoritative multiplayer match keeps running. */
  suspend(): void;
  resume(): void;
  dispose(): void;
  connectPlatform(reservation: PlatformReservation): void;
}

let activeClient: RocketClient | null = null;

/** One client per document. A replacement first releases the previous lifetime. */
export interface EmbeddedRocketOptions {
  sessionId: string;
  reservation?: PlatformReservation;
  onState(view: PlatformView): void;
  onExit(): void;
  onError(code: string): void;
  onDisconnect(): void;
  onRematch(join: boolean): void;
}

/** Optional standalone UI; app frames own their lobby and results in React. */
export interface StandaloneUI {
  createLobby: typeof import('./ui/lobby.js').createLobby;
  destroyLobby: typeof import('./ui/lobby.js').destroyLobby;
  showLobby: typeof import('./ui/lobby.js').showLobby;
  showGameOver: typeof import('./ui/game-over.js').showGameOver;
  hideGameOver: typeof import('./ui/game-over.js').hideGameOver;
  createLabPanel: typeof import('./lab/panel.js').createLabPanel;
  createDevPanel: typeof import('./dev-panel/dev-panel.js').createDevPanel;
  destroyDevPanel: typeof import('./dev-panel/dev-panel.js').destroyDevPanel;
}

export function mountRocketClient(app: HTMLElement, embedded?: EmbeddedRocketOptions, standalone?: StandaloneUI): RocketClient {
  activeClient?.dispose();
  applyDocumentLocale();
  // Fail before installing input, timers or a worker if WebGL is unavailable.
  const { renderer, scene, camera, dispose: disposeScene } = initScene(app);
  let disposed = false;
  let suspended = false;
  let wasInputSuspended = false;
  let platformPaused = false;
  const events = new AbortController();
  const releaseKeyboard = initializeKeyboardInput();

  const timing = readTimingProfile(window.location.search);
  const drivingLab = new WorkerDrivingLab(undefined, { poseBufferMs: timing.poseBufferMs });
  const destroyLabPanel = standalone?.createLabPanel(drivingLab, timing.name) ?? (() => {});
  (window as unknown as { __drivingLab: WorkerDrivingLab }).__drivingLab = drivingLab;
  window.addEventListener('blur', () => drivingLab.neutralize(getCurrentInputCommandV2()), { signal: events.signal });
  document.addEventListener('visibilitychange', () => {
    drivingLab.refreshTelemetryContext();
    if (document.hidden) drivingLab.neutralize(getCurrentInputCommandV2());
  }, { signal: events.signal });
  window.addEventListener('focus', () => drivingLab.refreshTelemetryContext(), { signal: events.signal });
  window.addEventListener('blur', () => drivingLab.refreshTelemetryContext(), { signal: events.signal });

  const resolvedArenaGeometry = RESOLVED_ARENA_GEOMETRY;
  const lighting = createLighting(scene, resolvedArenaGeometry);
  const refractiveCeiling = new URLSearchParams(window.location.search).get('ceiling') === 'glass';
  const arena = createArena(scene, resolvedArenaGeometry, [], { refractiveCeiling });
  const ballFieldMarker = createBallFieldMarker();
  scene.add(ballFieldMarker.object);
  // Descriptor-driven and read from the same shared table the room grants from, so
  // a drawn pad is always a pad that pays out.
  const boostPads = createBoostPadVisuals(resolveBoostPadDescriptors());
  scene.add(boostPads.object);
  createHUD();
  const playerLabels = createPlayerLabels(app);
  const resizePlayerLabels = () => playerLabels.resize(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
  const labelViewport = new ResizeObserver(resizePlayerLabels);
  labelViewport.observe(renderer.domElement);
  resizePlayerLabels();
  initializeAudio();

  /** Client-only presentation toggle owned by the settings panel. */
  let ballMarkerVisible = true;

  createPauseMenu({
    isInMatch: () => getRoom() !== null,
    returnToLobby: () => {
      clearMatchPresentation();
      if (embedded) embedded.onExit();
      else standalone?.showLobby();
    },
    applyLowGraphics: (low) => {
      setRenderScale(low ? .7 : 1);arena.exteriorPresentation.visible=!low;
      drivingLab.setGraphicsQuality(low,low ? .7 : 1,renderer.shadowMap.enabled,refractiveCeiling);
    },
    applyBallMarkerVisible: (visible) => {
      ballMarkerVisible = visible;
      if (!visible) ballFieldMarker.update(null);
    },
  });

  let gameEnded = false;
  let gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  let presentedRoom: Room | null = null;
  let previousFrameTime = performance.now() / 1000;

  function clearMatchPresentation(): void {
    playerLabels.clear();
    if (gameOverTimer !== null) clearTimeout(gameOverTimer);
    gameOverTimer = null;
    gameEnded = false;
    standalone?.hideGameOver();
    standalone?.destroyDevPanel();
    closePauseMenu();
    releaseHeldInput();
    resetHUD();
  }

  /** Indicator centres stay clear of the protected central region of the view. */
  const BALL_INDICATOR_INSET_RATIO = 0.11;

  interface PresentedBall {
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
  }

  function projectOffscreenBall(ball: PresentedBall | null): BallIndicatorProjection | null {
    if (!ball) return null;
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (width <= 0 || height <= 0) return null;

    camera.updateMatrixWorld();
    return projectBallIndicator({
      worldPosition: ball.position,
      viewMatrix: camera.matrixWorldInverse,
      projectionMatrix: camera.projectionMatrix,
      viewport: {
        width,
        height,
        insetX: width * BALL_INDICATOR_INSET_RATIO,
        insetY: height * BALL_INDICATOR_INSET_RATIO,
      },
    });
  }

  setOrbitMode();

  const joined = (room: Room) => {
    if (disposed) return;
    drivingLab.attach(room);
    standalone?.createDevPanel(room);
    gameEnded = false;
    beginGameplayCameraSession(getCurrentInputCommandV2().cameraToggleSequence);
  };
  function connectPlatform(reservation: PlatformReservation): void {
    if (!embedded || disposed) return;
    void joinPlatformReservation(reservation).then(room => {
      if (disposed) { leaveRoom(); return; }
      // No physics actor is inferred from a transport connection ID.
      bindLocalActor(room, null);
      let previousActor: string | null | undefined;
      let previousPaused: boolean | undefined;
      room.onMessage('platform-state', (candidate: unknown) => {
        if (disposed || getRoom() !== room || !isPlatformView(candidate, embedded.sessionId)) return;
        const actorChanged = previousActor !== candidate.actorId;
        const pauseChanged = previousPaused !== candidate.paused;
        platformPaused = candidate.paused;
        if (actorChanged || pauseChanged) {
          drivingLab.detach(); releaseHeldInput();
          bindLocalActor(room, candidate.actorId);
          if (candidate.inputFloor) advanceInputFloors(candidate.inputFloor);
          setInputSuspended(candidate.paused);
          if (actorChanged) setupStateListener(room, scene, { roomMode: 'custom' });
          if (candidate.actorId && !candidate.paused) joined(room);
          previousActor = candidate.actorId; previousPaused = candidate.paused;
        }
        embedded.onState(candidate);
      });
      room.onMessage('platform-error', (value: { code?: unknown }) => {
        if (!disposed && typeof value?.code === 'string') embedded.onError(value.code);
      });
      room.onMessage('platform-rematch', (value: { join?: unknown }) => { if (!disposed && typeof value?.join === 'boolean') embedded.onRematch(value.join); });
      room.onMessage('platform-ended', (value: { reason?: string }) => { if (!disposed) embedded.onError(value?.reason === 'saved' ? 'SESSION_SAVED'
        : value?.reason === 'save-unconfirmed' ? 'SAVE_UNCONFIRMED' : 'SESSION_COMPLETED'); });
      room.onLeave(() => {
        if (!disposed) { drivingLab.detach(); clearMatchPresentation(); embedded.onDisconnect(); }
      });
      room.send('platform-ready');
    }).catch(error => {
      const code = error instanceof Error && /^[A-Z_]{1,64}$/.test(error.message) ? error.message : 'CONNECTION_FAILED';
      if (!disposed) embedded.onError(code);
    });
  }
  if (embedded?.reservation) connectPlatform(embedded.reservation);
  standalone?.createLobby(joined, scene, () => {
    drivingLab.detach(); clearMatchPresentation();
  });

  function startInputClock(): void {
    if (!timing.autonomous) return;
    drivingLab.startInputClock(getRoom,getCurrentInputCommandV2,()=>!document.hidden&&document.hasFocus());
  }
  startInputClock();
  const stopInputObserver = timing.autonomous
    ? observeInputCommand(()=>drivingLab.sampleInputs()) : () => {};

  function animate(): void {
    const frameNowMs = performance.now();
    const time = frameNowMs / 1000;
    const frameDeltaSeconds = Math.max(time - previousFrameTime, 0);
    const deltaSeconds = Math.min(frameDeltaSeconds, 0.1);
    previousFrameTime = time;
    const sceneStarted=performance.now();
    arena.update(deltaSeconds, time);
    // Pad cooldowns are authoritative, so they are read from the acceptance
    // boundary rather than timed locally. No accepted snapshot means nothing is
    // known to be spent, which draws every pad available.
    boostPads.update(time, acceptedSnapshotStore.getSnapshot()?.boostPadCooldowns);
    let sceneMs=performance.now()-sceneStarted;
    const room = getRoom();
    if (room !== presentedRoom) {
      clearMatchPresentation();
      presentedRoom = room;
    }
    drivingLab.update(room && !platformPaused && getLocalActorId(room) ? room : null, frameDeltaSeconds, getCurrentInputCommandV2(), frameNowMs);

    if (room) {
      // One presentation order: accepted/interpolated state, entity effects,
      // camera, HUD, audio, then render.
      setInterpolationDelay(drivingLab.mode === 'original' ? 100 : 40);
      const presentationStarted=performance.now();
      const presentedFrame = updateInterpolatedEntities(frameNowMs);

      const localCar = getCarMeshes().get(getLocalActorId(room)) || null;
      const ball = getBallMesh();
      drivingLab.present(localCar, ball, frameNowMs);
      drivingLab.clientSample('presentationMs',performance.now()-presentationStarted);
      const effectsStarted=performance.now();
      updateEntityEffects(deltaSeconds, time);
      sceneMs+=performance.now()-effectsStarted;
      const uiStarted=performance.now();
      // The field circle is a floor overlay, not a snapshot entity, so it simply
      // follows whichever ball currently exists and hides when there is none.
      ballFieldMarker.update(ballMarkerVisible && ball ? ball.position : null);
      const state = getLocalState();
      const inputCommand = getCurrentInputCommandV2();
      const activePlay = state?.phase === 'playing' || state?.phase === 'overtime';
      updateCamera(camera, localCar, time, deltaSeconds, {
        ball,
        activePlay,
        cameraToggleSequence: inputCommand.cameraToggleSequence,
        presentedKickoffEpoch: drivingLab.mode === 'predicted'
          ? drivingLab.kickoffEpoch : presentedFrame?.kickoffEpoch ?? null,
      });
      updateHUD({
        cameraMode: getCameraMode(),
        ballIndicator: projectOffscreenBall(ball),
      });
      if (state && state.phase !== 'waiting') playerLabels.update(camera, getCarMeshes(), state.players, getLocalActorId(room));
      else playerLabels.clear();
      updateAudio({
        roomId: room.id,
        sessionId: getLocalActorId(room),
        state,
        input: getCurrentInput(),
        localCar,
        ball,
        camera,
        deltaSeconds,
        nowMs: frameNowMs,
      });

      drivingLab.clientSample('hudAudioMs',performance.now()-uiStarted);
      if (standalone && !gameEnded && state?.phase === 'ended') {
        gameEnded = true;
        gameOverTimer = setTimeout(() => {
          gameOverTimer = null;
          if (!disposed && !suspended && getRoom() === room) standalone.showGameOver(room);
        }, 2000);
      }
    } else {
      resetHUD();
      if (getCameraMode() !== 'orbit') setOrbitMode();
      updateCamera(camera, null, time, deltaSeconds);
      updateAudio({
        roomId: null,
        sessionId: null,
        state: null,
        input: getCurrentInput(),
        localCar: null,
        ball: null,
        camera,
        deltaSeconds,
        nowMs: frameNowMs,
      });
    }

    drivingLab.clientSample('sceneEffectsMs',sceneMs);
    const renderStarted=performance.now();renderer.render(scene,camera);
    drivingLab.clientSample('renderSubmitMs',performance.now()-renderStarted);
    drivingLab.drawCalls(renderer.info.render.calls);
  }

  const loop = new ClientLoop(animate);
  const handle: RocketClient = {
    connectPlatform,
    get disposed() { return disposed; },
    get suspended() { return suspended; },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      loop.stop();
      if (gameOverTimer !== null) clearTimeout(gameOverTimer);
      gameOverTimer = null;
      gameEnded = false;
      wasInputSuspended = isInputSuspended();
      setInputSuspended(true);
      drivingLab.neutralize(getCurrentInputCommandV2());
      drivingLab.stopInputClock();
      updateAudio({ roomId: null, sessionId: null, state: null, input: getCurrentInput(),
        localCar: null, ball: null, camera, deltaSeconds: 0, nowMs: performance.now() });
    },
    resume() {
      if (disposed || !suspended) return;
      suspended = false;
      releaseHeldInput();
      setInputSuspended(platformPaused || wasInputSuspended);
      previousFrameTime = performance.now() / 1000;
      startInputClock();
      loop.start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      events.abort();
      clearMatchPresentation();
      stopInputObserver();
      drivingLab.neutralize(getCurrentInputCommandV2());
      drivingLab.dispose();
      labelViewport.disconnect();
      playerLabels.dispose();
      releaseKeyboard();
      if (standalone) standalone.destroyLobby();
      else leaveRoom();
      clearEntityMeshes(scene);
      cleanupAudio();
      destroyLabPanel();
      destroyPauseMenu();
      boostPads.dispose();
      ballFieldMarker.dispose();
      arena.dispose();
      lighting.traverse(object => { if (object instanceof Light) object.dispose(); });
      scene.clear();
      disposeScene();
      destroyHUD();
      if ((window as unknown as { __drivingLab: WorkerDrivingLab }).__drivingLab === drivingLab) {
        delete (window as unknown as { __drivingLab?: WorkerDrivingLab }).__drivingLab;
      }
      if (activeClient === handle) activeClient = null;
    },
  };
  activeClient = handle;
  // Page ownership follows the current mount, including same-document replacements.
  window.addEventListener('pagehide', event => {
    if (event.persisted) handle.suspend();
    else handle.dispose();
  }, { signal: events.signal });
  window.addEventListener('pageshow', event => {
    if (event.persisted) handle.resume();
  }, { signal: events.signal });
  loop.start();
  return handle;
}
