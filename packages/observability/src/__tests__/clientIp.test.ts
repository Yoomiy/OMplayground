import type { Request } from "express";
import { readSecurityClientIp } from "../clientIp";

function request(headers: Record<string, string | string[]> = {}, remoteAddress = "192.0.2.1") {
  return { headers, socket: { remoteAddress } } as unknown as Request;
}

describe("security IP attribution", () => {
  it("ignores forwarding headers unless the matching ingress is explicitly trusted", () => {
    const req = request({ "x-real-ip": "203.0.113.20", "x-forwarded-for": "203.0.113.21" });
    expect(readSecurityClientIp(req, "direct")).toMatchObject({ clientIp: "192.0.2.1", ipSource: "direct" });
    expect(readSecurityClientIp(req, "unavailable")).toEqual({ ipSource: "unavailable", ipStatus: "unavailable" });
    expect(readSecurityClientIp(req, "railway")).toMatchObject({ clientIp: "203.0.113.20", ipSource: "railway" });
  });

  it.each([undefined, "garbage", "192.0.2.1, 192.0.2.2", ["192.0.2.1", "192.0.2.2"], "fe80::1%eth0", "192.0.2.1:80"])(
    "does not replace invalid or absent Railway evidence with a proxy or forwarded address: %s",
    (header) => {
      const req = request({ "x-forwarded-for": "203.0.113.21", ...(header === undefined ? {} : { "x-real-ip": header }) });
      expect(readSecurityClientIp(req, "railway")).toEqual({ ipSource: "railway", ipStatus: "unavailable" });
    }
  );

  it.each([
    ["::ffff:192.0.2.1", "192.0.2.1"],
    ["::ffff:c000:201", "192.0.2.1"],
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"]
  ])("normalizes %s for consistent searches", (input, expected) => {
    expect(readSecurityClientIp(request({ "x-real-ip": input }), "railway")).toMatchObject({ clientIp: expected });
  });
});
