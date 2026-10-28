import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createVoxelApi, voxelEndpoint, VoxelApiError } from "./session-api";
const room = randomUUID(),
  id = randomUUID(),
  buildId = "a".repeat(64),
  ticket = "x".repeat(43);
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("rewritten voxel service contract", () => {
  it("chat binds persisted receipts and paginated history without optimistic message echoes", async () => {
    const calls: unknown[] = [];
    let malformed = false;
    const message = {
      id,
      sequence: 2,
      senderId: room,
      senderName: "תלמיד",
      message: "שלום 🙂",
      at: new Date().toISOString(),
    };
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        const request = new Request(input, init);
        calls.push(await request.json());
        if (request.url.endsWith("chat-history"))
          return response({ messages: [message], before: malformed ? 3 : 2 });
        return response({
          requestId: id,
          action: "send",
          messageId: malformed ? room : id,
          applied: true,
          persisted: true,
        });
      },
    });
    expect(await api.sendChat(" שלום 🙂 ", id)).toMatchObject({
      persisted: true,
      messageId: id,
    });
    expect(await api.chatHistory(3)).toEqual({
      messages: [message],
      before: 2,
    });
    expect(calls).toEqual([
      { room, requestId: id, message: "שלום 🙂" },
      { room, before: 3 },
    ]);
    malformed = true;
    await expect(api.sendChat("שלום", id)).rejects.toMatchObject({
      code: "PROTOCOL",
      retryable: true,
    });
    await expect(api.chatHistory()).rejects.toMatchObject({ code: "PROTOCOL" });
  });
  it("chat moderation requires bound actions and retries with the same request identity", async () => {
    const calls: unknown[] = [];
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        const request = new Request(input, init);
        calls.push(await request.json());
        return response({
          requestId: id,
          action: "clear",
          messageId: null,
          applied: true,
          persisted: true,
        });
      },
    });
    await api.moderateChat("clear", null, id);
    await api.moderateChat("clear", null, id);
    expect(calls).toEqual([
      { room, requestId: id, action: "clear", target: null },
      { room, requestId: id, action: "clear", target: null },
    ]);
    await expect(api.moderateChat("delete", room, id)).rejects.toMatchObject({
      code: "PROTOCOL",
    });
    await expect(api.sendChat("x".repeat(501), id)).rejects.toMatchObject({
      code: "INVALID",
    });
  });
  it("staff receipts bind the requested command and distinguish application from saved state", async () => {
    const command = { kind: "mode", mode: "creative" } as const;
    let corrupt = false;
    const value = {
      requestId: id,
      command,
      completed: true,
      result: { ok: true, reason: "mode" },
      revision: 2,
      ownerEpoch: 3,
      current: true,
      saved: false,
    };
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        const request = new Request(input, init);
        expect(await request.json()).toEqual({ room, requestId: id, command });
        return response(corrupt ? { ...value, saved: true } : value);
      },
    });
    expect(await api.staff(command, id)).toEqual(value);
    corrupt = true;
    await expect(api.staff(command, id)).rejects.toMatchObject({
      code: "PROTOCOL",
    });
    const wrongAction = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async () =>
        response({ ...value, result: { ok: true, reason: "teleport" } }),
    });
    await expect(wrongAction.staff(command, id)).rejects.toMatchObject({
      code: "PROTOCOL",
    });
  });

  it("self-departure keeps its retry identity and accepts no saved or forged-scope receipt", async () => {
    const calls: unknown[] = [],
      value = { requestId: id, left: true, ended: false, revision: 4 };
    let corrupt = false;
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        const request = new Request(input, init);
        expect(request.url).toBe("https://voxel.example/api/voxel/leave");
        calls.push(await request.json());
        return response(corrupt ? { ...value, saved: true } : value);
      },
    });
    expect(await api.leave(id)).toEqual(value);
    expect(await api.leave(id)).toEqual(value);
    expect(calls).toEqual([
      { room, requestId: id },
      { room, requestId: id },
    ]);
    corrupt = true;
    await expect(api.leave(id)).rejects.toMatchObject({ code: "PROTOCOL" });
  });

  it("sends identity only as a bearer header and strictly validates the release ticket", async () => {
    let observed: Request | null = null;
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      invitationCode: "invite",
      participation: "observer",
      getToken: async () => "fixture.jwt.signature",
      request: async (input, init) => {
        observed = new Request(input, init);
        return response({ ticket, buildId });
      },
    });
    expect(api.socketUrl).toBe("wss://voxel.example/voxel");
    expect(await api.admit()).toEqual({ ticket, buildId });
    expect(observed!.url).toBe("https://voxel.example/api/voxel/admission");
    expect(observed!.headers.get("Authorization")).toBe(
      "Bearer fixture.jwt.signature",
    );
    expect(observed!.credentials).toBe("omit");
    expect(await observed!.json()).toEqual({
      room,
      invitationCode: "invite",
      participation: "observer",
    });
  });
  it("accepts committed save receipts and preserves the same request identity on retries", async () => {
    const calls: unknown[] = [],
      value = {
        requestId: id,
        action: "pause",
        completed: true,
        saved: true,
        savedSequence: 7,
        revision: 3,
        current: true,
      };
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async (input, init) => {
        calls.push(await new Request(input, init).json());
        return response(value);
      },
    });
    expect(await api.control("pause", id)).toEqual(value);
    expect(await api.control("pause", id)).toEqual(value);
    expect(calls).toEqual([
      { room, requestId: id, action: "pause" },
      { room, requestId: id, action: "pause" },
    ]);
    const corrupt = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async () => response({ ...value, savedSequence: null }),
    });
    await expect(corrupt.control("pause", id)).rejects.toMatchObject({
      code: "PROTOCOL",
      retryable: true,
    });
  });
  it("cancels before a late auth result can allocate a room and keeps failure messages bounded", async () => {
    let release!: (value: string) => void,
      requests = 0;
    const held = new Promise<string>((r) => (release = r)),
      abort = new AbortController();
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: () => held,
      request: async () => {
        requests++;
        return response({ ticket, buildId });
      },
    });
    const pending = api.admit(abort.signal);
    abort.abort();
    release("late-token");
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(requests).toBe(0);
    const failed = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => "fixture",
      request: async () =>
        response(
          { error: "CONTROL_UNAVAILABLE", details: "private provider message" },
          503,
        ),
    });
    await expect(failed.control("end", id)).rejects.toMatchObject({
      message: "CONTROL_UNAVAILABLE",
      retryable: true,
    });
  });
  it("rejects untrusted origins, paths and credentials without a legacy service fallback", () => {
    for (const value of [
      "invalid",
      "https://u:p@voxel.example",
      "https://voxel.example/path",
      "http://voxel.example",
      "https://voxel.example?ticket=secret",
    ])
      expect(() => voxelEndpoint(value)).toThrow(VoxelApiError);
    expect(voxelEndpoint("http://127.0.0.1:3001")).toEqual({
      origin: "http://127.0.0.1:3001",
      socketUrl: "ws://127.0.0.1:3001/voxel",
    });
  });
});

