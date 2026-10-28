import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import type { ServerMessage } from "../../../../games/voxel/src/shared/protocol.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { schoolFixture } from "../helpers/school-fixture.ts";
import { MemoryCheckpoints } from "../../../../games/voxel/tests/fixtures/checkpoint-storage.ts";
import { CheckpointStorage } from "../../../../games/voxel/src/server/checkpoint-storage.ts";
import { GameRoom } from "../../../../games/voxel/src/sim/game-room.ts";
import { WorldStore } from "../../../../games/voxel/src/sim/world-store.ts";
import { Explosives } from "../../../../games/voxel/src/sim/explosives.ts";
import {
  initSync,
  set_content,
  VoxelWorld,
  TerrainGen,
} from "../../../../games/voxel/engine/pkg/voxel_engine.js";
import { setTimeout as delay } from "node:timers/promises";

const build = JSON.parse(
  readFileSync(
    new URL("../../../../games/voxel/artifacts/build.json", import.meta.url),
    "utf8",
  ),
);
const content = JSON.parse(
  readFileSync(
    new URL("../../../../games/voxel/artifacts/content.json", import.meta.url),
    "utf8",
  ),
);
async function harness(seedOfflineTnt = false) {
  const f = schoolFixture();
  f.setNow(Date.now());
  f.state.onRequest = () => f.setNow(Date.now());
  f.state.defaults = Array.from({ length: 7 }, (_, day_of_week) => ({
    day_of_week,
    start_time: "00:00:00",
    end_time: "24:00:00",
    is_active: true,
  }));
  const backend = seedOfflineTnt ? new MemoryCheckpoints() : null;
  if (backend) {
    initSync({
      module: readFileSync(
        new URL(
          "../../../../games/voxel/engine/pkg/voxel_engine_bg.wasm",
          import.meta.url,
        ),
      ),
    });
    set_content(JSON.stringify(content));
    const lease = (await backend.acquire(f.room, "seed"))!,
      room = new GameRoom(
        new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
        content,
        build,
        { send() {}, close() {} },
        lease.worldId,
        4242,
        0,
        0,
        "survival",
      );
    try {
      room.join(
        (await f.access.authorize(f.token(), { room: f.room })).actor,
        "seed",
        0,
      );
      const p = room.checkpoint(0).spawn,
        rule = content.behavior.find(
          (block: any) => block.family === "tnt",
        ).explosive;
      room.explosives.add(
        f.kid,
        content.blocks.findIndex((block: any) => block.name === "tnt"),
        [p[0] + 8, p[1] + 0.1, p[2] + 8],
        rule,
      );
      await new CheckpointStorage(
        lease.worldId,
        backend,
        backend,
        content,
        build,
      ).save(lease, 1, room.checkpoint(0));
      await backend.release(lease);
    } finally {
      room.dispose();
    }
  }
  const gateway = await createGateway({
    build,
    content,
    ...schoolGatewayPolicy(f.access),
    ...(backend
      ? { persistence: { objects: backend, metadata: backend } }
      : {}),
    worldDefaults: { mode: "survival" },
    allowedOrigins: ["https://school.example"],
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  const probes: SocketProbe[] = [];
  const ticket = async (id = f.kid, extra: Record<string, unknown> = {}) => {
    const response = await fetch(origin + "/api/voxel/admission", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${f.token(id)}`,
        "Content-Type": "application/json",
        Origin: "https://school.example",
      },
      body: JSON.stringify({ room: f.room, ...extra }),
    });
    const value = (await response.json()) as {
      ticket: string;
      buildId: string;
      error?: string;
    };
    return { response, value };
  };
  const connect = async (value: { ticket: string; buildId: string }) => {
    const probe = new SocketProbe(
      origin.replace(/^http/, "ws") + "/voxel",
      content.blocks.length,
    );
    probes.push(probe);
    await once(probe.socket, "open");
    probe.send({ type: "hello", ...value });
    return probe;
  };
  return {
    f,
    backend,
    gateway,
    origin,
    ticket,
    connect,
    async close() {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    },
  };
}
async function ready(probe: SocketProbe) {
  const baseline = await probe.ready();
  probe.send({ type: "focus", epoch: baseline.epoch, active: true });
  return probe.wait(
    (event): event is Extract<ServerMessage, { type: "baseline" }> =>
      "type" in event && event.type === "baseline" && event.reason === "focus",
  );
}

test(
  "school admission supports the configured browser origin and rejects foreign preflights before authenticating",
  { timeout: 10000 },
  async () => {
    const h = await harness();
    try {
      for (const [origin, status] of [
        ["https://school.example", 204],
        ["https://foreign.example", 403],
      ] as const) {
        const response = await fetch(h.origin + "/api/voxel/admission", {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
          },
        });
        assert.equal(response.status, status);
        assert.equal(
          response.headers.get("Access-Control-Allow-Origin"),
          status === 204 ? origin : null,
        );
      }
      assert.equal(h.f.requests.length, 0);
      const admitted = await h.ticket();
      assert.equal(admitted.response.status, 200);
      assert.equal(
        admitted.response.headers.get("Access-Control-Allow-Origin"),
        "https://school.example",
      );
      const unauthorized = await fetch(h.origin + "/api/voxel/admission", {
        method: "POST",
        headers: {
          Origin: "https://school.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room: h.f.room }),
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(
        unauthorized.headers.get("Access-Control-Allow-Origin"),
        "https://school.example",
      );
    } finally {
      await h.close();
    }
  },
);

test(
  "an inactive account or rotated invitation cannot consume an earlier ticket and allocates no world",
  { timeout: 10000 },
  async () => {
    const h = await harness();
    try {
      const account = await h.ticket();
      assert.equal(account.response.status, 200);
      h.f.profiles.get(h.f.kid)!.is_active = false;
      assert.equal(
        (await (await h.connect(account.value)).event("error")).code,
        "UNAUTHORIZED",
      );
      h.f.state.session.is_open = false;
      const invitation = await h.ticket(h.f.guest, {
        invitationCode: "join-test",
      });
      assert.equal(invitation.response.status, 200);
      h.f.state.session.invitation_code = "rotated";
      assert.equal(
        (await (await h.connect(invitation.value)).event("error")).code,
        "UNAUTHORIZED",
      );
      assert.equal(h.gateway.rooms.size, 0);
    } finally {
      await h.close();
    }
  },
);

test(
  "school staff observe invisibly and fly in survival while player participation retains school partition rules",
  { timeout: 15000 },
  async () => {
    const h = await harness();
    try {
      assert.equal(
        (await h.ticket(h.f.teacher, { participation: "player" })).response
          .status,
        403,
      );
      const kid = await h.connect((await h.ticket()).value);
      const kidBaseline = await ready(kid);
      const staff = await h.connect((await h.ticket(h.f.teacher)).value);
      const welcome = await staff.event("welcome");
      assert.equal(welcome.role, "observer");
      assert.equal(welcome.mode, "survival");
      assert.equal(welcome.combat, false);
      assert.equal(welcome.explosives, false);
      const baseline = await ready(staff);
      staff.send({
        type: "flight",
        epoch: baseline.epoch,
        sequence: 1,
        on: true,
      });
      assert.equal((await staff.event("result")).outcome?.ok, true);
      const flying = await staff.wait(
        (event): event is Extract<ServerMessage, { type: "baseline" }> =>
          "type" in event &&
          event.type === "baseline" &&
          event.reason === "flight",
      );
      staff.send({
        type: "action",
        epoch: flying.epoch,
        sequence: 2,
        inputSequence: 0,
        kind: "remove",
        target: [0, 100, 0],
        state: 0,
        inventoryRevision: 0,
        revisions: [{ x: 0, z: 0, revision: 0 }],
      });
      const denied = await staff.wait(
        (event): event is Extract<ServerMessage, { type: "result" }> =>
          "type" in event && event.type === "result" && event.sequence === 2,
      );
      assert.equal(denied.outcome?.reason, "forbidden");
      kid.send({
        type: "flight",
        epoch: kidBaseline.epoch,
        sequence: 1,
        on: true,
      });
      assert.equal((await kid.event("result")).outcome?.reason, "forbidden");
      assert.equal(
        kid.events.some(
          (event) =>
            "type" in event &&
            event.type === "actor_joined" &&
            event.actor.id === h.f.teacher,
        ),
        false,
      );
      await staff.wait(
        (event): event is Extract<ServerMessage, { type: "actor_joined" }> =>
          "type" in event &&
          event.type === "actor_joined" &&
          event.actor.id === h.f.kid,
      );
      assert.equal(
        kid.events.some(
          (event) =>
            "type" in event &&
            event.type === "snapshot" &&
            event.actors.some((actor) => actor.id === h.f.teacher),
        ),
        false,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  "the school SDK refreshes an offline TNT owner, holds through profile outages and fizzles after account deactivation",
  { timeout: 12000 },
  async () => {
    const h = await harness(true);
    try {
      // This policy-only fixture has no platform membership writer. The active
      // guest is already rostered; real SQL acceptance is verified separately.
      h.f.state.session.player_ids.push(h.f.guest);
      let ownerReads = 0;
      h.f.state.outageId = h.f.kid;
      h.f.state.onRequest = (path) => {
        h.f.setNow(Date.now());
        if (
          path === "kid_profiles" &&
          h.f.requests.at(-1)!.query.get("id") === `eq.${h.f.kid}` &&
          ++ownerReads > 1
        )
          h.f.state.outage = "kid_profiles";
      };
      const staff = await h.connect((await h.ticket(h.f.teacher)).value);
      await ready(staff);
      const guest = await h.connect((await h.ticket(h.f.guest)).value);
      await ready(guest);
      await delay(4300);
      const backend = h.backend!,
        row = backend.rows.get(h.f.room)!;
      const storage = new CheckpointStorage(
        row.worldId,
        backend,
        backend,
        content,
        build,
      );
      const held = await storage.load(await h.gateway.save(h.f.room, true));
      const bombs = Explosives.fromCheckpoint(
        content,
        held.explosives,
      ).checkpoint(content).entries;
      assert.ok(ownerReads >= 3);
      assert.equal(bombs.length, 1);
      assert.equal(bombs[0].remaining, 0);
      assert.equal(bombs[0].owner, h.f.kid);
      h.f.profiles.get(h.f.kid)!.is_active = false;
      h.f.state.onRequest = () => h.f.setNow(Date.now());
      h.f.state.outage = "";
      h.gateway.resume(h.f.room);
      assert.equal((await staff.event("explosion")).cancelled, true);
      const finished = await storage.load(await h.gateway.save(h.f.room, true));
      assert.equal(
        Explosives.fromCheckpoint(content, finished.explosives).size,
        0,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  "recess closure pauses earned world time and TNT while staff inspect; earlier tickets cannot override it and fresh admission resumes",
  { timeout: 15000 },
  async () => {
    const h = await harness(true);
    try {
      const kid = await h.connect((await h.ticket()).value),
        beforeEpoch = (await ready(kid)).epoch;
      const staff = await h.connect((await h.ticket(h.f.teacher)).value);
      await ready(staff);
      const spare = await h.ticket(),
        schedules = h.f.state.defaults,
        at = staff.events.length;
      h.f.state.defaults = [];
      assert.equal((await kid.event("error")).code, "UNAUTHORIZED");
      await staff.wait(
        (event): event is Extract<ServerMessage, { type: "lifecycle" }> =>
          "type" in event &&
          event.type === "lifecycle" &&
          event.state === "paused" &&
          event.reason === "no_participants" &&
          staff.events.indexOf(event) >= at,
      );
      const backend = h.backend!,
        row = backend.rows.get(h.f.room)!,
        storage = new CheckpointStorage(
          row.worldId,
          backend,
          backend,
          content,
          build,
        );
      const first = await storage.load(await h.gateway.save(h.f.room, false));
      const fuse = Explosives.fromCheckpoint(
        content,
        first.explosives,
      ).checkpoint(content).entries[0].remaining;
      assert.ok(fuse > 0);
      h.gateway.resume(h.f.room);
      await delay(200);
      const paused = await storage.load(await h.gateway.save(h.f.room, false));
      assert.equal(paused.tick, first.tick);
      assert.deepEqual(paused.explosives, first.explosives);
      assert.equal((await h.ticket()).response.status, 403);
      assert.equal(
        (await (await h.connect(spare.value)).event("error")).code,
        "UNAUTHORIZED",
      );
      h.f.state.defaults = schedules;
      const returned = await h.connect((await h.ticket()).value);
      assert.ok((await ready(returned)).epoch > beforeEpoch);
      await delay(100);
      const resumed = await storage.load(await h.gateway.save(h.f.room, false));
      assert.ok(resumed.tick > paused.tick && resumed.tick < paused.tick + 15);
    } finally {
      await h.close();
    }
  },
);

test(
  "connected school accounts lose authority on revocation and provider outages close with a retryable recovery reason",
  { timeout: 15000 },
  async () => {
    const h = await harness();
    try {
      const kid = await h.connect((await h.ticket()).value);
      await ready(kid);
      h.f.profiles.get(h.f.kid)!.is_active = false;
      assert.equal((await kid.event("error")).code, "UNAUTHORIZED");
      h.f.profiles.get(h.f.kid)!.is_active = true;
      const next = await h.connect((await h.ticket()).value);
      await ready(next);
      h.f.state.outage = "kid_profiles";
      const error = await next.event("error");
      assert.equal(error.code, "RECOVERING");
      assert.equal(error.retryable, true);
      assert.equal(
        JSON.stringify(error).includes("private-provider-message"),
        false,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  "accepted membership removal revokes a connected open-room child and a prior unaccepted ticket cannot restore it",
  { timeout: 10000 },
  async () => {
    const h = await harness();
    try {
      const oldTicket = (await h.ticket(h.f.guest)).value;
      const kid = await h.connect((await h.ticket()).value);
      await ready(kid);
      h.f.state.session.player_ids = [];
      h.f.state.session.host_id = h.f.guest;
      h.f.state.session.voxel_roster_revision++;
      const old = await h.connect(oldTicket);
      assert.equal((await old.event("error")).code, "UNAUTHORIZED");
      assert.equal((await kid.event("error")).code, "UNAUTHORIZED");
      assert.equal(
        kid.events.some((event) => "type" in event && event.type === "welcome"),
        true,
      );
    } finally {
      await h.close();
    }
  },
);
