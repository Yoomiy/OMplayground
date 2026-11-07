import { describe, it, expect } from 'vitest';
import { reconcileInbox } from './inboxReconciliation';
const row = (id: string, read = false) => ({ id, is_read: read, created_at: `2026-11-05T00:00:0${id}Z` });
describe('inbox reconciliation', () => {
  it('preserves messages inserted during a fetch without duplicating them', () => {
    expect(reconcileInbox([row('1')], [row('2'), row('2')])).toEqual([row('2'), row('1')]);
  });
  it('preserves read changes received after the snapshot began', () => {
    expect(reconcileInbox([row('1')], [row('1', true)])).toEqual([row('1', true)]);
  });
  it('allows the next authoritative snapshot to remove messages', () => {
    expect(reconcileInbox([], [])).toEqual([]);
  });
});
