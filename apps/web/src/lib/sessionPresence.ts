/** Expiring voxel arrays are UI data; board-game presence retains its current contract. */
export function freshSessionPresence<
  T extends {
    connected_player_ids?: string[];
    connected_player_names?: string[];
    voxel_presence_expires_at?: string | null;
    games?: { game_url?: string } | null;
  },
>(row: T, now = Date.now()): T {
  const voxel =
    row.games?.game_url === "minecraft" ||
    typeof row.voxel_presence_expires_at === "string";
  if (
    !voxel ||
    (typeof row.voxel_presence_expires_at === "string" &&
      Date.parse(row.voxel_presence_expires_at) > now) ||
    (!row.connected_player_ids?.length && !row.connected_player_names?.length)
  )
    return row;
  return { ...row, connected_player_ids: [], connected_player_names: [] };
}
