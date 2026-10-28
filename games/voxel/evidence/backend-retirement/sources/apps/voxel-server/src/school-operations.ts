import type { GatewayOptions } from "../../../games/voxel/src/server/gateway.ts";
import { AccessDenied, bearerToken } from "./school-access.ts";
import type { SchoolAccess } from "./school-access.ts";

export type VoxelOperations = Readonly<{
  service: "voxel-server";
  activeConnections: number;
  activeRoomsCount: number;
  mediaConnections: number;
  rooms: ReadonlyArray<{
    sessionId: string;
    gameType: "voxel";
    connectionCount: number;
  }>;
}>;

/** Read-only operations use fresh administrator identity; they grant no room access. */
export function schoolOperationsApi(
  access: Pick<SchoolAccess, "identity">,
  snapshot: () => VoxelOperations,
): NonNullable<GatewayOptions["api"]> {
  return {
    "/api/voxel/admin-stats": async (req, body, res) => {
      try {
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(body).length
        )
          throw new AccessDenied("INVALID");
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        const started = Date.now();
        const identity = await access.identity(token);
        if (identity.subject.role !== "admin")
          throw new AccessDenied("FORBIDDEN");
        if (Date.now() >= Math.min(started + 5000, identity.expiresAt))
          throw new Error("expired operations proof");
        res.setHeader("Cache-Control", "no-store");
        return snapshot();
      } catch (error) {
        const code =
          error instanceof AccessDenied ? error.code : "STATS_UNAVAILABLE";
        res.writeHead(
          code === "INVALID"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : code === "FORBIDDEN"
                ? 403
                : 503,
          {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        );
        res.end(JSON.stringify({ error: code }));
        return null;
      }
    },
  };
}
