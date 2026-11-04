import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { NEUTRAL } from "../../../games/voxel/src/shared/input.ts";
import { worldCell } from "../../../games/voxel/src/shared/chunk-wire.ts";
import type { SocketProbe } from "../../../games/voxel/tests/fixtures/socket-probe.ts";
import type { ContentManifest } from "../../../games/voxel/src/shared/content.ts";
import type {
  ServerMessage,
  Cell,
} from "../../../games/voxel/src/shared/protocol.ts";
import type { ChunkFrame } from "../../../games/voxel/src/shared/chunk-wire.ts";
import {
  initSync,
  set_content,
  VoxelWorld,
  TerrainGen,
} from "../../../games/voxel/engine/pkg/voxel_engine.js";

/** Only native generation and ordinary public inputs; no server state injection. */
export async function mineNaturalResource(
  probe: SocketProbe,
  baseline: Extract<ServerMessage, { type: "baseline" }>,
  content: ContentManifest,
  progress: (stage: string) => void = () => {},
) {
  initSync({
    module: readFileSync(
      new URL("../../../games/voxel/dist-server/engine.wasm", import.meta.url),
    ),
  });
  set_content(JSON.stringify(content));
  const world = new VoxelWorld(),
    generator = new TerrainGen(4242);
  const columns = new Map<string, ChunkFrame>();
  for (const e of probe.events)
    if ("kind" in e) columns.set(`${e.x},${e.z}`, e);
  const view = () => {
    const e = probe.events.findLast(
      (e): e is Extract<ServerMessage, { type: "inventory" }> =>
        "type" in e && e.type === "inventory",
    );
    assert(e);
    return e.view;
  };
  assert.equal(view().catalog, false);
  assert(
    view().bag.every((s) => s === null),
    "survival starts empty",
  );
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    for (const frame of columns.values())
      world.insert_column(
        frame.x,
        frame.z,
        generator.generate(frame.x, frame.z),
      );
    const p = baseline.state;
    let selection:
      | { target: Cell; yaw: number; pitch: number; distance: number }
      | undefined;
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI])
      for (const pitch of [-0.7, -0.9, -1.1, 0]) {
        const hit = world.raycast(
          p[0],
          p[1] + 1.62,
          p[2],
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch),
          6,
        );
        if (!hit[0]) continue;
        const block = content.blocks[world.get_block(hit[1], hit[2], hit[3])],
          rule = content.behavior.find((b) => b.family === block?.name);
        const distance = Math.hypot(hit[1] + 0.5 - p[0], hit[3] + 0.5 - p[2]);
        if (
          rule?.drops.length &&
          !rule.mining.requiresTool &&
          block.breakable !== false &&
          distance > 0.8 &&
          (!selection || distance < selection.distance)
        )
          selection = {
            target: [hit[1], hit[2], hit[3]],
            yaw,
            pitch,
            distance,
          };
      }
    assert(selection, "natural reachable resource");
    progress("natural_target_selected");
    let input = 0,
      controls = { ...NEUTRAL, yaw: selection.yaw, pitch: selection.pitch };
    timer = setInterval(() => {
      if (probe.socket.readyState === 1)
        probe.send({
          type: "input",
          frames: [{ ...controls, epoch: baseline.epoch, sequence: ++input }],
        });
    }, 1000 / 60);
    await delay(100);
    const at = probe.events.length;
    probe.send({
      type: "mining",
      epoch: baseline.epoch,
      sequence: 1,
      inputSequence: input,
      target: selection.target,
      revision: columns.get(
        `${selection.target[0] >> 4},${selection.target[2] >> 4}`,
      )!.revision,
      inventoryRevision: 0,
    });
    const result = await probe.wait(
      (e): e is Extract<ServerMessage, { type: "result" }> =>
        "type" in e && e.type === "result" && e.sequence === 1,
    );
    assert.equal(result.outcome?.ok, true, "mining accepted");
    progress("mining_accepted");
    const patch = await probe.wait(
      (e): e is ChunkFrame =>
        "kind" in e &&
        e.kind === "patch" &&
        e.edits.some(
          ([index, state]) =>
            state === 0 &&
            worldCell(e.x, e.z, index).every(
              (n, i) => n === selection!.target[i],
            ),
        ),
    );
    const visible = await probe.wait(
      (e): e is Extract<ServerMessage, { type: "drops" }> =>
        "type" in e && e.type === "drops" && e.upsert.length > 0,
    );
    const drop = visible.upsert[0];
    progress("mined_drop_published");
    const deadline = performance.now() + 7000;
    while (
      !view().bag.some((s) => s?.itemType === drop.stack.itemType) &&
      performance.now() < deadline
    ) {
      const snapshot = probe.events.findLast(
        (e): e is Extract<ServerMessage, { type: "snapshot" }> =>
          "type" in e && e.type === "snapshot" && !!e.self,
      );
      assert(snapshot?.self);
      const state = snapshot.self.state,
        dx = drop.position[0] - state[0],
        dz = drop.position[2] - state[2];
      controls = {
        ...NEUTRAL,
        yaw: Math.atan2(dx, -dz),
        z: Math.hypot(dx, dz) > 0.35 ? -1 : 0,
        jump: drop.position[1] > state[1] + 0.5 && state[6] === 1,
      };
      await delay(50);
    }
    controls = { ...NEUTRAL };
    assert.equal(
      view().bag.reduce(
        (n, s) => n + (s?.itemType === drop.stack.itemType ? s.count : 0),
        0,
      ),
      1,
      "one earned item",
    );
    assert(
      probe.events
        .slice(at)
        .some(
          (e) =>
            "type" in e && e.type === "drops" && e.removed.includes(drop.id),
        ),
    );
    await delay(120);
    progress("earned_item_collected");
    return {
      target: selection.target,
      patchRevision: patch.revision,
      itemType: drop.stack.itemType,
      inventory: structuredClone(view()),
    };
  } finally {
    if (timer) clearInterval(timer);
    world.free();
    generator.free();
  }
}