describe("staff moderation service contract", () => {
  it("binds durable policy receipts to request/action/target and rejects a world-save claim", async () => {
    const target = randomUUID(),
      requestId = randomUUID();
    let corrupt = false,
      calls = 0;
    const value = {
      requestId,
      target,
      action: "ban",
      revision: 2,
      banned: true,
      current: true,
      applied: true,
      saved: false,
      revocationRequested: true,
    };
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => `fresh-${++calls}`,
      request: async (input, init) => {
        expect(String(input)).toBe(
          "https://voxel.example/api/voxel/moderation",
        );
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Bearer fresh-${calls}`,
        );
        expect(JSON.parse(String(init?.body))).toEqual({
          room,
          requestId,
          target,
          action: "ban",
        });
        return response(corrupt ? { ...value, saved: true } : value);
      },
    });
    expect(await api.moderate("ban", target, requestId)).toEqual(value);
    corrupt = true;
    await expect(api.moderate("ban", target, requestId)).rejects.toMatchObject({
      code: "PROTOCOL",
      retryable: true,
    });
    expect(calls).toBe(2);
  });
  it("reads offline staff targets without giving the browser a policy write path and accepts a no-op unban", async () => {
    const target = randomUUID(),
      requestId = randomUUID();
    let mode = "targets";
    const api = createVoxelApi({
      room,
      serverUrl: "https://voxel.example",
      getToken: async () => ticket,
      request: async (input, init) => {
        if (mode === "targets") {
          expect(String(input)).toContain("/moderation-targets");
          expect(JSON.parse(String(init?.body))).toEqual({ room });
          return response({
            targets: [
              {
                id: target,
                name: "Student",
                banned: true,
                pendingReadmission: true,
              },
            ],
          });
        }
        return response({
          requestId,
          target,
          action: "unban",
          revision: 0,
          banned: false,
          current: true,
          applied: true,
          saved: false,
          revocationRequested: false,
        });
      },
    });
    expect((await api.moderationTargets())[0].banned).toBe(true);
    mode = "unban";
    expect((await api.moderate("unban", target, requestId)).revision).toBe(0);
  });
});
