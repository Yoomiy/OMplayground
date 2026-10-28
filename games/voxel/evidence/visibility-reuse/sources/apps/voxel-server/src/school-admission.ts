import type { AdmissionPolicy } from "../../../games/voxel/src/server/gateway.ts";
import type { GatewayOptions } from "../../../games/voxel/src/server/gateway.ts";
import { SchoolAccess, AccessDenied, bearerToken } from "./school-access.ts";
/** Install both school policy ports; connected and passive ownership require fresh reads. */
export function schoolGatewayPolicy(
  access: SchoolAccess,
  sessions?: NonNullable<GatewayOptions["sessions"]> & {
    roomPolicy: NonNullable<GatewayOptions["roomPolicy"]>;
  },
): Pick<GatewayOptions, "admit" | "resolveOwner" | "roomPolicy" | "sessions"> {
  return {
    admit: schoolAdmission(access),
    resolveOwner: (room, id) => access.resolveOwner(room, id),
    roomPolicy: (room) =>
      sessions ? sessions.roomPolicy(room) : access.roomPolicy(room),
    ...(sessions ? { sessions } : {}),
  };
}
/** HTTP boundary owns error responses; the game sees only an authenticated grant. */
export function schoolAdmission(access: SchoolAccess): AdmissionPolicy {
  return async (request, body, response) => {
    const token = bearerToken(request.headers.authorization);
    try {
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      return await access.grant(token, body);
    } catch (error) {
      const code =
        error instanceof AccessDenied
          ? error.code
          : "SCHOOL_POLICY_UNAVAILABLE";
      const status =
        code === "UNAUTHORIZED"
          ? 401
          : code === "INVALID"
            ? 400
            : error instanceof AccessDenied
              ? 403
              : 503;
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ error: code }));
      return null;
    }
  };
}
