import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../../../games/voxel/src/client/world-audio-assets.ts", () => ({
  soundAssets: {
    "./sounds/step/stone1.ogg": "/stone1.ogg",
    "./sounds/step/stone2.ogg": "/stone2.ogg",
    "./sounds/random/explode1.ogg": "/explode1.ogg",
    "./sounds/random/explode2.ogg": "/explode2.ogg",
    "./sounds/ambient/weather/rain1.ogg": "/rain1.ogg",
  },
}));
import { WorldAudio } from "../../../../../games/voxel/src/client/world-audio.ts";
const sources: Node[] = [];
class Param {
  value = 0;
  setValueAtTime(n: number) {
    this.value = n;
  }
  setTargetAtTime(n: number) {
    this.value = n;
  }
  linearRampToValueAtTime(n: number) {
    this.value = n;
  }
  exponentialRampToValueAtTime(n: number) {
    this.value = n;
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  playbackRate = new Param();
  positionX = new Param();
  positionY = new Param();
  positionZ = new Param();
  buffer: any = null;
  onended: (() => void) | null = null;
  connect = vi.fn(() => this);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
}
class Context {
  state = "running";
  currentTime = 0;
  sampleRate = 100;
  destination = new Node();
  listener = { setPosition() {}, setOrientation() {} };
  createGain() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createPanner() {
    return new Node();
  }
  createOscillator() {
    return new Node();
  }
  createBufferSource() {
    const node = new Node();
    sources.push(node);
    return node;
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(200) };
  }
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => ({
    id: new Uint8Array(bytes)[0],
  }));
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}
let audio: WorldAudio;
beforeEach(() => {
  sources.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", Context);
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});
afterEach(async () => {
  await audio?.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("uses a decoded variant immediately while another variant hangs; never plays the stale action after loading", async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/stone2.ogg"
        ? new Promise((resolve) => (release = resolve))
        : Promise.resolve(new Response(new Uint8Array([1]))),
    ),
  );
  audio = new WorldAudio();
  audio.setActive(true);
  audio.unlock();
  await vi.advanceTimersByTimeAsync(0);
  audio.material("dig", [0, 0, 0], "stone");
  expect(sources).toHaveLength(1);
  expect(sources[0].start).toHaveBeenCalledTimes(1);
  release(new Response(new Uint8Array([2])));
  await vi.advanceTimersByTimeAsync(0);
  expect(sources).toHaveLength(1);
  audio.material("dig", [0, 0, 0], "stone");
  expect(sources[1].buffer.id).toBe(2);
});
it("bounds failed downloads, reports them nonfatally and lets a later request recover without replaying dropped sounds", async () => {
  const issue = vi.fn();
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      fail
        ? new Promise(() => {})
        : Promise.resolve(new Response(new Uint8Array([1]))),
    ),
  );
  audio = new WorldAudio(issue);
  audio.setActive(true);
  audio.unlock();
  await vi.advanceTimersByTimeAsync(5001);
  expect(issue).toHaveBeenCalledWith("audio_load_failed");
  expect(audio.stats.loading).toBeLessThanOrEqual(4);
  audio.material("dig", [0, 0, 0], "stone");
  expect(sources).toHaveLength(0);
  fail = false;
  await vi.advanceTimersByTimeAsync(20000);
  audio.material("dig", [0, 0, 0], "stone");
  await vi.advanceTimersByTimeAsync(0);
  // A dropped interaction is not replayed when its file eventually becomes ready.
  const count = sources.length;
  audio.material("dig", [0, 0, 0], "stone");
  expect(sources.length).toBe(count + 1);
});
it("simultaneous explosions stay bounded, and pause/dispose retire every voice and late load", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1]))),
  );
  audio = new WorldAudio();
  audio.setActive(true);
  audio.unlock();
  await vi.advanceTimersByTimeAsync(0);
  for (let n = 0; n < 100; n++) audio.effect("explosion", [0, 0, 0]);
  expect(audio.stats.voices).toBe(16);
  audio.setActive(false);
  expect(audio.stats.voices).toBe(0);
  await audio.dispose();
  expect(audio.stats.contexts).toBe(0);
  expect(audio.stats.buffers).toBe(0);
});
it("native audio errors and a failing diagnostic hook cannot escape into gameplay, and later playback recovers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1]))),
  );
  const issue = vi.fn(() => {
    throw new Error("telemetry unavailable");
  });
  audio = new WorldAudio(issue);
  audio.setActive(true);
  audio.unlock();
  await vi.advanceTimersByTimeAsync(0);
  const create = vi
    .spyOn(Context.prototype, "createBufferSource")
    .mockImplementation(() => {
      throw new DOMException("native graph interrupted", "InvalidStateError");
    });
  expect(() => audio.material("dig", [0, 0, 0], "stone")).not.toThrow();
  expect(issue).toHaveBeenCalledWith("audio_unavailable");
  create.mockRestore();
  await vi.advanceTimersByTimeAsync(1100);
  audio.material("dig", [0, 0, 0], "stone");
  expect(audio.stats.effects).toBe(1);
});

it("a native stop failure cannot strand other voices or break pause cleanup", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1]))),
  );
  audio = new WorldAudio();
  audio.setActive(true);
  audio.unlock();
  await vi.advanceTimersByTimeAsync(0);
  audio.effect("explosion", [0, 0, 0]);
  audio.effect("explosion", [0, 0, 0]);
  sources[0].stop.mockImplementationOnce(() => {
    throw new Error("native stop failure");
  });
  expect(() => audio.setActive(false)).not.toThrow();
  expect(audio.stats.voices).toBe(0);
  expect(audio.stats.gain).toBe(0);
});
