import assert from 'node:assert/strict';
import test from 'node:test';
import { getCurrentInputCommandV2, initializeKeyboardInput, releaseHeldInput,
  setInputSuspended } from '../src/input/keyboard-handler.js';

test('keyboard bindings release held controls, uninstall fully and install once on remount', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowTarget });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentTarget });
  const key = (type: string, code: string) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat: false });
    windowTarget.dispatchEvent(event);
  };
  let stop = () => {};
  try {
    stop = initializeKeyboardInput();
    key('keydown', 'KeyW'); key('keydown', 'Space');
    assert.equal(getCurrentInputCommandV2().throttle, 1);
    const jump = getCurrentInputCommandV2().jumpSequence;
    stop(); stop();
    assert.equal(getCurrentInputCommandV2().throttle, 0);
    assert.equal(getCurrentInputCommandV2().jumpHeld, false);
    key('keydown', 'KeyW'); key('keydown', 'Space');
    assert.equal(getCurrentInputCommandV2().throttle, 0);
    assert.equal(getCurrentInputCommandV2().jumpSequence, jump);
    stop = initializeKeyboardInput();
    key('keydown', 'Space');
    assert.equal(getCurrentInputCommandV2().jumpSequence, jump + 1);
    releaseHeldInput();
    assert.equal(getCurrentInputCommandV2().jumpHeld, false);
    setInputSuspended(true);
    key('keydown', 'KeyW');
    assert.equal(getCurrentInputCommandV2().throttle, 0);
    stop();
    stop = initializeKeyboardInput();
    key('keydown', 'KeyW');
    assert.equal(getCurrentInputCommandV2().throttle, 1);
  } finally {
    stop();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
