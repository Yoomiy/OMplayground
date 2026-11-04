import { developmentAdmission } from "../../../../games/voxel/tools/development-admission.ts";
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { createSupabasePersistence } from "../../src/supabase-persistence.ts";
import { CheckpointStorage } from "../../../../games/voxel/src/server/checkpoint-storage.ts";
import { GameRoom } from "../../../../games/voxel/src/sim/game-room.ts";
import { WorldStore } from "../../../../games/voxel/src/sim/world-store.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { connectProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import type { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import {
  initSync,
  set_content,
  VoxelWorld,
  TerrainGen,
} from "../../../../games/voxel/engine/pkg/voxel_engine.js";
import type { BuildIdentity } from "../../../../games/voxel/src/shared/protocol.ts";
import type { ContentManifest } from "../../../../games/voxel/src/shared/content.ts";
const build = JSON.parse(
  readFileSync(
    new URL("../../../../games/voxel/artifacts/build.json", import.meta.url),
    "utf8",
  ),
) as BuildIdentity;
const content = JSON.parse(
  readFileSync(
    new URL("../../../../games/voxel/artifacts/content.json", import.meta.url),
    "utf8",
  ),
) as ContentManifest;
initSync({
  module: readFileSync(
    new URL(
      "../../../../games/voxel/engine/pkg/voxel_engine_bg.wasm",
      import.meta.url,
    ),
  ),
});
set_content(JSON.stringify(content));
const db = new PostgresTestDatabase();
after(() => db.close());

test(
  "real SDK and PostgreSQL carry a committed room across worker failure, ambiguous commit and new ownership",
  { timeout: 20000 },
  async () => {
    const wire = await supabaseWire(db),
      backend = createSupabasePersistence({
        SUPABASE_URL: wire.origin,
        SUPABASE_SECRET_KEY: wire.secret,
      });
    const roomId = db.session(),
      person = randomUUID(),
      actor = {
        id: person,
        role: "participant" as const,
        capabilities: {
          build: true,
          fly: true,
          observe: false,
          combat: true,
          explosives: true,
        },
      };
    await backend.verifyInstallation();
    const seed = (await backend.acquire(roomId, randomUUID()))!;
    const initial = new GameRoom(
      new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
      content,
      build,
      { send() {}, close() {} },
      seed.worldId,
      4242,
      0,
      0,
      "survival",
    );
    try {
      initial.join(actor, "seed", 0);
      initial.inventories.receive(person, { itemType: "stone", count: 23 });
      await new CheckpointStorage(
        seed.worldId,
        backend,
        backend,
        content,
        build,
      ).save(seed, 1, initial.checkpoint(0));
      await backend.release(seed);
    } finally {
      initial.dispose();
    }
    const gateway = await createGateway({
      build,
      content,
      admit: async () => developmentAdmission(actor),
      persistence: {
        objects: backend,
        metadata: backend,
        resolveOwner: async () => actor,
      },
    });
    assert.ok(gateway.address && typeof gateway.address === "object");
    const origin = `http://127.0.0.1:${gateway.address.port}`,
      probes: SocketProbe[] = [];
    try {
      const first = await connectProbe(origin, roomId, content.blocks.length);
      probes.push(first);
      const playing = await first.ready(),
        owned = await first.event("inventory");
      assert.equal(owned.view.bag[0]?.count, 23);
      first.send({
        type: "inventory",
        epoch: playing.epoch,
        sequence: 1,
        operation: {
          kind: "drop",
          slot: 0,
          count: 2,
          revision: owned.view.revision,
        },
      });
      assert.equal((await first.event("result")).outcome?.ok, true);
      wire.control.loseCommitResponse = true;
      await assert.rejects(gateway.save(roomId), /Supabase/);
      const paused = await gateway.save(roomId, true);
      assert.equal(
        paused.sequence,
        3,
        "commit-response loss retries sequence two identically before the paused sequence three",
      );
      const storage = new CheckpointStorage(
          seed.worldId,
          backend,
          backend,
          content,
          build,
        ),
        saved = await storage.load(paused);
      assert.equal((saved.inventories as any).players[0].bag[0].count, 21);
      assert.equal((saved.drops as any).entries[0].stack.count, 2);
      assert.equal(
        db.value(
          `SELECT count(*) FROM public.voxel_checkpoints WHERE world_id=${literal(seed.worldId)}`,
        ),
        3,
      );
      const old = gateway.rooms.get(roomId)!,
        closed = once(first.socket, "close");
      await old.worker.terminate();
      await closed;
      for (let n = 0; n < 100; n++) {
        if (
          db.value(
            `SELECT lease_expires_at <= clock_timestamp() FROM public.voxel_worlds WHERE session_id=${literal(roomId)}`,
          )
        )
          break;
        await delay(10);
      }
      const next = await connectProbe(origin, roomId, content.blocks.length);
      probes.push(next);
      const welcome = await next.event("welcome"),
        inventory = await next.event("inventory");
      assert.equal(welcome.worldId, seed.worldId);
      assert.ok(welcome.epoch > playing.epoch);
      assert.equal(inventory.view.bag[0]?.count, 21);
      assert.equal(
        db.value(
          `SELECT owner_epoch FROM public.voxel_worlds WHERE session_id=${literal(roomId)}`,
        ),
        3,
      );
      const restored = await storage.load(await gateway.save(roomId, true));
      assert.deepEqual(restored.world, saved.world);
      assert.deepEqual(restored.drops, saved.drops);
      assert.deepEqual(restored.inventories, saved.inventories);
    } finally {
      for (const p of probes) p.socket.terminate();
      await gateway.close();
      await wire.close();
    }
  },
);
