import { resolveRematch } from './rematch';
const vote = { eligible: ['a', 'b', 'c'], connected: ['a', 'b', 'c'], accepted: ['a', 'b'], refused: [], deadline: 30_000, now: 0, minimum: 2 };
test('waits for unanswered connected voters before deadline', () => {
  expect(resolveRematch(vote).phase).toBe('waiting');
});
test('starts with connected consent at deadline', () => {
  expect(resolveRematch({ ...vote, now: 30_000 })).toEqual({ phase: 'ready', players: ['a', 'b'] });
});
test('departure resolves outstanding votes', () => {
  expect(resolveRematch({ ...vote, connected: ['a', 'b'] }).phase).toBe('ready');
});
test('departed acceptors never count toward minimum', () => {
  expect(resolveRematch({ ...vote, connected: ['a'], now: 30_000 }).phase).toBe('cancelled');
});
test('late arrivals do not vote or become rematch players', () => {
  expect(resolveRematch({ ...vote, connected: ['a', 'b', 'late'], accepted: ['a', 'b', 'late'] })).toEqual({ phase: 'ready', players: ['a', 'b'] });
});
test('decline cancels when minimum becomes impossible', () => {
  expect(resolveRematch({ ...vote, refused: ['b', 'c'] }).phase).toBe('cancelled');
});
test('supports games with bots and one human', () => {
  expect(resolveRematch({ ...vote, connected: ['a'], minimum: 1 }).phase).toBe('ready');
});
test('a transient disconnect gets a bounded chance to reconnect', () => {
  expect(resolveRematch({ ...vote, connected: ['a'], grace: { b: 10_000 } }).phase).toBe('waiting');
  expect(resolveRematch({ ...vote, connected: ['a'], grace: { b: 10_000 }, now: 10_000 }).phase).toBe('cancelled');
  expect(resolveRematch({ ...vote, connected: ['a', 'b'], grace: { b: 10_000 } }).phase).toBe('ready');
});
