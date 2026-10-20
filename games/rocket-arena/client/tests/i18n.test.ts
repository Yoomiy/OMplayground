import assert from 'node:assert/strict';
import test from 'node:test';
import { hudText, ltr, resolveLanguage, t } from '../src/ui/i18n.js';
import { HUD_CONTROL_HINTS, HudModel, type HudSnapshotInput } from '../src/hud/hud-model.js';

test('Hebrew is the default and English is an explicit query override', () => {
  assert.equal(resolveLanguage(''), 'he');
  assert.equal(resolveLanguage('?lang=en'), 'en');
  assert.equal(resolveLanguage('?lang=he'), 'he');
  assert.equal(resolveLanguage('?lang=unknown'), 'he');
  assert.equal(t('Rocket Arena', {}, 'he'), 'רוקט ארנה');
  assert.equal(t('Rocket Arena', {}, 'en'), 'Rocket Arena');
});

test('interpolation preserves names and code characters as literal text', () => {
  assert.equal(t('Error: {message}', { message: 'אורי $& ABC234' }, 'he'), 'שגיאה: אורי $& ABC234');
  assert.equal(t('Error: {message}', { message: 'ABC234' }, 'en'), 'Error: ABC234');
  assert.equal(ltr('ABC234'), '\u2066ABC234\u2069');
  assert.equal(t('unrecognized developer diagnostic', {}, 'he'), 'unrecognized developer diagnostic');
});

const snapshot: HudSnapshotInput = {
  phase: 'playing', countdownKind: null, blueScore: 2, orangeScore: 1,
  regulationSecondsRemaining: 60, phaseSecondsRemaining: 0, winner: null,
  roomMode: 'custom', totalCapacity: 8, teamCapacity: 4, latestTransition: null,
  cars: [{ sessionId: 'local', team: 'blue', boost: 80 }],
};
const local = { localSessionId: 'local', cameraMode: 'ball' as const };

test('every HUD phase and camera has Hebrew presentation while numbers stay ordered', () => {
  for (const phase of ['waiting', 'countdown', 'goal-reset', 'overtime', 'ended', 'playing'] as const) {
    for (const countdownKind of [null, 'post-goal', 'overtime', 'initial'] as const) {
      const model = new HudModel();
      const view = model.project({ ...snapshot, phase, countdownKind: countdownKind as HudSnapshotInput['countdownKind'], winner: phase === 'ended' ? 'blue' : null }, local);
      for (const message of [view.phaseLabel, view.blue.label, view.blue.ariaLabel, view.orange.label,
        view.orange.ariaLabel, view.clock.ariaLabel, view.boost.ariaValueText, view.occupancy.ariaLabel,
        view.camera.text, view.camera.ariaLabel]) {
        assert.match(hudText(message, 'he'), /[א-ת]/, message);
        assert.equal(hudText(message, 'en'), message);
      }
    }
  }
  assert.equal(hudText('Time remaining: 1:09', 'he'), `הזמן שנותר: ${ltr('1:09')}`);
  for (const message of ['BALL CAM', 'CAR CAM', 'ORBIT', 'Camera: unavailable']) assert.match(hudText(message, 'he'), /[א-ת]/);
});

test('all authoritative event notices and announcements translate without changing event identity', () => {
  for (const [kind, goal, terminal] of [
    ['regulation-goal-reset', { team: 'blue', blueScore: 2, orangeScore: 1 }, null],
    ['regulation-terminal-goal', null, { winner: 'orange', blueScore: 2, orangeScore: 3 }],
    ['overtime-terminal-goal', null, { winner: 'blue', blueScore: 3, orangeScore: 2 }],
    ['hard-cutoff', null, { winner: 'blue', blueScore: 3, orangeScore: 2 }],
    ['overtime-entry', null, null],
  ] as const) {
    const model = new HudModel();
    const transition = { eventId: 77, kind, goal, terminal } as unknown as NonNullable<HudSnapshotInput['latestTransition']>;
    const view = model.project({ ...snapshot, latestTransition: transition }, local);
    assert.ok(view.announcement);
    assert.equal(view.announcement.eventId, 77);
    assert.match(hudText(view.centerText, 'he'), /[א-ת]/, view.centerText);
    assert.match(hudText(view.announcement.announcement, 'he'), /[א-ת]/);
    assert.doesNotMatch(hudText(view.announcement.announcement, 'he'), /Blue|Orange|wins|goal/);
    assert.equal(model.project({ ...snapshot, latestTransition: transition }, local).announcement, null);
  }
});

test('every real control hint translates without translating the physical key caps', () => {
  for (const hint of HUD_CONTROL_HINTS) {
    assert.match(t(hint.action, {}, 'he'), /[א-ת]/);
    assert.match(t(hint.ariaLabel, {}, 'he'), /[א-ת]/);
    for (const key of hint.keys) assert.equal(t(key, {}, 'he'), key);
  }
});

test('all settings rows translate while physical axis key order remains isolated', () => {
  for (const message of ['Lighter graphics', 'Shadows', 'Invert air pitch (W / S)',
    'Invert air roll (A / D)', 'Invert air yaw (Q / E)', 'Sound volume',
    'Mute sound', 'Ball floor marker', 'Control hints']) {
    assert.match(t(message, {}, 'he'), /[א-ת]/, message);
    assert.equal(t(message, {}, 'en'), message);
  }
  assert.ok(t('Invert air pitch (W / S)', {}, 'he').includes(ltr('W / S')));
  assert.equal(t('BLUE WINS!', {}, 'he'), 'הכחולים ניצחו!');
  assert.equal(t('ORANGE WINS!', {}, 'he'), 'הכתומים ניצחו!');
});
