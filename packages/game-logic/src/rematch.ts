/** Pure consent policy shared by the platform game services. */
export function resolveRematch(args: {
  eligible: readonly string[]; connected: readonly string[]; accepted: readonly string[];
  grace?: Readonly<Record<string, number>>;
  refused: readonly string[]; deadline: number; now: number; minimum: number;
}): { phase: 'waiting' | 'cancelled' | 'ready'; players: string[] } {
  const connected = args.connected.filter(id => args.eligible.includes(id));
  // A finished game's offer ends as soon as anyone declines or leaves.
  if (args.refused.length || args.eligible.some(id => !connected.includes(id))) return { phase: 'cancelled', players: [] };
  const possible = connected.filter(id => !args.refused.includes(id));
  const players = connected.filter(id => args.accepted.includes(id) && !args.refused.includes(id));
  if (possible.length < args.minimum) return { phase: 'cancelled', players: [] };
  if (args.now < args.deadline && connected.some(id => !args.accepted.includes(id) && !args.refused.includes(id))) return { phase: 'waiting', players };
  return { phase: players.length >= args.minimum ? 'ready' : 'cancelled', players };
}
