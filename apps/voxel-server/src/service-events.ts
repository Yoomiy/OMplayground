import type { createLogger } from "@playground/observability/dist/logger.js";

export type ServiceLogger = Pick<
  ReturnType<typeof createLogger>,
  "debug" | "info" | "warn" | "error"
>;
type Context = Record<string, string | number | boolean>;
type Level = "debug" | "info" | "warn" | "error";
type Policy = { level: Level; status: string; message: string };
const policy = (level: Level, status: string, message: string): Policy => ({
  level,
  status,
  message,
});

// Each event has an operational meaning. Never infer health from its spelling.
const policies: Readonly<Record<string, Policy>> = {
  VOXEL_SERVICE_STARTED: policy("info", "success", "Voxel service started"),
  VOXEL_ADMISSION_REJECTED: policy(
    "warn",
    "rejected",
    "Gameplay admission rejected",
  ),
  VOXEL_ADMISSION_ISSUED: policy("debug", "success", "Admission ticket issued"),
  VOXEL_ADMISSION_ACCEPTED: policy(
    "debug",
    "success",
    "Gameplay admission accepted",
  ),
  VOXEL_ROOM_METRICS: policy(
    "debug",
    "observed",
    "Room timing window recorded",
  ),
  VOXEL_CHECKPOINT_COMMITTED: policy(
    "debug",
    "success",
    "Room checkpoint committed",
  ),
  VOXEL_ROOM_READY: policy("info", "success", "Room worker ready"),
  VOXEL_ROOM_RETIRING: policy("info", "started", "Room retirement started"),
  VOXEL_ROOM_SAVED_AND_RELEASED: policy(
    "info",
    "success",
    "Room saved and ownership released",
  ),
  VOXEL_EMPTY_ROOM_STOPPED: policy("info", "success", "Empty room stopped"),
  VOXEL_SESSION_ENDED: policy("info", "success", "Session ended"),
  VOXEL_ACTOR_REVOKED: policy("info", "revoked", "Actor access revoked"),
  VOXEL_ROSTER_LEFT: policy("info", "success", "Actor left session roster"),
  VOXEL_CONTROL_COMPLETED: policy("info", "success", "Room control completed"),
  VOXEL_STAFF_COMPLETED: policy("info", "success", "Staff command completed"),
  VOXEL_CHAT_APPLIED: policy("debug", "success", "Chat operation applied"),
  VOXEL_MODERATION_POLICY_APPLIED: policy(
    "info",
    "success",
    "Moderation policy applied",
  ),
  VOXEL_BACKPRESSURE_RECOVERY: policy(
    "warn",
    "recovering",
    "Socket backpressure requires resynchronization",
  ),
  VOXEL_ROOM_FAILED: policy(
    "error",
    "failed",
    "Room failed; reconnect required",
  ),
  VOXEL_LEASE_RELEASE_FAILED: policy(
    "error",
    "failed",
    "Room ownership release failed",
  ),
  VOXEL_DEFERRED_RETIREMENT_FAILED: policy(
    "error",
    "failed",
    "Deferred room retirement failed",
  ),
  VOXEL_CHECKPOINT_FAILED: policy("error", "failed", "Room checkpoint failed"),
  VOXEL_SESSION_PROJECTION_FAILED: policy(
    "error",
    "failed",
    "Session presence publication failed",
  ),
  VOXEL_ROOM_POLICY_UNAVAILABLE: policy(
    "error",
    "failed",
    "Room policy unavailable",
  ),
  VOXEL_OWNER_POLICY_UNAVAILABLE: policy(
    "error",
    "failed",
    "Owner authorization unavailable",
  ),
  VOXEL_CONTROL_FAILED: policy("error", "failed", "Room control failed"),
  VOXEL_HTTP_FAILED: policy("error", "failed", "Voxel HTTP operation failed"),
  VOXEL_CLIENT_UPGRADE_FAILED: policy(
    "error",
    "failed",
    "Client transport upgrade failed",
  ),
  VOXEL_VOICE_REJECTED: policy("warn", "rejected", "Voice admission rejected"),
  VOXEL_CLEANUP_FAILED: policy("error", "failed", "Checkpoint cleanup failed"),
  VOXEL_SESSION_API_REJECTED: policy(
    "warn",
    "rejected",
    "Session API request rejected",
  ),
  VOXEL_CONTROL_REJECTED: policy("warn", "rejected", "Room control rejected"),
  VOXEL_STAFF_REJECTED: policy("warn", "rejected", "Staff command rejected"),
  VOXEL_CHAT_REJECTED: policy("warn", "rejected", "Chat operation rejected"),
  VOXEL_MODERATION_REJECTED: policy(
    "warn",
    "rejected",
    "Moderation operation rejected",
  ),
};

