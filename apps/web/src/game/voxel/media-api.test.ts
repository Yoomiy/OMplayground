import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createVoxelApi } from "./session-api";

describe("direct voxel voice token API", () => {
  it("fetches a LiveKit credential from the game server using the current school token", async () => {
    const room = randomUUID();
    const grant = {
      token: "header.payload.signature",
      serverUrl: "wss://media.example",
      publish: true,
      hidden: false,
    };
    let calls = 0;
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "school-fixture",
      request: async (input, init) => {
        const req = new Request(input, init);
        expect(req.url).toBe("https://voxel.example/api/voxel/voice-token");
        expect(req.headers.get("Authorization")).toBe("Bearer school-fixture");
        expect(await req.json()).toEqual({ room });
        calls++;
        return Response.json(grant);
      },
    });
    expect(await api.voiceToken()).toEqual(grant);
    expect(calls).toBe(1);
  });
  it("rejects malformed credentials and propagates denied admission", async () => {
    let value: unknown = { ticket: "t".repeat(43) },
      status = 200;
    const api = createVoxelApi({
      room: randomUUID(),
      serverUrl: "https://voxel.example",
      getToken: async () => "school-fixture",
      request: async () => Response.json(value, { status }),
    });
    await expect(api.voiceToken()).rejects.toMatchObject({ code: "PROTOCOL" });
    value = { error: "NOT_IN_ROOM" };
    status = 403;
    await expect(api.voiceToken()).rejects.toMatchObject({
      code: "NOT_IN_ROOM",
      retryable: false,
    });
  });
});
