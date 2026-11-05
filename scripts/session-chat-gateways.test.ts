import assert from "node:assert/strict";
import { test } from "node:test";
import { PlatformGateway as RocketGateway } from "../games/rocket-arena/server/src/platform/gateway.ts";
import { PlatformGateway as WobbleGateway } from "../games/wobble-rush/src/platform/gateway.ts";
import type { Admission } from "../games/rocket-arena/server/src/platform/admission.ts";

for (const [game, Gateway] of [
  ["rocket", RocketGateway],
  ["wobble", WobbleGateway],
] as const) {
  test(`${game} chat keeps request IDs, validates replay identity and cannot overwrite moderated messages`, async () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    const admission: Admission = {
      observer: false,
      profile: {
        userId: "kid",
        name: "Trusted name",
        role: "kid",
        gender: "boy",
        grade: "ג",
      },
      session: {
        id: "room",
        host_id: "kid",
        gender: "boy",
        status: "playing",
        is_open: true,
        invitation_code: null,
        player_ids: ["kid"],
        player_names: ["Trusted name"],
        game_state: null,
        games: { game_url: game, is_active: true },
      },
    };
    let stored: Record<string, unknown> | undefined;
    const writes: Record<string, unknown>[] = [];
    const gateway = new Gateway(
      "https://fixture.invalid",
      "fixture-secret",
      (async (_input, init) => {
        if (init?.method === "POST") {
          assert.match(
            new Headers(init.headers).get("Prefer")!,
            /resolution=ignore-duplicates/,
          );
          const row = JSON.parse(String(init.body));
          writes.push(row);
          if (stored) return new Response("[]");
          stored = row;
          return new Response(JSON.stringify([row]));
        }
        return new Response(JSON.stringify(stored ? [stored] : []));
      }) as typeof fetch,
    );
    await gateway.sendChat(admission, " hello ", id);
    assert.deepEqual(stored, {
      id,
      session_id: "room",
      sender_id: "kid",
      sender_name: "Trusted name",
      message: "hello",
      is_system: false,
    });
    stored!.is_deleted = true;
    await gateway.sendChat(admission, "hello", id);
    assert.equal(stored!.is_deleted, true);
    await assert.rejects(
      gateway.sendChat(admission, "changed", id),
      /BAD_MESSAGE/,
    );
    await assert.rejects(
      gateway.sendChat(
        { ...admission, profile: { ...admission.profile, userId: "other" } },
        "hello",
        id,
      ),
      /BAD_MESSAGE/,
    );
    await assert.rejects(
      gateway.sendChat(
        { ...admission, session: { ...admission.session, id: "other" } },
        "hello",
        id,
      ),
      /BAD_MESSAGE/,
    );
    const count = writes.length;
    for (const invalid of ["forged", null, 12, "x".repeat(36)])
      await assert.rejects(
        gateway.sendChat(admission, "hello", invalid),
        /BAD_MESSAGE/,
      );
    await assert.rejects(
      gateway.sendChat({ ...admission, observer: true }, "hello", id),
      /READ_ONLY/,
    );
    assert.equal(writes.length, count);
    assert.equal(stored!.message, "hello");
    // Optional IDs keep previously deployed clients compatible.
    let legacyRow: Record<string, unknown> | undefined;
    const legacy = new Gateway(
      "https://fixture.invalid",
      "fixture-secret",
      (async (_input, init) => {
        legacyRow = JSON.parse(String(init?.body));
        return new Response("[]");
      }) as typeof fetch,
    );
    await legacy.sendChat(admission, "legacy");
    assert.equal(legacyRow!.id, undefined);
  });
}
