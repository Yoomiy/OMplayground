import type { Room } from 'colyseus.js';
import type { InputCommandV2, InputPayload } from '@rocket-arena/shared';
import {
  InputController,
  isEditableTarget,
  type AxisInversion,
} from './input-controller.js';

const controller = new InputController();
let activeRoom: Room | null = null;
let inputSuspended = false;
const listeners = new Set<() => void>();
function notifyInput(): void { for (const listener of listeners) listener(); }
export function observeInputCommand(listener: () => void): () => void {
  listeners.add(listener);return () => listeners.delete(listener);
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function forceNeutralSync(): void {
  controller.resetHeldKeys();
  notifyInput();
  if (!activeRoom) return;

  try {
    controller.send(activeRoom, nowMs(), true);
  } catch (error) {
    console.warn('[Input] Could not force neutral state:', error);
  }
}

/** Clear held keys while preserving monotonic jump/camera edge counters. */
export function releaseHeldInput(): void {
  forceNeutralSync();
}

/**
 * Suspend gameplay input without tearing down the transport.
 *
 * A menu overlay needs the car to stop, but the room connection and the monotonic
 * jump and camera edge floors have to survive so resuming does not fire a phantom
 * jump. Suspending drops new presses and flushes whatever was held.
 */
export function setInputSuspended(suspended: boolean): void {
  if (inputSuspended === suspended) return;
  inputSuspended = suspended;
  if (suspended) forceNeutralSync();
}

export function isInputSuspended(): boolean {
  return inputSuspended;
}

/**
 * Read the W/S, A/D, and Q/E axes backwards.
 *
 * No explicit send is needed: the controller forces its next transmission, and
 * the frame loop already calls `sendInput` continuously, so a flip made from the
 * settings panel reaches the server on the following frame.
 */
export function setAxisInversion(inversion: Partial<AxisInversion>): void {
  controller.setAxisInversion(inversion);
  notifyInput();
}

export function getAxisInversion(): AxisInversion {
  return controller.getAxisInversion();
}

let releaseKeyboard: (() => void) | null = null;

/** Explicit ownership lets an embedded client release and reinstall its inputs. */
export function initializeKeyboardInput(): () => void {
  releaseKeyboard?.();
  const keydown = (event: KeyboardEvent): void => {
    if (inputSuspended || isEditableTarget(event.target)) return;
    if (controller.handleKeyDown(event.code, event.repeat)) { event.preventDefault();notifyInput(); }
  };

  const keyup = (event: KeyboardEvent): void => {
    // Releases are always accepted, so a key held as the menu opened cannot stay
    // latched once it is let go.
    const handled = controller.handleKeyUp(event.code);
    if (handled && !isEditableTarget(event.target)) event.preventDefault();
    if (handled) notifyInput();
  };

  const visibilitychange = (): void => {
    if (document.visibilityState === 'hidden') forceNeutralSync();
  };
  const focusin = (event: FocusEvent): void => {
    if (isEditableTarget(event.target)) forceNeutralSync();
  };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', forceNeutralSync);
  document.addEventListener('visibilitychange', visibilitychange);
  document.addEventListener('focusin', focusin);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', forceNeutralSync);
    document.removeEventListener('visibilitychange', visibilitychange);
    document.removeEventListener('focusin', focusin);
    forceNeutralSync();
    activeRoom = null;
    controller.detachRoom();
    inputSuspended = false;
    if (releaseKeyboard === release) releaseKeyboard = null;
  };
  releaseKeyboard = release;
  return release;
}

/** Read a fresh immutable legacy view for presentation systems only. */
export function getCurrentInput(): Readonly<InputPayload> {
  const command = controller.getPayload();
  return Object.freeze({
    throttle: command.throttle,
    steer: command.steer,
    jump: command.jumpHeld,
    boost: command.boostHeld,
    jumpSequence: command.jumpSequence,
  });
}

/** Read the exact V2 command sent to the authoritative server. */
export function getCurrentInputCommandV2(): Readonly<InputCommandV2> {
  return controller.getPayload();
}

export function advanceInputFloors(floors: { jumpSequence: number; cameraToggleSequence: number }): void {
  controller.advanceSequenceFloors(floors);
  notifyInput();
}

/** Send current input when changed, on room entry, or on the input heartbeat. */
export function sendInput(room: Room | null): void {
  if (!room) {
    activeRoom = null;
    controller.detachRoom();
    return;
  }

  activeRoom = room;
  controller.send(room, nowMs());
}
