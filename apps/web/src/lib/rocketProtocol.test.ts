import { describe, expect, it } from 'vitest';
import { isRocketServiceCompatible, isRocketView, rocketError, rocketServiceUrl } from './rocketProtocol';

describe('Rocket frame boundary', () => {
  it('rejects the old backend before reserving a room for unsupported waiting-room controls', () => {
    expect(isRocketServiceCompatible({ protocol: 1, appOrigins: ['http://localhost:5173'] })).toBe(false);
    for (const value of [null, {}, { protocol: 1, capabilities: 'lobby-controls' }, { protocol: 2, capabilities: ['lobby-controls', 'session-chat', 'voice'] }]) {
      expect(isRocketServiceCompatible(value)).toBe(false);
    }
    expect(isRocketServiceCompatible({ protocol: 1, capabilities: ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch', 'save-outcomes', 'platform-only'], release: 'app-build' })).toBe(true);
    expect(isRocketServiceCompatible({ protocol: 1, capabilities: ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch', 'save-outcomes'] })).toBe(false);
    expect(isRocketServiceCompatible({ protocol: 1, capabilities: ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch'] })).toBe(false);
    expect(isRocketServiceCompatible({ protocol: 1, capabilities: ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster'] })).toBe(false);
    expect(rocketError('SERVICE_OUTDATED')).toContain('להפעיל מחדש');
    expect(rocketError('BAD_CONTROL')).toContain('להפעיל מחדש');
    expect(rocketError('SESSION_CHANGED')).toContain('החדר השתנה');
    expect(rocketError('SAVE_UNCONFIRMED')).toContain('לא התקבל אישור');
  });
  it('accepts the declared service origin and rejects credentials, paths and insecure production URLs', () => {
    expect(rocketServiceUrl('https://rocket.example/')).toBe('https://rocket.example');
    expect(rocketServiceUrl(undefined, true)).toBe('http://localhost:3000');
    for (const url of [undefined, 'http://rocket.example', 'https://user:secret@rocket.example', 'https://rocket.example/path', 'https://rocket.example/?token=secret']) {
      expect(() => rocketServiceUrl(url)).toThrow();
    }
  });
  it('validates session identity and roster before rendering names or controls', () => {
    const state = { version: 1, sessionId: 'session', actorId: 'rocket-0', observer: false, pending: false,
      selfUserId: 'kid', hostUserId: 'kid', pendingPlayers: [], observers: [],
      paused: false, phase: 'playing', canControl: true, canModerate: false, canRematch: false, rematch: null, score: { blue: 0, orange: 0 },
      players: Array.from({ length: 8 }, (_, index) => ({ actorId: `rocket-${index}`, name: 'אורמן <חבר>',
        kind: index ? 'bot' : 'human', userId: index ? null : 'kid', connected: index === 0, team: index % 2 ? 'orange' : 'blue' })) };
    expect(isRocketView(state, 'session')).toBe(true);
    expect(isRocketView({ ...state, score: { blue: -1, orange: 0 } }, 'session')).toBe(false);
    expect(isRocketView({ ...state, score: null }, 'session')).toBe(false);
    expect(isRocketView(state, 'other-session')).toBe(false);
    expect(isRocketView({ ...state, actorId: 'invalid' }, 'session')).toBe(false);
    expect(isRocketView({ ...state, players: [null] }, 'session')).toBe(false);
    expect(isRocketView({ ...state, players: state.players.map(() => state.players[0]) }, 'session')).toBe(false);
    expect(isRocketView({ ...state, pendingPlayers: [{ userId: 'late', name: 'חבר', connected: true, actorId: 'rocket-9' }] }, 'session')).toBe(false);
    expect(isRocketView({ ...state, observers: [{ userId: 'teacher', name: 'מורה', role: 'kid' }] }, 'session')).toBe(false);
    expect(isRocketView({ ...state, canModerate: 'yes' }, 'session')).toBe(false);
    expect(isRocketView({ ...state, canRematch: true, rematch: { accepted: ['kid'], refused: [] } }, 'session')).toBe(true);
    for (const rematch of [{}, { accepted: ['kid'], refused: ['kid'] }, { accepted: ['kid', 'kid'], refused: [] },
      { accepted: 'kid', refused: [] }, { accepted: [], refused: [null] }]) {
      expect(isRocketView({ ...state, rematch }, 'session')).toBe(false);
    }
  });
});
