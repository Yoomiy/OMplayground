import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import pino from "pino";
import { createClient } from "@supabase/supabase-js";
import {
  AccessToken,
  TokenVerifier,
  RoomServiceClient,
  TrackSource,
  type UpdateParticipantOptions,
} from "livekit-server-sdk";
import { createClassroomService } from "./service";
import { readClassroomConfig } from "./config";
import { verifyClassroomBoardToken } from "./classroomBoardToken";
import { readPresenterCapability } from "./classroomPresentation";
import { getSchoolIdentity } from "./schoolIdentity";

const teacher: string = randomUUID(),
  kid: string = randomUUID(),
  roomId = randomUUID(),
  drawingId = randomUUID();
const fixtureEnv = {
  PORT: "0",
  HOST: "127.0.0.1",
  CORS_ORIGIN: "https://school.invalid",
  SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_SECRET_KEY: "sb_secret_classroom_fixture",
  LIVEKIT_URL: "wss://media.invalid",
  LIVEKIT_API_KEY: "classroom-key",
  LIVEKIT_API_SECRET: "classroom-secret",
};

/** Real SDK over HTTP; fixture provider semantics, not hosted SQL/LiveKit proof. */
async function fixture(background = false) {
  const room = {
    id: roomId,
    room_code: "ROOM",
    teacher_id: teacher,
    teacher_name: "Teacher",
    status: "active",
    settings: {} as Record<string, unknown>,
  };
  const profiles = new Map([
    [
      teacher,
      {
        id: teacher,
        role: "teacher",
        gender: "girl",
        grade: null,
        full_name: "Teacher",
        is_active: true,
      },
    ],
    [
      kid,
      {
        id: kid,
        role: "kid",
        gender: "boy",
        grade: null,
        full_name: "Child",
        is_active: true,
      },
    ],
  ]);
  const blocks = new Set<string>();
  const calls: Array<{
    path: string;
    method: string;
    body: any;
    query: string;
  }> = [];
  let failReadiness = false;
  let failAttendance = false;
  let blockAttendance: Promise<void> | undefined;
  let attendanceEntered: () => void = () => {};
  const logEntries: unknown[] = [];
  const logger = pino(
    { level: "debug" },
    {
      write(line: string) {
        logEntries.push(JSON.parse(line));
      },
    },
  );
  const provider = http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://fixture.invalid");
    let raw = "";
    for await (const data of req) raw += data;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({
      path: url.pathname,
      method: req.method!,
      body,
      query: url.search,
    });
    res.setHeader("content-type", "application/json");
    const reply = (value: unknown) => res.end(JSON.stringify(value));
    if (url.pathname === "/auth/v1/user") {
      const identity =
        req.headers.authorization === "Bearer teacher-token"
          ? teacher
          : req.headers.authorization === "Bearer kid-token"
            ? kid
            : null;
      if (!identity) {
        res.statusCode = 401;
        reply({ message: "invalid token" });
        return;
      }
      reply({ id: identity });
      return;
    }
    if (url.pathname === "/twirp/livekit.RoomService/ListRooms") {
      try {
        await new TokenVerifier(
          fixtureEnv.LIVEKIT_API_KEY,
          fixtureEnv.LIVEKIT_API_SECRET,
        ).verify(req.headers.authorization?.replace(/^Bearer /, "") ?? "");
        reply({ rooms: [] });
      } catch {
        res.statusCode = 401;
        reply({
          code: "unauthenticated",
          msg: "fixture authentication failed",
        });
      }
      return;
    }
    const table = url.pathname.slice("/rest/v1/".length);
    if (table.startsWith("rpc/")) {
      if (table === "rpc/patch_classroom_session_settings") {
        Object.assign(room.settings, body.p_patch);
        reply(room.settings);
        return;
      }
      if (table === "rpc/record_classroom_attendance_event" && failAttendance) {
        res.statusCode = 503;
        reply({ code: "UNAVAILABLE" });
        return;
      }
      reply(null);
      return;
    }
    if (table === "classroom_sessions") {
      if (failReadiness && url.searchParams.get("limit") === "1") {
        res.statusCode = 503;
        reply({ code: "UNAVAILABLE" });
        return;
      }
      if (url.searchParams.get("select") === "id,room_code") {
        attendanceEntered();
        await blockAttendance;
        reply([]);
        return;
      }
      if (req.method === "PATCH") {
        Object.assign(room, body);
        reply([room]);
        return;
      }
      reply(
        url.searchParams.get("status") === "eq.active" &&
          room.status !== "active"
          ? []
          : [room],
      );
      return;
    }
    if (table === "kid_profiles") {
      const profile = profiles.get(url.searchParams.get("id")?.slice(3) ?? "");
      reply(profile ? [profile] : []);
      return;
    }
    if (table === "admin_profiles") {
      reply([{ id: teacher, full_name: "Admin duplicate" }]);
      return;
    }
    if (table === "game_sessions") {
      reply([{ id: drawingId }]);
      return;
    }
    if (table === "classroom_participant_blocks") {
      if (req.method === "POST") {
        blocks.add(body.participant_key);
        reply(null);
        return;
      }
      reply(
        blocks.has(url.searchParams.get("participant_key")?.slice(3) ?? "")
          ? [{ id: randomUUID() }]
          : [],
      );
      return;
    }
    reply([]);
  });
  await new Promise<void>((resolve) =>
    provider.listen(0, "127.0.0.1", resolve),
  );
  const origin = `http://127.0.0.1:${(provider.address() as { port: number }).port}`;
  process.env.LIVEKIT_URL = origin;
  const config = readClassroomConfig({
    ...fixtureEnv,
    SUPABASE_URL: origin,
    LIVEKIT_URL: origin,
  });
  const client = createClient(origin, config.signingSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClassroomService({
    config,
    supabaseAdmin: client,
    logger,
    background,
  });
  return {
    service,
    config,
    room,
    profiles,
    blocks,
    calls,
    logEntries,
    client,
    failReadiness: () => {
      failReadiness = true;
    },
    failAttendance: () => {
      failAttendance = true;
    },
    holdAttendance: () => {
      let release!: () => void, entered!: () => void;
      blockAttendance = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      attendanceEntered = entered;
      return { release, started };
    },
    async close() {
      await service.close();
      await new Promise<void>((resolve) => {
        provider.close(() => resolve());
        provider.closeIdleConnections();
      });
    },
  };
}

