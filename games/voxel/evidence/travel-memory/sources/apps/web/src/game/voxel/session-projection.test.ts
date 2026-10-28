import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { currentPresence, readSessionProjection } from "./session-projection";
it("expires public presence without a headcount limit or trusting stale arrays after completion", () => {
  const ids = Array.from({ length: 129 }, () => randomUUID()),
    now = Date.now();
  const value = {
    id: randomUUID(),
    host_id: ids[0],
    host_name: "Host",
    status: "playing",
    connected_player_ids: ids,
    connected_player_names: ids.map((_, i) => "Player " + i),
    voxel_presence_expires_at: new Date(now + 15000).toISOString(),
  };
  const state = readSessionProjection(value);
  expect(currentPresence(state, now)).toHaveLength(129);
  expect(currentPresence(state, now + 15000)).toEqual([]);
  expect(
    currentPresence(
      readSessionProjection({ ...value, status: "completed" }),
      now,
    ),
  ).toEqual([]);
  expect(() =>
    readSessionProjection({ ...value, connected_player_names: [] }),
  ).toThrow("SESSION_PROTOCOL");
});
