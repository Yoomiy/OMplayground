import assert from "node:assert/strict";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type HostedScope = Readonly<{
  run: string;
  room: string;
  teacher: string;
  kid: string;
}>;
export function hostedCleanupSql(scope: HostedScope) {
  for (const value of [scope.run, scope.room, scope.teacher, scope.kid])
    assert(UUID.test(value), "invalid qualification UUID");
  const { run, room, teacher, kid } = scope;
  return `BEGIN;
DO $owned$ DECLARE worlds uuid[]; BEGIN
 IF EXISTS(SELECT FROM public.game_sessions WHERE id='${room}'::uuid AND (host_id IS DISTINCT FROM '${teacher}'::uuid OR invitation_code IS DISTINCT FROM 'vq-${run}')) THEN RAISE EXCEPTION 'qualification session ownership mismatch'; END IF;
 SELECT array_agg(world_id) INTO worlds FROM public.voxel_worlds WHERE session_id='${room}'::uuid;
 DELETE FROM public.audit_log WHERE actor_id IN ('${teacher}'::uuid,'${kid}'::uuid) AND entity_type='game_session' AND entity_id='${room}';
 DELETE FROM public.game_sessions WHERE id='${room}'::uuid AND host_id='${teacher}'::uuid AND invitation_code='vq-${run}';
 DELETE FROM public.voxel_objects WHERE world_id=ANY(worlds);
END $owned$;
COMMIT;
SELECT count(*) AS remaining_sessions FROM public.game_sessions WHERE id='${room}'::uuid;
`;
}

export const HOSTED_STATUS_RPCS = new Set([
  "voxel_persistence_status",
  "voxel_session_projection_status",
  "voxel_controls_status",
  "voxel_roster_status",
  "voxel_staff_status",
  "voxel_moderation_status",
  "voxel_chat_status",
  "voxel_media_status",
]);
const SESSION_RPCS = new Set([
  "voxel_acquire_room",
  "voxel_renew_room",
  "voxel_release_room",
  "voxel_initialize_session",
  "voxel_session_policy",
  "voxel_actor_policy",
  "voxel_accept_member_revision",
  "voxel_project_session",
  "voxel_commit_checkpoint",
  "voxel_begin_control",
  "voxel_finish_control",
  "voxel_control_receipt",
]);
export function ownedObjectKey(
  value: unknown,
  namespaces: ReadonlySet<string>,
) {
  return (
    typeof value === "string" &&
    /^v1\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/.test(value) &&
    namespaces.has(value.split("/")[1])
  );
}

/** A second boundary for the opt-in test; it never authorizes broad maintenance. */
export function checkHostedRequest(
  request: Request,
  args: Record<string, any> | undefined,
  scope: HostedScope,
  projectOrigin: string,
  namespaces: ReadonlySet<string>,
): "allow" | "deny-maintenance" {
  const url = new URL(request.url),
    path = url.pathname;
  assert.equal(url.origin, projectOrigin, "unexpected provider origin");
  if (path.startsWith("/rest/v1/rpc/")) {
    assert.equal(request.method, "POST");
    const rpc = path.split("/").at(-1)!;
    if (
      [
        "voxel_prune_checkpoints",
        "voxel_claim_garbage",
        "voxel_finish_garbage",
      ].includes(rpc)
    )
      return "deny-maintenance";
    assert(args);
    if (HOSTED_STATUS_RPCS.has(rpc)) {
      assert.equal(Object.keys(args).length, 0);
      return "allow";
    }
    assert(
      (SESSION_RPCS.has(rpc) && args.p_session === scope.room) ||
        (rpc === "voxel_prepare_object" &&
          ownedObjectKey(args.p_object?.key, namespaces)) ||
        (rpc === "voxel_complete_object" &&
          ownedObjectKey(args.p_key, namespaces)),
      "provider RPC outside owned session",
    );
    for (const actor of [
      args.p_actor,
      args.p_target,
      ...(args.p_participants ?? []),
    ])
      if (actor !== undefined && actor !== null)
        assert(
          [scope.teacher, scope.kid].includes(actor),
          "actor outside qualification",
        );
    if (args.p_objects)
      assert(
        args.p_objects.every((v: any) => ownedObjectKey(v.key, namespaces)),
      );
    if (args.p_pointer)
      assert(ownedObjectKey(args.p_pointer.object?.key, namespaces));
    return "allow";
  }
  if (path.startsWith("/storage/v1/object/")) {
    assert(
      ["GET", "POST"].includes(request.method),
      "unexpected service storage mutation",
    );
    const match = path.match(/\/voxel-checkpoints\/(v1\/.*)$/);
    assert(
      match && ownedObjectKey(match[1], namespaces),
      "storage outside owned namespace",
    );
    return "allow";
  }
  assert.equal(request.method, "GET");
  assert(
    [
      "/auth/v1/user",
      "/rest/v1/kid_profiles",
      "/rest/v1/admin_profiles",
      "/rest/v1/game_sessions",
      "/rest/v1/game_challenges",
    ].includes(path),
    "unexpected service table",
  );
  if (path.endsWith("game_sessions"))
    assert.equal(url.searchParams.get("id"), `eq.${scope.room}`);
  if (path.endsWith("game_challenges")) {
    assert.equal(url.searchParams.get("session_id"), `eq.${scope.room}`);
    assert.equal(url.searchParams.get("to_kid_id"), `eq.${scope.kid}`);
    assert.equal(url.searchParams.get("status"), "eq.accepted");
    assert.equal(url.searchParams.get("select"), "id");
  }
  if (path.endsWith("kid_profiles") || path.endsWith("admin_profiles"))
    assert(
      [`eq.${scope.teacher}`, `eq.${scope.kid}`].includes(
        url.searchParams.get("id")!,
      ),
    );
  return "allow";
}
