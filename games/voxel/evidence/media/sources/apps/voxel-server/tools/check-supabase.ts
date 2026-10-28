import {
  createSupabaseServerClient,
  SupabasePersistence,
  PersistenceError,
} from "../src/supabase-persistence.ts";
import { SupabaseStaff } from "../src/school-staff.ts";
import { SupabaseModeration } from "../src/school-moderation.ts";
import { SupabaseChat } from "../src/school-chat.ts";
import { SupabaseMedia } from "../src/school-media.ts";
import { SupabaseControls } from "../src/school-control.ts";
import { SupabaseSessions } from "../src/supabase-sessions.ts";
try {
  const client = createSupabaseServerClient(),
    backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    controls = new SupabaseControls(client),
    staff = new SupabaseStaff(client),
    moderation = new SupabaseModeration(client),
    chat = new SupabaseChat(client),
    media = new SupabaseMedia(client);
  const checks = [
    ["checkpoint", () => backend.verifyInstallation()],
    ["projection", () => sessions.verifyInstallation()],
    ["controls", () => controls.verifyInstallation()],
    ["roster", () => sessions.verifyRosterInstallation()],
    ["staff", () => staff.verifyInstallation()],
    ["moderation", () => moderation.verifyInstallation()],
    ["chat", () => chat.verifyInstallation()],
    ["media", () => media.verifyInstallation()],
  ] as const;
  const results = await Promise.allSettled(checks.map(([, run]) => run()));
  const status = Object.fromEntries(
    results.map((result, index) => [
      checks[index][0],
      result.status === "fulfilled"
        ? { ready: true }
        : {
            ready: false,
            code:
              result.reason instanceof PersistenceError
                ? result.reason.providerCode
                : "CONFIGURATION",
            operation:
              result.reason instanceof PersistenceError
                ? result.reason.operation
                : "configuration",
          },
    ]),
  );
  const ready = results.every((result) => result.status === "fulfilled");
  console.log(
    JSON.stringify({
      result: ready ? "PASS" : "NOT_READY",
      schema: status.checkpoint.ready ? 1 : null,
      privateBucket: status.checkpoint.ready ? true : null,
      sessionProjectionSchema: status.projection.ready ? 1 : null,
      controlsSchema: status.controls.ready ? 1 : null,
      rosterSchema: status.roster.ready ? 1 : null,
      staffSchema: status.staff.ready ? 1 : null,
      moderationSchema: status.moderation.ready ? 1 : null,
      chatSchema: status.chat.ready ? 1 : null,
      mediaSchema: status.media.ready ? 1 : null,
      checks: status,
      checkedAt: new Date().toISOString(),
    }),
  );
  if (!ready) process.exitCode = 1;
} catch (error) {
  console.log(
    JSON.stringify({
      result: "NOT_READY",
      schema: null,
      code:
        error instanceof PersistenceError
          ? error.providerCode
          : "CONFIGURATION",
      checkedAt: new Date().toISOString(),
    }),
  );
  process.exitCode = 1;
}
