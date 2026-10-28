"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clientIp_1 = require("../clientIp");
function request(headers = {}, remoteAddress = "192.0.2.1") {
    return { headers, socket: { remoteAddress } };
}
describe("security IP attribution", () => {
    it("ignores forwarding headers unless the matching ingress is explicitly trusted", () => {
        const req = request({ "x-real-ip": "203.0.113.20", "x-forwarded-for": "203.0.113.21" });
        expect((0, clientIp_1.readSecurityClientIp)(req, "direct")).toMatchObject({ clientIp: "192.0.2.1", ipSource: "direct" });
        expect((0, clientIp_1.readSecurityClientIp)(req, "unavailable")).toEqual({ ipSource: "unavailable", ipStatus: "unavailable" });
        expect((0, clientIp_1.readSecurityClientIp)(req, "railway")).toMatchObject({ clientIp: "203.0.113.20", ipSource: "railway" });
    });
    it.each([undefined, "garbage", "192.0.2.1, 192.0.2.2", ["192.0.2.1", "192.0.2.2"], "fe80::1%eth0", "192.0.2.1:80"])("does not replace invalid or absent Railway evidence with a proxy or forwarded address: %s", (header) => {
        const req = request({ "x-forwarded-for": "203.0.113.21", ...(header === undefined ? {} : { "x-real-ip": header }) });
        expect((0, clientIp_1.readSecurityClientIp)(req, "railway")).toEqual({ ipSource: "railway", ipStatus: "unavailable" });
    });
    it.each([
        ["::ffff:192.0.2.1", "192.0.2.1"],
        ["::ffff:c000:201", "192.0.2.1"],
        ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"]
    ])("normalizes %s for consistent searches", (input, expected) => {
        expect((0, clientIp_1.readSecurityClientIp)(request({ "x-real-ip": input }), "railway")).toMatchObject({ clientIp: expected });
    });
});
//# sourceMappingURL=clientIp.test.js.map