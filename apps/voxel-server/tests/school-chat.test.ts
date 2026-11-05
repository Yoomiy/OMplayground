import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { schoolChatApi, SupabaseChat } from "../src/school-chat.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";
import type { GatewayApiContext } from "../../../games/voxel/src/server/gateway.ts";

test("chat notifies only after persistence, including moderation, and rejected writes never notify", async () => {
  const school = schoolFixture();
  // Use a teacher participant so this regression does not depend on recess hours.
  school.setNow(Date.now());
  school.profiles.get(school.teacher)!.gender = "boy";
  const order: string[] = [];
  let fail = false;
  const chat = {
    async apply(
      _room: string,
      _actor: string,
      id: string,
      action: "send" | "delete" | "clear",
      target: string | null,
    ) {
      order.push("commit");
      if (fail) throw new Error("database unavailable");
      return {
        requestId: id,
        action,
        messageId: action === "send" ? id : target,
        applied: true,
        persisted: true,
      };
    },
  } as unknown as SupabaseChat;
  const context: GatewayApiContext = {
    revoke() {},
    chatChanged(room) {
      assert.equal(room, school.room);
      order.push("notify");
    },
    actor: () => ({
      connection: "a",
      role: "participant",
      admissionRevision: 0,
      expiresAt: Date.now() + 5000,
      worldId: randomUUID(),
      owner: randomUUID(),
      epoch: 1,
    }),
  };
  const routes = schoolChatApi(school.access, chat, () => {});
  for (const action of ["send", "delete", "clear"] as const) {
    order.length = 0;
    const req = {
      headers: { authorization: `Bearer ${school.token(school.teacher)}` },
    } as IncomingMessage;
    let status = 200;
    const res = {
      writeHead(code: number) {
        status = code;
      },
      end() {},
    } as unknown as ServerResponse;
    const body = {
      room: school.room,
      requestId: randomUUID(),
      ...(action === "send"
        ? { message: "hello" }
        : { action, target: action === "clear" ? null : randomUUID() }),
    };
    const route =
      routes[
        action === "send" ? "/api/voxel/chat-send" : "/api/voxel/chat-moderate"
      ];
    fail = false;
    const receipt = await route(req, body, res, context);
    assert.equal(status, 200);
    assert.ok(receipt);
    assert.deepEqual(order, ["commit", "notify"]);
    order.length = 0;
    fail = true;
    assert.equal(await route(req, body, res, context), null);
    assert.equal(status, 503);
    assert.deepEqual(order, ["commit"]);
  }
});
