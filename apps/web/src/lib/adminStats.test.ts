import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFederatedAdminStats } from "./adminStats";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const stats = (service: string) => ({ service, activeConnections: 2, activeRoomsCount: 1, rooms: [] });
function config() {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_GAME_SERVER_URL", "https://game.example/");
  vi.stubEnv("VITE_CLASSROOM_SERVER_URL", "https://classroom.example/");
  vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "https://voxel.example/");
  vi.stubEnv("VITE_VOXEL_SERVER_URL", "https://retired.invalid");
}

describe("independent admin services", () => {
  it("uses the native voxel read API and the separate classroom endpoint", async () => {
    config();
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => stats(url.includes("classroom") ? "classroom-server" : url.includes("voxel") ? "voxel-server" : "game-server") }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchFederatedAdminStats("admin-token");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://game.example/api/admin/stats",
      "https://voxel.example/api/voxel/admin-stats",
      "https://classroom.example/api/admin/stats"
    ]);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[1][1]).toMatchObject({ method: "POST", body: "{}", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" } });
    expect(calls[0][1]?.method).toBe("GET");
    expect(calls[2][1]?.method).toBe("GET");
    expect(result.classroom?.service).toBe("classroom-server");
    expect(result.voxel?.socketEventsPerSecond).toBeUndefined();
  });

  it("keeps healthy classroom stats when voxel configuration is missing and a game fetch fails", async () => {
    config();
    vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("game.example")) throw new Error("offline");
      return { ok: true, json: async () => stats("classroom-server") };
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchFederatedAdminStats("token")).toEqual({ game: null, voxel: null, classroom: stats("classroom-server") });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("isolates rejected authorization and wrong-service or malformed responses", async () => {
    config();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: !url.includes("game.example"),
      json: async () => url.includes("voxel") ? stats("minecraft-server") : { ...stats("classroom-server"), rooms: null }
    })));
    expect(await fetchFederatedAdminStats("token")).toEqual({ game: null, voxel: null, classroom: null });
  });
});
