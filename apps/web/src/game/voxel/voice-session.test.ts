import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoxelApi } from "./session-api";
import type { VoiceScene } from "@playground/voxel-runtime";

const mocks = vi.hoisted(() => ({
  rooms: [] as any[],
  capture: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("livekit-client", async () => {
  const { EventEmitter } = await import("node:events");
  class Room extends EventEmitter {
    state = "connected";
    activeSpeakers = [];
    remoteParticipants = new Map();
    localParticipant = {
      publishTrack: vi.fn(async () => {}),
      unpublishTrack: vi.fn(async () => {}),
    };
    connect = vi.fn((...args: unknown[]) => mocks.connect(...args));
    disconnect = vi.fn((...args: unknown[]) => mocks.connect(...args));
    constructor(public options: unknown) {
      super();
      mocks.rooms.push(this);
    }
  }
  return {
    Room,
    RoomEvent: Object.fromEntries(
      [
        "TrackSubscribed",
        "TrackUnsubscribed",
        "TrackPublished",
        "ParticipantConnected",
        "ParticipantDisconnected",
        "Reconnecting",
        "SignalReconnecting",
        "Reconnected",
        "Disconnected",
      ].map((name) => [name, name]),
    ),
    ConnectionState: { Connected: "connected", Disconnected: "disconnected" },
    Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
    createLocalAudioTrack: mocks.capture,
    getLogger: () => ({ setLevel() {} }),
    LogLevel: { silent: 0 },
  };
});
vi.mock("./voice-audio", () => ({
  VoiceAudio: class {
    stats = { outputSelection: false, blockedInputs: 0 };
    activate = vi.fn(async () => true);
    scene = vi.fn();
    close = vi.fn(async () => {});
    add = vi.fn();
    remove = vi.fn();
  },
}));
import { VoiceSession } from "./voice-session";

describe("voxel uses LiveKit's connection lifecycle", () => {
  let session: VoiceSession;
  const grant = {
    serverUrl: "wss://media.example",
    token: "header.payload.signature",
    publish: true,
    hidden: false,
  };
  function fixture() {
    const voiceToken = vi.fn(async () => grant);
    const scene = {
      listener: { position: [0, 0, 0] },
      sources: [],
    } as unknown as VoiceScene;
    session = new VoiceSession({
      api: { voiceToken } as unknown as VoxelApi,
      host: {} as HTMLElement,
      scene: () => scene,
      onState: () => {},
    });
    return voiceToken;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.rooms.length = 0;
    mocks.connect.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), { visibilityState: "visible" }),
    );
    const mediaStreamTrack = Object.assign(new EventTarget(), {
      readyState: "live",
    });
    mocks.capture
      .mockReset()
      .mockResolvedValue({ mediaStreamTrack, stop: vi.fn() });
  });
  afterEach(async () => {
    await session?.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("connects directly and preserves the room and microphone across SDK reconnects without requesting more tokens", async () => {
    const voiceToken = fixture();
    await session.start();
    const room = mocks.rooms[0];
    expect(room.connect).toHaveBeenCalledWith(grant.serverUrl, grant.token, {
      autoSubscribe: false,
    });
    expect(room.options).not.toHaveProperty("reconnectPolicy");
    await session.microphone(true);
    expect(session.state.microphone).toBe("on");
    for (const event of ["SignalReconnecting", "Reconnecting"]) {
      room.state = "reconnecting";
      room.emit(event);
      expect(session.state.phase).toBe("reconnecting");
      await session.start(); // An audio-unlock gesture must not replace an SDK reconnect.
      await vi.advanceTimersByTimeAsync(6000);
      expect(voiceToken).toHaveBeenCalledTimes(1);
      expect(room.disconnect).not.toHaveBeenCalled();
      expect(session.state.microphone).toBe("on");
      room.state = "connected";
      room.emit("Reconnected");
      expect(session.state.phase).toBe("connected");
    }
    expect(mocks.capture).toHaveBeenCalledTimes(1);
  });
  it("requests a fresh token only after LiveKit has fully disconnected", async () => {
    const voiceToken = fixture();
    await session.start();
    const room = mocks.rooms[0];
    room.state = "disconnected";
    room.emit("Disconnected");
    await vi.advanceTimersByTimeAsync(1200);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(voiceToken).toHaveBeenCalledTimes(2);
    expect(mocks.rooms).toHaveLength(2);
    expect(session.state.phase).toBe("connected");
  });
  it("cancels a pending token request without creating a late connection", async () => {
    fixture();
    let release!: (value: typeof grant) => void;
    const api = (session as any).options.api;
    api.voiceToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = session.start();
    await vi.advanceTimersByTimeAsync(0);
    session.stop();
    release(grant);
    await pending;
    expect(mocks.rooms).toHaveLength(0);
    expect(session.state.phase).toBe("off");
    await session.close();
    expect(session.stats.timers).toBe(0);
  });
  it("bounds a hanging token provider and retires its late grant while a later attempt succeeds", async () => {
    const token = fixture();
    let release!: (value: typeof grant) => void;
    token.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    const pending = session.start();
    await vi.advanceTimersByTimeAsync(15001);
    await pending;
    expect(session.state.phase).toBe("unavailable");
    await vi.advanceTimersByTimeAsync(1200);
    expect(session.state.phase).toBe("connected");
    release(grant);
    await Promise.resolve();
    expect(mocks.rooms).toHaveLength(1);
  });
  it("times out a stuck LiveKit connect without keeping its room or blocking the next attempt", async () => {
    fixture();
    let release!: () => void;
    mocks.connect.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const pending = session.start();
    await vi.advanceTimersByTimeAsync(10001);
    await pending;
    expect(session.state.phase).toBe("unavailable");
    expect(mocks.rooms[0].disconnect).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1200);
    expect(session.state.phase).toBe("connected");
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.state.phase).toBe("connected");
    expect(mocks.rooms[0].disconnect).toHaveBeenCalledTimes(2);
    expect(mocks.rooms[1].disconnect).not.toHaveBeenCalled();
  });
});
