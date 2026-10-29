import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { SchoolVoice, SupabaseMedia } from "../src/school-media.ts";
import { SchoolAccess } from "../src/school-access.ts";
import { VoiceSignaling } from "../src/voice-signaling.ts";
import type { VoiceSignalGrant } from "../src/voice-signaling.ts";
import type { GatewayApiContext } from "../../../games/voxel/src/server/gateway.ts";

function fixture(lost = false, stale = false) {
  const actor = randomUUID(),
    room = randomUUID();
  let current: ReturnType<GatewayApiContext["actor"]> = {
    connection: randomUUID(),
    role: "participant",
    admissionRevision: 0,
    expiresAt: Date.now() + 20,
    worldId: randomUUID(),
    owner: randomUUID(),
    epoch: 1,
  };
  let grant: VoiceSignalGrant | undefined;
  const subject = { id: actor, role: "kid", gender: "boy", grade: "ג" };
  const access = {
    identity: async () => ({ subject }),
    authorize: async () => {
      // The game renews its same connection while the separate media read runs.
      current = { ...current!, expiresAt: Date.now() + 5000 };
      await delay(40);
      if (lost) current = null;
      return {
        subject,
        actor: { role: "participant" },
        expiresAt: Date.now() + (stale ? -1 : 4000),
      };
    },
  } as unknown as SchoolAccess;
  const media = {
    authorize: async () => ({
      revision: 0,
      cutoff: 0,
      publish: true,
      hidden: false,
    }),
  } as unknown as SupabaseMedia;
  const signal = {
    issue: (value: VoiceSignalGrant) => {
      grant = value;
      return { ticket: "a".repeat(43), expiresAt: value.expiresAt };
    },
  } as unknown as VoiceSignaling;
  const voice = new SchoolVoice(access, media, signal, {
    endpoint: "wss://fixture.invalid",
    key: "fixture-key",
    secret: "fixture-private-key-for-tests-only",
  });
  return {
    voice,
    room,
    context: { actor: () => current, revoke() {} },
    grant: () => grant,
  };
}

test("voice admission uses the still-authorized current game connection after concurrent renewal", async () => {
  const f = fixture();
  const ticket = await f.voice.issue(f.room, "fixture-user-token", f.context);
  assert.ok(ticket.expiresAt > Date.now() + 3000);
  assert.ok(f.grant());
});

test("concurrent connection loss or an expired independent school proof cannot issue voice", async () => {
  for (const [lost, stale] of [
    [true, false],
    [false, true],
  ]) {
    const f = fixture(lost, stale);
    await assert.rejects(
      f.voice.issue(f.room, "fixture-user-token", f.context),
    );
    assert.equal(f.grant(), undefined);
  }
});