beforeEach(() => {
  Object.assign(process.env, fixtureEnv);
});
afterEach(() => jest.restoreAllMocks());

test("standalone classroom admission issues signed media and drawing grants, bootstraps presentation and persists a reconnect block", async () => {
  const f = await fixture();
  try {
    const guestKey = randomUUID();
    const guest = await request(f.service.app)
      .post("/rtc/classroom-token")
      .send({
        roomCode: "ROOM",
        displayName: "Guest",
        guestAttendanceKey: guestKey,
      })
      .expect(200);
    const claims = await new TokenVerifier(
      f.config.livekitApiKey,
      f.config.livekitApiSecret,
    ).verify(guest.body.token);
    expect(claims.video).toMatchObject({
      room: "classroom-ROOM",
      roomJoin: true,
      roomAdmin: false,
      canPublish: true,
    });
    expect(guest.body).toMatchObject({
      isHost: false,
      drawingSessionId: drawingId,
      classroomSessionId: roomId,
      role: "student",
    });
    expect(
      verifyClassroomBoardToken(
        guest.body.classroomBoardToken,
        f.config.signingSecret,
      ),
    ).toMatchObject({
      identity: guest.body.userId,
      isHost: false,
      roomCode: "ROOM",
    });
    const host = await request(f.service.app)
      .post("/rtc/classroom-token")
      .set("Authorization", "Bearer teacher-token")
      .send({ roomCode: "ROOM" })
      .expect(200);
    expect(host.body).toMatchObject({
      isHost: true,
      role: "teacher",
      presenterIdentity: teacher,
      presenterEpoch: 1,
      canPublishScreenShare: true,
    });
    expect(
      readPresenterCapability(host.body.presenterToken, f.config.signingSecret),
    ).toMatchObject({ identity: teacher, epoch: 1 });
    expect(
      f.calls.some(
        (c) => c.path === "/rest/v1/rpc/patch_classroom_session_settings",
      ),
    ).toBe(true);
    const target = {
      identity: guest.body.userId,
      name: "Guest",
      metadata: JSON.stringify({
        attendanceKey: guest.body.attendanceKey,
        isHost: false,
      }),
    };
    const get = jest
      .spyOn(RoomServiceClient.prototype, "getParticipant")
      .mockResolvedValue(target as never);
    const remove = jest
      .spyOn(RoomServiceClient.prototype, "removeParticipant")
      .mockResolvedValue({} as never);
    const removed = await request(f.service.app)
      .post("/rtc/classroom-remove-participant")
      .set("Authorization", "Bearer teacher-token")
      .send({
        roomCode: "ROOM",
        targetIdentity: target.identity,
        blockRejoin: true,
      })
      .expect(200);
    expect(removed.body.success).toBe(true);
    expect(remove).toHaveBeenCalled();
    expect(get).toHaveBeenCalled();
    expect(f.blocks.has(guest.body.attendanceKey)).toBe(true);
    await request(f.service.app)
      .post("/rtc/classroom-token")
      .send({ roomCode: "ROOM", guestAttendanceKey: guestKey })
      .expect(403);
    expect(
      f.calls.some((c) => c.path === "/rest/v1/rpc/append_audit_log"),
    ).toBe(true);
  } finally {
    await f.close();
  }
});

