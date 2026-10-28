import type { DrawingCanvasSnapshot } from "@playground/game-logic";

export function createLocalDrawingSnapshot(
  elements: unknown[],
  files: Record<string, unknown>,
  clearVersion: number,
  now = Date.now()
): DrawingCanvasSnapshot {
  return {
    engine: "excalidraw",
    version: now,
    clearVersion,
    updatedAt: now,
    elements,
    files
  };
}

export class LocalDrawingPersistenceQueue {
  private dirty = false;
  private inFlight: Promise<void> | null = null;

  markDirty(): void {
    this.dirty = true;
  }

  async flush(
    createSnapshot: () => DrawingCanvasSnapshot,
    persist: (snapshot: DrawingCanvasSnapshot) => void | Promise<void>
  ): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      if (this.dirty) await this.flush(createSnapshot, persist);
      return;
    }
    if (!this.dirty) return;

    this.dirty = false;
    const snapshot = createSnapshot();
    const operation = Promise.resolve(persist(snapshot)).catch((error) => {
      this.dirty = true;
      throw error;
    });
    this.inFlight = operation;
    try {
      await operation;
    } finally {
      if (this.inFlight === operation) this.inFlight = null;
    }
    if (this.dirty) await this.flush(createSnapshot, persist);
  }
}
