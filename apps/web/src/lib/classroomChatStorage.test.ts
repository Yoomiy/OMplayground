import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classroomChatStorageKey,
  clearClassroomChatCache,
  loadClassroomChatCache,
  storePrivateClassroomChatMessage,
  storePublicClassroomChatMessage
} from "./classroomChatStorage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("classroom chat session storage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps public and private threads separate across a reload", () => {
    const key = classroomChatStorageKey("classroom-a", "user-a");
    storePublicClassroomChatMessage(key, {
      id: "public-1", senderName: "מורה", text: "בוקר טוב", timestamp: 1, isHost: true
    });
    storePrivateClassroomChatMessage(key, "user-teacher", {
      id: "private-1", senderName: "מורה", text: "אפשר לעזור?", timestamp: 2, isHost: true
    });

    expect(loadClassroomChatCache(key)).toEqual({
      version: 1,
      publicMessages: [{ id: "public-1", senderName: "מורה", text: "בוקר טוב", timestamp: 1, isHost: true }],
      privateThreads: {
        "user-teacher": [{ id: "private-1", senderName: "מורה", text: "אפשר לעזור?", timestamp: 2, isHost: true }]
      }
    });
  });

  it("deduplicates messages and clears the tab-scoped cache", () => {
    const key = classroomChatStorageKey("classroom-a", "user-a");
    const message = { id: "public-1", senderName: "דני", text: "היי", timestamp: 1 };
    storePublicClassroomChatMessage(key, message);
    storePublicClassroomChatMessage(key, message);
    expect(loadClassroomChatCache(key).publicMessages).toHaveLength(1);

    clearClassroomChatCache(key);
    expect(loadClassroomChatCache(key)).toEqual({ version: 1, publicMessages: [], privateThreads: {} });
  });
});