test("school identities are read fresh and inactive dual profiles cannot acquire admin authority", async () => {
  const f = await fixture();
  try {
    expect((await getSchoolIdentity(f.client, "teacher-token")).role).toBe(
      "teacher",
    );
    f.profiles.get(teacher)!.is_active = false;
    await expect(getSchoolIdentity(f.client, "teacher-token")).rejects.toThrow(
      "FORBIDDEN",
    );
    const calls = f.calls.filter((c) => c.path === "/rest/v1/admin_profiles");
    expect(calls).toHaveLength(0);
    f.profiles.get(teacher)!.is_active = true;
    f.profiles.get(teacher)!.role = "kid";
    expect((await getSchoolIdentity(f.client, "teacher-token")).role).toBe(
      "kid",
    );
    await request(f.service.app)
      .post("/rtc/classroom-settings")
      .set("Authorization", "Bearer teacher-token")
      .send({ roomCode: "ROOM", settings: { allowStudentMic: false } })
      .expect(401);
    expect(
      f.calls.filter(
        (c) => c.path === "/rest/v1/rpc/patch_classroom_session_settings",
      ),
    ).toHaveLength(0);
  } finally {
    await f.close();
  }
});

test("the complete HTTP composition verifies raw signed webhooks and retries failed attendance persistence", async () => {
  const f = await fixture();
  try {
    const body = JSON.stringify({
      id: randomUUID(),
      event: "participant_joined",
      createdAt: Math.floor(Date.now() / 1000),
      room: { name: "classroom-ROOM", sid: "RM_fixture" },
      participant: { identity: "guest", sid: "PA_fixture" },
    });
    const token = new AccessToken(
      f.config.livekitApiKey,
      f.config.livekitApiSecret,
    );
    token.sha256 = createHash("sha256").update(body).digest("base64");
    const auth = await token.toJwt();
    await request(f.service.app)
      .post("/webhooks/livekit")
      .set("Content-Type", "application/webhook+json")
      .set("Authorization", auth)
      .send(body)
      .expect(200);
    expect(
      f.calls.filter(
        (c) => c.path === "/rest/v1/rpc/record_classroom_attendance_event",
      ),
    ).toHaveLength(1);
    await request(f.service.app)
      .post("/webhooks/livekit")
      .set("Content-Type", "application/webhook+json")
      .set("Authorization", auth)
      .send(body + " ")
      .expect(400);
    expect(
      f.calls.filter(
        (c) => c.path === "/rest/v1/rpc/record_classroom_attendance_event",
      ),
    ).toHaveLength(1);
    f.failAttendance();
    await request(f.service.app)
      .post("/webhooks/livekit")
      .set("Content-Type", "application/webhook+json")
      .set("Authorization", auth)
      .send(body)
      .expect(500);
  } finally {
    await f.close();
  }
});

test("shutdown waits for the owned reconciliation job, disables readiness and rejects new work", async () => {
  const f = await fixture(true);
  const hold = f.holdAttendance();
  try {
    const address = await f.service.listen();
    await hold.started;
    await request(`http://127.0.0.1:${address.port}`)
      .get("/health")
      .expect(200, { ok: true, service: "playground-classroom-server" });
    let closed = false;
    const closing = f.service.close().then(() => {
      closed = true;
    });
    expect(f.service.close()).toBe(f.service.close());
    await request(f.service.app).get("/ready").expect(503, { ok: false });
    await request(f.service.app)
      .post("/rtc/classroom-token")
      .send({ roomCode: "ROOM" })
      .expect(503, { error: "service_draining" });
    expect(closed).toBe(false);
    hold.release();
    await closing;
    expect(closed).toBe(true);
    await expect(f.service.listen()).rejects.toThrow("closed");
  } finally {
    hold.release();
    await f.close();
  }
});

