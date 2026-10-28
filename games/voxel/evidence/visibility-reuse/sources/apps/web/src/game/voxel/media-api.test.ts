import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createVoxelApi } from "./session-api";
const room = randomUUID(),
  actor = randomUUID(),
  binding = randomUUID(),
  id = randomUUID();
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("rewritten media service contract", () => {
  it("requests only a school-bound opaque ticket from the configured service and rejects reusable-credential extensions", async () => {
    const calls: unknown[] = [],
      grant = {
        ticket: "t".repeat(43),
        expiresAt: Date.now() + 4000,
        publish: false,
        hidden: true,
        actorId: actor,
        bindingId: binding,
      };
    let corrupt = false;
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "school-bearer-fixture",
      request: async (input, init) => {
        const req = new Request(input, init);
        expect(req.url).toBe("https://voxel.example/api/voxel/voice-ticket");
        expect(req.headers.get("Authorization")).toBe(
          "Bearer school-bearer-fixture",
        );
        calls.push(await req.json());
        return response(
          corrupt ? { ...grant, token: "private-sfu-token" } : grant,
        );
      },
    });
    expect(api.voiceUrl).toBe("wss://voxel.example/voxel-media");
    expect(await api.voiceTicket()).toEqual(grant);
    expect(calls).toEqual([{ room }]);
    corrupt = true;
    await expect(api.voiceTicket()).rejects.toMatchObject({
      code: "PROTOCOL",
      retryable: true,
    });
  });
  it("retries a lost mute with the original UUID and binds the persisted policy receipt and teacher view", async () => {
    const calls: unknown[] = [],
      receipt = {
        requestId: id,
        action: "mute",
        target: actor,
        revision: 1,
        muted: true,
        current: true,
        applied: true,
        persisted: true,
        saved: false,
        revocationRequested: true,
      };
    let lost = true,
      corrupt = false;
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        const req = new Request(input, init);
        calls.push(await req.json());
        if (req.url.endsWith("/media-state"))
          return response({
            revision: 1,
            allMuted: true,
            targets: [
              {
                id: actor,
                name: "<b>Literal name</b>",
                muted: false,
                effectiveMuted: !corrupt,
              },
            ],
          });
        if (lost) {
          lost = false;
          return response({ error: "MEDIA_UNCONFIRMED" }, 503);
        }
        return response(corrupt ? { ...receipt, target: binding } : receipt);
      },
    });
    await expect(api.moderateMedia("mute", actor, id)).rejects.toMatchObject({
      code: "MEDIA_UNCONFIRMED",
      retryable: true,
    });
    expect(await api.moderateMedia("mute", actor, id)).toEqual(receipt);
    expect(calls).toEqual([
      { room, requestId: id, action: "mute", target: actor },
      { room, requestId: id, action: "mute", target: actor },
    ]);
    expect((await api.mediaState()).targets[0].name).toBe(
      "<b>Literal name</b>",
    );
    corrupt = true;
    await expect(api.moderateMedia("mute", actor, id)).rejects.toMatchObject({
      code: "PROTOCOL",
      retryable: true,
    });
    await expect(api.mediaState()).rejects.toMatchObject({ code: "PROTOCOL" });
    await expect(
      api.moderateMedia("mute", "invalid", id),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});
