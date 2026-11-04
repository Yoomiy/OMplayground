import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { loadServerRelease } from "../../src/release.ts";
import { mineNaturalResource } from "../../tools/hosted-natural-mining.ts";
import { MemoryCheckpoints } from "../../../../games/voxel/tests/fixtures/checkpoint-storage.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import { developmentAdmission } from "../../../../games/voxel/tools/development-admission.ts";
import type { ServerMessage } from "../../../../games/voxel/src/shared/protocol.ts";

test(
  "hosted journey mining driver earns a natural item and restores ownership with packaged workers using a local contract backend",
  { timeout: 30000 },
  async () => {
    const runtime = await loadServerRelease(),
      backend = new MemoryCheckpoints(),
      room = randomUUID(),
      actor = randomUUID();
    const create = () =>
      runtime.createGateway({
        build: runtime.build,
        content: runtime.content,
        worldDefaults: { mode: "survival", seed: 4242 },
        persistence: { objects: backend, metadata: backend },
        admit: async () =>
          developmentAdmission({
            id: actor,
            role: "participant",
            capabilities: {
              build: true,
              fly: true,
              observe: false,
              combat: true,
              explosives: true,
            },
          }),
      });
    const probes: SocketProbe[] = [];
    let gateway = await create();
    const connect = async (activate = true) => {
      const address = gateway.address;
      assert(address && typeof address === "object");
      const endpoint = `http://127.0.0.1:${address.port}`;
      const response = await fetch(endpoint + "/api/voxel/admission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as {
        ticket: string;
        buildId: string;
      };
      const probe = new SocketProbe(
        endpoint.replace(/^http/, "ws") + "/voxel",
        runtime.content.blocks.length,
      );
      probes.push(probe);
      await once(probe.socket, "open");
      probe.send({ type: "hello", ...ticket });
      const welcome = await probe.event("welcome");
      console.log("local driver: welcome");
      const ready = await probe.ready();
      console.log("local driver: ready");
      if (!activate) return { probe, welcome, baseline: ready };
      probe.send({ type: "focus", epoch: ready.epoch, active: true });
      const baseline = await probe
        .wait(
          (e): e is Extract<ServerMessage, { type: "baseline" }> =>
            "type" in e && e.type === "baseline" && e.reason === "focus",
        )
        .catch((error) => {
          console.log(
            "local driver baselines:",
            JSON.stringify(
              probe.events.filter(
                (e) =>
                  "type" in e &&
                  ["baseline", "lifecycle", "error"].includes(e.type),
              ),
            ),
          );
          throw error;
        });
      return { probe, welcome, baseline };
    };
    try {
      const first = await connect(),
        earned = await mineNaturalResource(
          first.probe,
          first.baseline,
          runtime.content,
          (stage) => console.log("local driver:", stage),
        );
      assert.equal(earned.inventory.revision, 1);
      assert(earned.inventory.bag.some((s) => s?.count === 1));
      await gateway.close();
      console.log("local driver: drained");
      gateway = await create();
      const second = await connect(false),
        inventory = await second.probe.event("inventory");
      assert.equal(second.baseline.phase, "paused");
      assert.equal(second.baseline.state[12], 1);
      assert.equal(second.welcome.worldId, first.welcome.worldId);
      assert.deepEqual(inventory.view.bag, earned.inventory.bag);
      assert.equal(inventory.view.revision, 1);
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);