test("classroom route inventory survives extraction and game routes remain absent", async () => {
  const f = await fixture();
  try {
    const routes = (source: string) =>
      [...source.matchAll(/app\.(post|get|delete)\(\s*"(\/rtc\/[^\"]+)"/g)]
        .map((m) => `${m[1]} ${m[2]}`)
        .sort();
    const expected = JSON.parse(
      readFileSync(join(__dirname, "../docs/route-contract.json"), "utf8"),
    ).routes;
    const current = routes(readFileSync(join(__dirname, "routes.ts"), "utf8"));
    expect(current).toHaveLength(20);
    expect(current).toEqual(expected);
    await request(f.service.app)
      .post("/rtc/token")
      .send({ sessionId: "game" })
      .expect(404);
    await request(f.service.app)
      .get("/socket.io/?EIO=4&transport=polling")
      .expect(404);
    await request(f.service.app).post("/api/fps-batch").send({}).expect(404);
    await request(f.service.app)
      .post("/rtc/classroom-token")
      .set("Content-Type", "application/json")
      .send("{broken-secret")
      .expect(400, { error: "invalid_json" });
    expect(JSON.stringify(f.logEntries)).not.toContain("broken-secret");
  } finally {
    await f.close();
  }
});

test("configuration requires the current secret and media bindings without including their values in errors", () => {
  expect(readClassroomConfig(fixtureEnv).port).toBe(0);
  for (const change of [
    { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "legacy-secret" },
    { LIVEKIT_API_SECRET: "" },
    { SUPABASE_URL: "https://private:password@example.invalid" },
    { CLASSROOM_CLIENT_IP_SOURCE: "forwarded" },
    { PORT: "-1" },
  ]) {
    expect(() => readClassroomConfig({ ...fixtureEnv, ...change })).toThrow();
  }
});

test("a failed backend probe prevents listening and keeps readiness unavailable", async () => {
  const f = await fixture();
  try {
    f.failReadiness();
    await expect(f.service.listen()).rejects.toThrow(
      "database readiness failed",
    );
    expect(f.service.server.listening).toBe(false);
    await request(f.service.app).get("/ready").expect(503, { ok: false });
    expect(
      f.calls.every(
        (c) =>
          c.method === "GET" ||
          c.path === "/twirp/livekit.RoomService/ListRooms",
      ),
    ).toBe(true);
  } finally {
    await f.close();
  }
});

test("shutdown racing startup closes the pending listener without creating background work", async () => {
  const f = await fixture(true);
  try {
    const starting = f.service.listen();
    const closing = f.service.close();
    await expect(starting).rejects.toThrow("closed during startup");
    await closing;
    expect(f.service.server.listening).toBe(false);
    expect(
      f.calls.filter(
        (c) => new URLSearchParams(c.query).get("select") === "id,room_code",
      ),
    ).toHaveLength(0);
  } finally {
    await f.close();
  }
});

test("teacher settings and presenter transfer enforce live permissions; ending closes drawing and revokes attendees", async () => {
  const f = await fixture();
  const attendees = [
    {
      identity: teacher,
      name: "Teacher",
      metadata: JSON.stringify({
        isHost: true,
        attendanceKey: `user:${teacher}`,
      }),
    },
    {
      identity: kid,
      name: "Child",
      metadata: JSON.stringify({ isHost: false, attendanceKey: `user:${kid}` }),
    },
  ];
  jest
    .spyOn(RoomServiceClient.prototype, "listParticipants")
    .mockResolvedValue(attendees as never);
  jest.spyOn(RoomServiceClient.prototype, "listRooms").mockResolvedValue([]);
  jest
    .spyOn(RoomServiceClient.prototype, "getParticipant")
    .mockImplementation(
      async (_room, identity) =>
        attendees.find((p) => p.identity === identity) as never,
    );
  const update = jest
    .spyOn(RoomServiceClient.prototype, "updateParticipant")
    .mockResolvedValue({} as never);
  jest
    .spyOn(RoomServiceClient.prototype, "sendData")
    .mockResolvedValue({} as never);
  const remove = jest
    .spyOn(RoomServiceClient.prototype, "removeParticipant")
    .mockResolvedValue({} as never);
  const deleted = jest
    .spyOn(RoomServiceClient.prototype, "deleteRoom")
    .mockResolvedValue({} as never);
  try {
    const post = (path: string, body: object) =>
      request(f.service.app)
        .post("/rtc/" + path)
        .set("Authorization", "Bearer teacher-token")
        .send(body);
    await request(f.service.app)
      .post("/rtc/classroom-end")
      .set("Authorization", "Bearer kid-token")
      .send({ roomCode: "ROOM" })
      .expect(403);
    await post("classroom-token", { roomCode: "ROOM" }).expect(200);
    await post("classroom-settings", {
      roomCode: "ROOM",
      settings: {
        allowStudentMic: false,
        allowStudentCam: false,
        forged: true,
      },
    }).expect(200);
    expect(f.room.settings).toMatchObject({
      allowStudentMic: false,
      allowStudentCam: false,
    });
    expect(f.room.settings.forged).toBeUndefined();
    const updates = update.mock.calls as unknown as Array<
      [string, string, UpdateParticipantOptions]
    >;
    expect(
      updates.some(
        (c) =>
          c[1] === kid && c[2]?.permission?.canPublishSources?.length === 0,
      ),
    ).toBe(true);
    await post("classroom-presenter-transfer", {
      roomCode: "ROOM",
      targetIdentity: kid,
    }).expect(200);
    expect(f.room.settings.presentationPresenterIdentity).toBe(kid);
    const permissions = updates.filter((c) =>
      c[2]?.permission?.canPublishSources?.includes(TrackSource.SCREEN_SHARE),
    );
    expect(permissions.some((c) => c[1] === kid)).toBe(true);
    const ended = await post("classroom-end", { roomCode: "ROOM" }).expect(200);
    expect(ended.body).toMatchObject({
      success: true,
      livekitDeleted: true,
      evictedParticipantCount: 2,
    });
    expect(f.room.status).toBe("ended");
    expect(deleted).toHaveBeenCalledWith("classroom-ROOM");
    expect(remove).toHaveBeenCalledTimes(2);
    expect(
      remove.mock.calls.every((c) => typeof c[2]?.revokeTokenTs === "bigint"),
    ).toBe(true);
    expect(
      f.calls.some(
        (c) =>
          c.path === "/rest/v1/game_sessions" &&
          c.method === "PATCH" &&
          c.body.status === "completed",
      ),
    ).toBe(true);
    await post("classroom-token", { roomCode: "ROOM" }).expect(404);
  } finally {
    await f.close();
  }
});

test("the compiled entry listens independently and exits cleanly on SIGTERM", async () => {
  const f = await fixture();
  const child = spawn(process.execPath, [join(__dirname, "../dist/index.js")], {
    env: {
      ...process.env,
      ...fixtureEnv,
      SUPABASE_URL: f.config.supabaseUrl,
      LIVEKIT_URL: f.config.livekitUrl,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data) => {
    output += data;
  });
  const exited = once(child, "exit");
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error("Compiled classroom listener did not become ready")),
        10_000,
      );
      let lines = "";
      child.stdout.on("data", (data: string) => {
        output += data;
        lines += data;
        let end: number;
        while ((end = lines.indexOf("\n")) >= 0) {
          const line = lines.slice(0, end);
          lines = lines.slice(end + 1);
          try {
            const record = JSON.parse(line);
            if (record.context?.event === "SERVICE_LISTENING") {
              clearTimeout(timeout);
              resolve(record.context.port);
            }
          } catch {}
        }
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Compiled classroom exited before listening"));
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const health = await fetch(origin + "/health");
    expect(await health.json()).toEqual({
      ok: true,
      service: "playground-classroom-server",
    });
    const response = await fetch(origin + "/rtc/classroom-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer teacher-token",
      },
      body: JSON.stringify({ roomCode: "ROOM" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      isHost: true,
      role: "teacher",
      drawingSessionId: drawingId,
    });
    expect(
      (await fetch(origin + "/socket.io/?EIO=4&transport=polling")).status,
    ).toBe(404);
    child.kill("SIGTERM");
    expect(await exited).toEqual([0, null]);
    expect(output).toContain("SERVICE_SHUTDOWN_COMPLETED");
    expect(output).not.toContain(f.config.signingSecret);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
    await f.close();
  }
}, 15_000);
