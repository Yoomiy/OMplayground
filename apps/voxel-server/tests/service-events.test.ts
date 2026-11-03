import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createVoxelEventLogger,
  voxelEventPolicy,
} from "../src/service-events.ts";

test("the disrupted dev run raises failures and recovery while routine activity stays debug", () => {
  const cases: [
    string,
    Record<string, string | number | boolean>,
    string,
    string,
  ][] = [
    [
      "VOXEL_CLIENT_FAILURE",
      { operation: "prediction", code: "RUNTIME_FAILURE" },
      "error",
      "failed",
    ],
    [
      "VOXEL_CLIENT_FAILURE",
      { operation: "admission", code: "UNAVAILABLE" },
      "warn",
      "failed",
    ],
    [
      "VOXEL_CLIENT_FAILURE",
      { operation: "pointer_lock", code: "BROWSER_NOT_ALLOWED" },
      "debug",
      "rejected",
    ],
    [
      "VOXEL_CLIENT_FAILURE",
      { operation: "pointer_lock", code: "RUNTIME_FAILURE" },
      "warn",
      "failed",
    ],
    [
      "VOXEL_CLIENT_FAILURE",
      { operation: "pointer_lock", code: "BROWSER_ABORTED", fatal: true },
      "error",
      "failed",
    ],
    [
      "VOXEL_ACTOR_DISCONNECTED",
      {
        origin: "authorization",
        reason: "RECOVERING",
        authorizationFailure: "expired",
      },
      "warn",
      "recovering",
    ],
    [
      "VOXEL_ACTOR_DISCONNECTED",
      { origin: "worker", reason: "RECOVERING" },
      "warn",
      "recovering",
    ],
    [
      "VOXEL_ACTOR_DISCONNECTED",
      { reason: "SESSION_ENDED" },
      "info",
      "disconnected",
    ],
    [
      "VOXEL_CONNECTION_CLOSED",
      { code: 1008, reason: "admission_required" },
      "warn",
      "closed",
    ],
    [
      "VOXEL_CONNECTION_CLOSED",
      { code: 1012, reportedEvent: "VOXEL_ACTOR_DISCONNECTED" },
      "debug",
      "recovering",
    ],
    ["VOXEL_CONNECTION_CLOSED", { code: 1012 }, "warn", "recovering"],
    ["VOXEL_CONNECTION_CLOSED", { code: 1005 }, "debug", "closed"],
    ["VOXEL_CONNECTION_CLOSED", { code: 1000 }, "debug", "closed"],
    [
      "VOXEL_CONNECTION_CLOSED",
      { code: 1006, reason: "service_shutdown" },
      "debug",
      "closed",
    ],
    [
      "VOXEL_CONNECTION_CLOSED",
      { code: 1008, reason: "session_ended" },
      "info",
      "rejected",
    ],
    ["VOXEL_ROOM_EXITED", { code: 0, expected: false }, "error", "failed"],
    ["VOXEL_ROOM_EXITED", { code: 1, expected: true }, "error", "failed"],
    ["VOXEL_ROOM_EXITED", { code: 0, expected: true }, "debug", "closed"],
    ["VOXEL_ROOM_METRICS", { ticks: 300, overrunMs: 0 }, "debug", "observed"],
    ["VOXEL_ROOM_METRICS", { overrunMs: 150 }, "warn", "degraded"],
    ["VOXEL_CHECKPOINT_COMMITTED", {}, "debug", "success"],
    ["VOXEL_ADMISSION_ISSUED", {}, "debug", "success"],
    [
      "VOXEL_CLEANUP_COMPLETED",
      { pruned: 0, deleted: 0, failed: 0 },
      "debug",
      "success",
    ],
    [
      "VOXEL_CLEANUP_COMPLETED",
      { pruned: 1, deleted: 1, failed: 0 },
      "info",
      "success",
    ],
    [
      "VOXEL_CLEANUP_COMPLETED",
      { pruned: 1, deleted: 0, failed: 1 },
      "warn",
      "partial",
    ],
    ["VOXEL_BACKPRESSURE_RECOVERY", {}, "warn", "recovering"],
    ["VOXEL_CHECKPOINT_FAILED", {}, "error", "failed"],
    ["VOXEL_CONTROL_REJECTED", { code: "INVALID" }, "warn", "rejected"],
    [
      "VOXEL_CONTROL_REJECTED",
      { code: "CONTROL_UNAVAILABLE" },
      "error",
      "failed",
    ],
    [
      "VOXEL_SESSION_API_REJECTED",
      { code: "SESSION_UNAVAILABLE" },
      "error",
      "failed",
    ],
    [
      "VOXEL_ADMISSION_REJECTED",
      { code: "SCHOOL_POLICY_UNAVAILABLE" },
      "error",
      "failed",
    ],
    ["VOXEL_SERVICE_STARTED", {}, "info", "success"],
    ["VOXEL_NEW_EVENT", {}, "warn", "unknown"],
    ["__proto__", {}, "warn", "unknown"],
  ];
  for (const [name, context, level, status] of cases) {
    assert.equal(voxelEventPolicy(name, context).level, level, name);
    assert.equal(voxelEventPolicy(name, context).status, status, name);
  }
});

test("event output preserves correlation and cannot report a client failure as success", () => {
  const logs: { level: string; value: any }[] = [];
  const capture = (level: string) => (value: unknown) => {
    logs.push({ level, value });
  };
  const emit = createVoxelEventLogger({
    debug: capture("debug"),
    info: capture("info"),
    warn: capture("warn"),
    error: capture("error"),
  });
  emit("VOXEL_CLIENT_FAILURE", {
    correlationId: "fixture",
    operation: "prediction",
    status: "success",
    event: "fake",
    reason: "input_acknowledgement_stalled",
  });
  assert.equal(logs[0]!.level, "error");
  assert.equal(logs[0]!.value.correlationId, "fixture");
  assert.equal(logs[0]!.value.context.correlationId, undefined);
  assert.equal(logs[0]!.value.context.status, "failed");
  assert.equal(logs[0]!.value.context.event, "VOXEL_CLIENT_FAILURE");
  assert.equal(logs[0]!.value.context.reason, "input_acknowledgement_stalled");
  assert.equal(logs[0]!.value.message, "Client operation failed");
});

test("joining and routine player departure are info events, and pointer-lock reports never reach the logger", () => {
  assert.equal(
    voxelEventPolicy("VOXEL_ADMISSION_ACCEPTED", { role: "participant" }).level,
    "info",
  );
  assert.equal(
    voxelEventPolicy("VOXEL_ADMISSION_ACCEPTED", { role: "observer" }).message,
    "Observer joined room",
  );
  for (const code of [1000, 1001, 1005])
    assert.equal(
      voxelEventPolicy("VOXEL_CONNECTION_CLOSED", { phase: "active", code })
        .level,
      "info",
    );
  assert.equal(
    voxelEventPolicy("VOXEL_CONNECTION_CLOSED", { phase: "active", code: 1006 })
      .level,
    "warn",
  );
  const logs: unknown[] = [];
  const capture = (value: unknown) => {
    logs.push(value);
  };
  const emit = createVoxelEventLogger({
    debug: capture,
    info: capture,
    warn: capture,
    error: capture,
  });
  emit("VOXEL_CLIENT_FAILURE", {
    operation: "pointer_lock",
    code: "RUNTIME_FAILURE",
    reason: "unknown",
    fatal: true,
  });
  assert.equal(logs.length, 0);
});
