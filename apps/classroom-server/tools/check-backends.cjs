// Read-only provider checks. Never start the service or its attendance/cleanup jobs.
const { createClient } = require("@supabase/supabase-js");
const { RoomServiceClient } = require("livekit-server-sdk");
const { readClassroomConfig } = require("../dist/config.js");
async function main() {
  const config = readClassroomConfig();
  const client = createClient(config.supabaseUrl, config.signingSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const media = new RoomServiceClient(
    config.livekitUrl,
    config.livekitApiKey,
    config.livekitApiSecret,
    { requestTimeout: 5 },
  );
  const checks = [
    [
      "database",
      async () => {
        const result = await client
          .from("classroom_sessions")
          .select("id,room_code,status,settings")
          .limit(1)
          .abortSignal(AbortSignal.timeout(5000))
          .retry(false);
        if (result.error) throw result.error;
      },
    ],
    [
      "media",
      async () => {
        await media.listRooms();
      },
    ],
  ];
  const results = await Promise.allSettled(checks.map(([, run]) => run()));
  const status = Object.fromEntries(
    results.map((result, index) => {
      if (result.status === "fulfilled")
        return [checks[index][0], { ready: true }];
      const raw = result.reason?.status ?? result.reason?.code;
      const code =
        typeof raw === "number" && raw >= 400 && raw <= 599
          ? String(raw)
          : typeof raw === "string" &&
              /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(raw)
            ? raw
            : "UNAVAILABLE";
      return [checks[index][0], { ready: false, code }];
    }),
  );
  const ready = results.every((result) => result.status === "fulfilled");
  process.stdout.write(
    JSON.stringify({
      result: ready ? "PASS" : "NOT_READY",
      checks: status,
      readOnly: true,
      checkedAt: new Date().toISOString(),
    }) + "\n",
  );
  if (!ready) process.exitCode = 1;
}
main().catch(() => {
  process.stdout.write(
    JSON.stringify({
      result: "NOT_READY",
      code: "CONFIGURATION",
      readOnly: true,
      checkedAt: new Date().toISOString(),
    }) + "\n",
  );
  process.exitCode = 1;
});
