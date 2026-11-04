const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type SessionProjection = Readonly<{
  id: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "paused" | "completed";
  connected: readonly Readonly<{ id: string; name: string }>[];
  presenceUntil: number;
}>;
/** This is UI data, never a gameplay/admission grant. Hidden observers are absent. */
export function readSessionProjection(value: unknown): SessionProjection {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("SESSION_PROTOCOL");
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    !UUID.test(v.id) ||
    typeof v.host_id !== "string" ||
    !UUID.test(v.host_id) ||
    typeof v.host_name !== "string" ||
    !["waiting", "playing", "paused", "completed"].includes(
      v.status as string,
    ) ||
    !Array.isArray(v.connected_player_ids) ||
    !v.connected_player_ids.every(
      (id) => typeof id === "string" && UUID.test(id),
    ) ||
    !Array.isArray(v.connected_player_names) ||
    !v.connected_player_names.every((name) => typeof name === "string") ||
    v.connected_player_ids.length !== v.connected_player_names.length ||
    !(
      v.voxel_presence_expires_at === null ||
      (typeof v.voxel_presence_expires_at === "string" &&
        Number.isFinite(Date.parse(v.voxel_presence_expires_at)))
    )
  )
    throw new Error("SESSION_PROTOCOL");
  return Object.freeze({
    id: v.id,
    hostId: v.host_id,
    hostName: v.host_name,
    status: v.status as SessionProjection["status"],
    connected: Object.freeze(
      v.connected_player_ids.map((id, index) =>
        Object.freeze({
          id,
          name: (v.connected_player_names as string[])[index],
        }),
      ),
    ),
    presenceUntil:
      v.voxel_presence_expires_at === null
        ? 0
        : Date.parse(v.voxel_presence_expires_at as string),
  });
}
export function currentPresence(
  session: SessionProjection | null,
  now: number,
) {
  return session &&
    session.status !== "completed" &&
    session.presenceUntil > now
    ? session.connected
    : [];
}
