import { describe, expect, it, vi } from "vitest";
import { attachMediaTrack, type AttachableMediaTrack } from "./ClassroomCameraRail";

describe("attachMediaTrack", () => {
  it("attaches to the supplied element and detaches that element during cleanup", () => {
    const element = {} as HTMLMediaElement;
    const track: AttachableMediaTrack = {
      attach: vi.fn(),
      detach: vi.fn()
    };

    const cleanup = attachMediaTrack(track, element);

    expect(track.attach).toHaveBeenCalledTimes(1);
    expect(track.attach).toHaveBeenCalledWith(element);

    cleanup();

    expect(track.detach).toHaveBeenCalledTimes(1);
    expect(track.detach).toHaveBeenCalledWith(element);
  });

  it("does not let an already-detached LiveKit track break React cleanup", () => {
    const track: AttachableMediaTrack = {
      attach: vi.fn(),
      detach: vi.fn(() => {
        throw new Error("already detached");
      })
    };

    const cleanup = attachMediaTrack(track, {} as HTMLMediaElement);

    expect(cleanup).not.toThrow();
  });
});
