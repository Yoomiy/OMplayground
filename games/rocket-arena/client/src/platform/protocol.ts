import type { Client } from 'colyseus.js';
export type PlatformReservation = Parameters<Client['consumeSeatReservation']>[0];
export interface PlatformView {
  version: 1;
  sessionId: string;
  actorId: string | null;
  observer: boolean;
  pending: boolean;
  paused: boolean;
  phase: string;
  hostUserId: string | null;
  selfUserId: string;
  pendingPlayers: { userId: string; name: string; connected: boolean; actorId: string | null }[];
  observers: { userId: string; name: string; role: 'teacher' | 'admin' }[];
  canControl: boolean;
  canModerate: boolean;
  canRematch: boolean;
  score: { blue: number; orange: number };
  rematch: { accepted: string[]; refused: string[] } | null;
  inputFloor: { jumpSequence: number; cameraToggleSequence: number } | null;
  players: { actorId: string; name: string; kind: 'human' | 'bot' | 'empty'; userId: string | null; connected: boolean; team: string }[];
}
export function isPlatformView(value: unknown, sessionId: string): value is PlatformView {
  if (!value || typeof value !== 'object') return false;
  const view = value as PlatformView;
  return view.version === 1 && view.sessionId === sessionId
    && (view.actorId === null || /^rocket-[0-7]$/.test(view.actorId))
    && ['observer', 'pending', 'paused', 'canControl', 'canModerate', 'canRematch'].every(key => typeof view[key as keyof PlatformView] === 'boolean')
    && ['waiting', 'countdown', 'playing', 'goal-reset', 'overtime', 'ended'].includes(view.phase)
    && (view.inputFloor === null || (Number.isSafeInteger(view.inputFloor?.jumpSequence) && view.inputFloor.jumpSequence >= 0
      && Number.isSafeInteger(view.inputFloor?.cameraToggleSequence) && view.inputFloor.cameraToggleSequence >= 0))
    && typeof view.selfUserId === 'string' && (view.hostUserId === null || typeof view.hostUserId === 'string')
    && !!view.score && ['blue', 'orange'].every(key => {
      const score = view.score[key as 'blue' | 'orange'];
      return Number.isSafeInteger(score) && score >= 0;
    })
    && (view.rematch === null || !!view.rematch && ['accepted', 'refused'].every(key => {
      const ids = view.rematch![key as 'accepted' | 'refused'];
      return Array.isArray(ids) && ids.length <= 8 && ids.every(id => typeof id === 'string' && id.length <= 80)
        && new Set(ids).size === ids.length;
    }) && !view.rematch.accepted.some(id => view.rematch!.refused.includes(id)))
    && Array.isArray(view.pendingPlayers) && view.pendingPlayers.length <= 8
    && view.pendingPlayers.every(player => player && typeof player.userId === 'string'
      && typeof player.name === 'string' && player.name.length <= 80 && typeof player.connected === 'boolean'
      && (player.actorId === null || typeof player.actorId === 'string' && /^rocket-[0-7]$/.test(player.actorId)))
    && new Set(view.pendingPlayers.map(player => player.userId)).size === view.pendingPlayers.length
    && Array.isArray(view.observers) && view.observers.length <= 8
    && view.observers.every(player => player && typeof player.userId === 'string'
      && typeof player.name === 'string' && player.name.length <= 80 && ['teacher', 'admin'].includes(player.role))
    && Array.isArray(view.players) && view.players.length === 8
    && view.players.every(player => player && /^rocket-[0-7]$/.test(player.actorId) && typeof player.name === 'string' && player.name.length <= 80
      && ['human', 'bot', 'empty'].includes(player.kind) && ['blue', 'orange'].includes(player.team)
      && typeof player.connected === 'boolean' && (player.userId === null || typeof player.userId === 'string'))
    && new Set(view.players.map(player => player.actorId)).size === 8;
}