export function voxelEventPolicy(name: string, context: Context): Policy {
  switch (name) {
    case "VOXEL_ROOM_METRICS":
      return Number(context.overrunMs) > 0
        ? policy(
            "warn",
            "degraded",
            "Room simulation dropped time after exceeding its catch-up budget",
          )
        : policies.VOXEL_ROOM_METRICS!;
    case "VOXEL_CLEANUP_COMPLETED":
      return Number(context.failed) > 0
        ? policy(
            "warn",
            "partial",
            "Checkpoint cleanup completed with failures",
          )
        : policy(
            Number(context.pruned) > 0 || Number(context.deleted) > 0
              ? "info"
              : "debug",
            "success",
            "Checkpoint cleanup completed",
          );
    case "VOXEL_CLIENT_FAILURE":
      if (
        ["BROWSER_NOT_ALLOWED", "BROWSER_ABORTED"].includes(
          String(context.code),
        ) &&
        context.fatal !== true
      )
        return policy(
          "debug",
          "rejected",
          "Browser rejected an optional interaction",
        );
      return policy(
        context.fatal === true ||
          [
            "prediction",
            "replication",
            "worker",
            "stream",
            "webgl",
            "inventory",
            "actors",
            "drops",
            "explosives",
          ].includes(String(context.operation))
          ? "error"
          : "warn",
        "failed",
        "Client operation failed",
      );
    case "VOXEL_ACTOR_DISCONNECTED":
      return context.reason === "RECOVERING"
        ? policy(
            "warn",
            "recovering",
            context.origin === "authorization"
              ? "Authorization expired during renewal; reconnect required"
              : "Worker requested actor recovery",
          )
        : policy(
            "info",
            "disconnected",
            "Actor disconnected by session policy",
          );
    case "VOXEL_CONNECTION_FAILED":
      return context.reason === "session_ended"
        ? policy("info", "disconnected", "Connection ended with session")
        : policy("error", "failed", "Gameplay connection failed");
    case "VOXEL_CONNECTION_CLOSED":
      if (
        [
          "VOXEL_ACTOR_DISCONNECTED",
          "VOXEL_CONNECTION_FAILED",
          "VOXEL_BACKPRESSURE_RECOVERY",
          "VOXEL_ROOM_FAILED",
        ].includes(String(context.reportedEvent))
      )
        return policy(
          "debug",
          context.code === 1012 || context.code === 1013
            ? "recovering"
            : "closed",
          "Connection closed after a reported policy decision or failure",
        );
      if (context.reason === "service_shutdown")
        return policy(
          "debug",
          "closed",
          "Connection closed during service shutdown",
        );
      if (
        [
          "session_ended",
          "room_access_revoked",
          "unauthorized",
          "authorization_denied",
        ].includes(String(context.reason))
      )
        return policy(
          "info",
          "rejected",
          "Gameplay connection closed by session policy",
        );
      if (context.code === 1000 || context.code === 1001)
        return policy("debug", "closed", "Gameplay connection closed");
      return policy(
        "warn",
        context.code === 1012 || context.code === 1013
          ? "recovering"
          : "closed",
        "Gameplay connection closed unexpectedly",
      );
    case "VOXEL_ROOM_EXITED":
      return context.expected === true && context.code === 0
        ? policy("debug", "closed", "Room worker stopped")
        : policy("error", "failed", "Room worker exited unexpectedly");
  }
  if (
    [
      "CONTROL_UNAVAILABLE",
      "STAFF_UNCONFIRMED",
      "CHAT_UNCONFIRMED",
      "VOICE_UNAVAILABLE",
      "MODERATION_UNCONFIRMED",
      "SESSION_UNAVAILABLE",
      "SCHOOL_POLICY_UNAVAILABLE",
    ].includes(String(context.code))
  )
    return policy("error", "failed", "Voxel service operation unavailable");
  return Object.hasOwn(policies, name)
    ? policies[name]!
    : policy("warn", "unknown", "Unclassified voxel event");
}

export function createVoxelEventLogger(logger: ServiceLogger) {
  return (name: string, context: Context) => {
    const { correlationId: suppliedCorrelationId, ...details } = context;
    const correlationId =
      suppliedCorrelationId ?? context.admissionId ?? context.connectionId;
    const { level, status, message } = voxelEventPolicy(name, context);
    logger[level]({
      ...(typeof correlationId === "string" ? { correlationId } : {}),
      message,
      protocol:
        name === "VOXEL_CONNECTION_CLOSED" || name === "VOXEL_CONNECTION_FAILED"
          ? "socket"
          : "internal",
      context: { ...details, event: name, status },
    });
  };
}
