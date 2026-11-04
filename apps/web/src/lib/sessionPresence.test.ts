import { expect, it } from "vitest";
import { freshSessionPresence } from "./sessionPresence";
it("expires new voxel discovery/rejoin presence while preserving board-game semantics and active list identity", () => {
  const now = Date.now(),
    active = {
      games: { game_url: "minecraft" },
      connected_player_ids: ["kid"],
      connected_player_names: ["Kid"],
      voxel_presence_expires_at: new Date(now + 100).toISOString(),
    };
  expect(freshSessionPresence(active, now)).toBe(active);
  expect(freshSessionPresence(active, now + 100).connected_player_ids).toEqual(
    [],
  );
  const board = {
    ...active,
    games: { game_url: "chess" },
    voxel_presence_expires_at: null,
  };
  expect(freshSessionPresence(board, now)).toBe(board);
  const empty = freshSessionPresence(active, now + 100);
  expect(freshSessionPresence(empty, now + 200)).toBe(empty);
});
