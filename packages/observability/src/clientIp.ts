import { isIP } from "net";
import type { Request } from "express";

export type ClientIpSource = "railway" | "direct" | "unavailable";

/** Only select railway when ingress overwrites X-Real-IP and cannot be bypassed. */
export function readSecurityClientIp(req: Request, source: ClientIpSource) {
  const candidate = source === "railway"
    ? req.headers["x-real-ip"]
    : source === "direct" ? req.socket.remoteAddress : undefined;
  if (typeof candidate !== "string" || candidate.includes("%") || !isIP(candidate)) {
    return { ipSource: source, ipStatus: "unavailable" as const };
  }
  const mapped = candidate.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  let clientIp = mapped ? mapped[1] : isIP(candidate) === 6
    ? new URL(`http://[${candidate}]/`).hostname.slice(1, -1)
    : candidate;
  const mappedHex = clientIp.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    clientIp = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return { clientIp, ipSource: source, ipStatus: "available" as const };
}
