import type { Request } from "express";
export type ClientIpSource = "railway" | "direct" | "unavailable";
/** Only select railway when ingress overwrites X-Real-IP and cannot be bypassed. */
export declare function readSecurityClientIp(req: Request, source: ClientIpSource): {
    ipSource: ClientIpSource;
    ipStatus: "unavailable";
    clientIp?: undefined;
} | {
    clientIp: string;
    ipSource: ClientIpSource;
    ipStatus: "available";
};
//# sourceMappingURL=clientIp.d.ts.map