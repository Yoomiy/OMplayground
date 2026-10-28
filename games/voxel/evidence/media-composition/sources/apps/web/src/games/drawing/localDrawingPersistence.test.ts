import { describe, expect, it, vi } from "vitest";
import {
  createLocalDrawingSnapshot,
  LocalDrawingPersistenceQueue
} from "./localDrawingPersistence";

describe("local drawing persistence", () => {
  it("builds the durable snapshot from prepared elements and files", () => {
    expect(createLocalDrawingSnapshot(
      [{ id: "line" }],
      { image: { id: "image", dataURL: "prepared" } },
      3,
      123
    )).toEqual({
      engine: "excalidraw",
      version: 123,
      clearVersion: 3,
      updatedAt: 123,
      elements: [{ id: "line" }],
      files: { image: { id: "image", dataURL: "prepared" } }
    });
  });

  it("persists a newer edit that arrives while a save is in flight", async () => {
    const queue = new LocalDrawingPersistenceQueue();
    let releaseFirst!: () => void;
    const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const persist = vi.fn()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce(undefined);
    let revision = 1;
    const snapshot = () => createLocalDrawingSnapshot([], {}, 0, revision);

    queue.markDirty();
    const flushing = queue.flush(snapshot, persist);
    queue.markDirty();
    revision = 2;
    releaseFirst();
    await flushing;

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][0].version).toBe(2);
  });

  it("keeps a failed save dirty for a later retry", async () => {
    const queue = new LocalDrawingPersistenceQueue();
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    queue.markDirty();

    await expect(queue.flush(
      () => createLocalDrawingSnapshot([], {}, 0, 1),
      persist
    )).rejects.toThrow("offline");
    await queue.flush(() => createLocalDrawingSnapshot([], {}, 0, 2), persist);

    expect(persist).toHaveBeenCalledTimes(2);
  });
});
