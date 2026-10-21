import { ClassroomAdmissionIpCache } from "../classroomAdmissionIp";

describe("classroom admission IP association", () => {
  const ip = { clientIp: "192.0.2.7", ipSource: "railway" as const, ipStatus: "available" as const };

  it("binds the IP to both the admission and its classroom participant", () => {
    const cache = new ClassroomAdmissionIpCache();
    cache.remember("ROOM", "admission-1", "guest-1", ip);
    expect(cache.lookup("ROOM", "admission-1", "guest-1")).toEqual({ ...ip, ipObservation: "admission" });
    expect(cache.lookup("OTHER", "admission-1", "guest-1").ipStatus).toBe("unavailable");
    expect(cache.lookup("ROOM", "admission-1", "guest-2").ipStatus).toBe("unavailable");
    expect(cache.lookup("ROOM").ipStatus).toBe("unavailable");
  });

  it("expires idle associations while active observations refresh them", () => {
    let now = 0;
    const cache = new ClassroomAdmissionIpCache(10, 100, () => now);
    cache.remember("ROOM", "idle", "guest-1", ip);
    cache.remember("ROOM", "active", "guest-2", ip);
    now = 90;
    expect(cache.lookup("ROOM", "active", "guest-2").ipStatus).toBe("available");
    now = 110;
    expect(cache.lookup("ROOM", "idle", "guest-1").ipStatus).toBe("unavailable");
    expect(cache.lookup("ROOM", "active", "guest-2").ipStatus).toBe("available");
  });

  it("bounds retained associations and preserves unavailable source evidence", () => {
    const cache = new ClassroomAdmissionIpCache(1);
    cache.remember("ROOM", "old", "guest-1", ip);
    cache.remember("ROOM", "new", "guest-2", { ipSource: "railway", ipStatus: "unavailable" });
    expect(cache.lookup("ROOM", "old", "guest-1").ipUnavailableReason).toBe("admission_not_cached");
    expect(cache.lookup("ROOM", "new", "guest-2")).toEqual({
      ipSource: "railway", ipStatus: "unavailable", ipObservation: "admission"
    });
  });
});
