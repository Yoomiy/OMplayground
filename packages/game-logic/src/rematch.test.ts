import { resolveRematch } from './rematch';
const vote = { eligible: ['a', 'b', 'c'], connected: ['a', 'b', 'c'], accepted: ['a', 'b'], refused: [], deadline: 30_000, now: 0, minimum: 2 };
test('waits for unanswered connected voters before deadline', () => {
  expect(resolveRematch(vote).phase).toBe('waiting');
});
test('starts with connected consent at deadline', () => {
  expect(resolveRematch({ ...vote, now: 30_000 })).toEqual({ phase: 'ready', players: ['a', 'b'] });
});
test('departure closes the offer instead of starting without the missing voter', () => {
  expect(resolveRematch({ ...vote, connected: ['a', 'b'] }).phase).toBe('cancelled');
});
test('departed acceptors never count toward minimum', () => {
  expect(resolveRematch({ ...vote, connected: ['a'], now: 30_000 }).phase).toBe('cancelled');
});
test('late arrivals do not vote or become rematch players', () => {
  expect(resolveRematch({ ...vote, eligible: ['a','b'], connected: ['a', 'b', 'late'], accepted: ['a', 'b', 'late'] })).toEqual({ phase: 'ready', players: ['a', 'b'] });
});
test('decline cancels when minimum becomes impossible', () => {
  expect(resolveRematch({ ...vote, refused: ['b', 'c'] }).phase).toBe('cancelled');
});
test('supports games with bots and one human', () => {
  expect(resolveRematch({ ...vote, eligible: ['a'], connected: ['a'], minimum: 1 }).phase).toBe('ready');
});
test('finished-game disconnection closes the offer without a grace-period wait', () => {
  expect(resolveRematch({ ...vote, connected: ['a'], grace: { b: 10_000 } }).phase).toBe('cancelled');
});
test('decline closes an offer even if enough players could continue with bots', () => {
  expect(resolveRematch({ ...vote, refused: ['c'], minimum: 1 }).phase).toBe('cancelled');
});
