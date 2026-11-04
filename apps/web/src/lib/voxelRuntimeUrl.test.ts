import { afterEach, expect, it, vi } from "vitest";
import { getVoxelRuntimeUrl } from "./voxelRuntimeUrl";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("development voxel connections use the forwarded browser origin", () => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "");
  vi.stubGlobal("window", { location: { origin: "http://localhost:57173" } });
  expect(getVoxelRuntimeUrl()).toBe("http://localhost:57173");
});

it("production requires an independent configured voxel URL", () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "");
  expect(() => getVoxelRuntimeUrl()).toThrow("VOXEL_RUNTIME_CONFIGURATION");
  vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "https://voxel.example");
  expect(getVoxelRuntimeUrl()).toBe("https://voxel.example");
});
