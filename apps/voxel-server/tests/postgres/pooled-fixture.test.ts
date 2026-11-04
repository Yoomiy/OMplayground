import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { PostgresTestDatabase } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { createSupabaseServerClient } from "../../src/supabase-persistence.ts";

const db = new PostgresTestDatabase({ pooled: true });
db.installSessionControls();
after(() => db.close());

test("pooled fixture preserves SQL values and isolates roles after successful and rejected queries", async () => {
  db.exec(
    "CREATE TABLE public.pool_probe(value text); INSERT INTO public.pool_probe VALUES ('private'); GRANT SELECT ON public.pool_probe TO service_role",
  );
  assert.equal(
    await db.valueAsync("SELECT value FROM public.pool_probe", "service_role"),
    "private",
  );
  await assert.rejects(
    db.valueAsync("SELECT value FROM public.pool_probe", "anon"),
    (error: any) => error.code === "42501",
  );
  const roles = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const role = ["anon", "authenticated", "service_role"][i % 3];
      return db
        .valueAsync("SELECT current_user", role)
        .then((value) => assert.equal(value, role));
    }),
  );
  assert.equal(roles.length, 12);
  assert.equal(
    await db.valueAsync("SELECT current_user"),
    process.env.PGUSER ?? "postgres",
  );
  assert.deepEqual(
    await db.valueAsync(
      "SELECT jsonb_build_object('yes',true,'no',false,'nothing',NULL,'list',jsonb_build_array(1,'שלום'))",
    ),
    { yes: true, no: false, nothing: null, list: [1, "שלום"] },
  );
});

test("pooled PostgREST fixture preserves the real SQL denial code", async () => {
  const wire = await supabaseWire(db);
  try {
    const client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    });
    const result = await client.rpc("voxel_media_state", {
      p_session: randomUUID(),
      p_actor: randomUUID(),
      p_authorized_until: new Date(Date.now() + 4000).toISOString(),
    });
    assert.equal(result.error?.code, "42501");
    assert.equal(result.status, 403);
  } finally {
    await wire.close();
  }
});
