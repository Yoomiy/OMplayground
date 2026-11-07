/** Overlay events received during a fetch, then apply the inbox's newest-first window. */
export function reconcileInbox<T extends { id: string; created_at: string }>(snapshot: T[], changes: T[]): T[] {
  const rows = new Map(snapshot.map(row => [row.id, row]));
  for (const row of changes) rows.set(row.id, { ...rows.get(row.id), ...row });
  return [...rows.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 200);
}
