import { afterEach, expect, it, vi } from "vitest";
import { getClassroomServerUrl } from "./classroomServerUrl";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("classroom requests use their own deployment address and cannot fall back to a game service", () => {
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_CLASSROOM_SERVER_URL", "");
  vi.stubEnv("VITE_VOXEL_SERVER_URL", "https://old-game.invalid");
  vi.stubEnv("VITE_VOXEL_RUNTIME_SERVER_URL", "https://voxel.invalid");
  expect(() => getClassroomServerUrl()).toThrow("CLASSROOM_CONFIGURATION");
  vi.stubEnv("VITE_CLASSROOM_SERVER_URL", " https://classroom.invalid/ ");
  expect(getClassroomServerUrl()).toBe("https://classroom.invalid");
});

it("development classrooms use their own proxy namespace at the forwarded browser origin", () => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_CLASSROOM_SERVER_URL", "");
  vi.stubGlobal("window", { location: { origin: "http://localhost:57173" } });
  expect(getClassroomServerUrl()).toBe("http://localhost:57173/__classroom");
  vi.stubEnv("VITE_CLASSROOM_SERVER_URL", "https://classroom.example/");
  expect(getClassroomServerUrl()).toBe("https://classroom.example");
});
