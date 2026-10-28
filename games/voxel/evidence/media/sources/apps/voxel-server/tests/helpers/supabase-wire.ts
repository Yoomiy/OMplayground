import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { PostgresTestDatabase, literal } from "./postgres.ts";

/** Real SDK HTTP requests and real Postgres RPCs. Only Storage bytes are a fixture;
 * this does not claim to reproduce Supabase's Storage service or its edge policy.
 */
export async function supabaseWire(db: PostgresTestDatabase) {
  const secret = "sb_secret_local_wire_fixture",
    objects = new Map<string, Buffer>();
  const control = {
    loseCommitResponse: false,
    loseModerationResponse: false,
    loseChatResponse: false,
    loseMediaResponse: false,
    failUpload: false,
    failDelete: false,
  };
  const body = async (request: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  };
  const reply = (response: ServerResponse, value: unknown, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  };
  const http = createServer((request, response) => {
    void (async () => {
      assert.equal(request.headers.apikey, secret);
      assert.equal(request.headers.authorization, undefined);
      const path = new URL(request.url!, "http://localhost").pathname;
      if (path.startsWith("/rest/v1/rpc/")) {
        const name = path.slice("/rest/v1/rpc/".length),
          args = JSON.parse((await body(request)).toString());
        try {
          const result = await db.rpcAsync(name, args);
          if (name === "voxel_media_moderate" && control.loseMediaResponse) {
            control.loseMediaResponse = false;
            response.destroy();
            return;
          }
          if (
            ["voxel_chat_send", "voxel_chat_moderate"].includes(name) &&
            control.loseChatResponse
          ) {
            control.loseChatResponse = false;
            response.destroy();
            return;
          }
          if (name === "voxel_moderate" && control.loseModerationResponse) {
            control.loseModerationResponse = false;
            response.destroy();
            return;
          }
          if (
            name === "voxel_commit_checkpoint" &&
            result === true &&
            control.loseCommitResponse
          ) {
            control.loseCommitResponse = false;
            response.destroy();
            return;
          }
          reply(response, result);
        } catch (error) {
          const stderr = (error as { stderr?: string }).stderr ?? "",
            code = stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? "P0001";
          reply(
            response,
            {
              code,
              message: "database rejected test request",
              details: null,
              hint: null,
            },
            code === "42501" ? 403 : 400,
          );
        }
        return;
      }
      if (path === "/rest/v1/game_sessions" && request.method === "GET") {
        const url = new URL(request.url!, "http://localhost"),
          id = url.searchParams.get("id")?.slice(3),
          fields = url.searchParams.get("select")?.split(",") ?? [];
        const allowed = [
          "id",
          "host_id",
          "host_name",
          "status",
          "connected_player_ids",
          "connected_player_names",
          "voxel_presence_expires_at",
        ];
        if (
          !id ||
          !/^[a-f0-9-]{36}$/.test(id) ||
          !fields.length ||
          fields.some((field) => !allowed.includes(field))
        )
          throw new Error("invalid test metadata query");
        const pairs = fields
          .flatMap((field) => [literal(field), "s." + field])
          .join(",");
        reply(
          response,
          await db.valueAsync(
            `SELECT coalesce(jsonb_agg(jsonb_build_object(${pairs})),'[]'::jsonb) FROM public.game_sessions s WHERE id=${literal(id)}::uuid`,
            "service_role",
          ),
        );
        return;
      }
      const prefix = "/storage/v1/object/voxel-checkpoints";
      if (path === prefix && request.method === "DELETE") {
        if (control.failDelete) {
          reply(
            response,
            { statusCode: "503", message: "injected outage" },
            503,
          );
          return;
        }
        const { prefixes } = JSON.parse((await body(request)).toString()) as {
          prefixes: string[];
        };
        for (const key of prefixes) objects.delete(key);
        reply(response, []);
        return;
      }
      if (!path.startsWith(prefix + "/")) {
        reply(response, { code: "404" }, 404);
        return;
      }
      const key = path.slice(prefix.length + 1);
      if (request.method === "POST") {
        assert.equal(request.headers["x-upsert"], "false");
        const bytes = await body(request);
        if (control.failUpload) {
          reply(
            response,
            { statusCode: "503", message: "injected outage" },
            503,
          );
          return;
        }
        if (objects.has(key)) {
          reply(response, { statusCode: "409", message: "duplicate" }, 409);
          return;
        }
        objects.set(key, bytes);
        reply(response, { Key: `voxel-checkpoints/${key}`, Id: randomUUID() });
        return;
      }
      if (request.method === "GET") {
        const bytes = objects.get(key);
        if (!bytes) {
          reply(response, { statusCode: "404", message: "missing" }, 404);
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(bytes);
        return;
      }
      reply(response, { code: "405" }, 405);
    })().catch(() => {
      if (!response.headersSent)
        reply(
          response,
          { code: "P0001", message: "test transport failure" },
          500,
        );
      else response.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", resolve);
  });
  const address = http.address();
  assert.ok(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    secret,
    objects,
    control,
    async close() {
      const closing = new Promise<void>((resolve) =>
        http.close(() => resolve()),
      );
      http.closeAllConnections();
      await closing;
    },
  };
}
