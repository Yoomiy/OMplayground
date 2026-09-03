import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id"
};

function syntheticEmail(username: string): string {
  return `${username.trim().toLowerCase()}@playground.school.local`;
}

Deno.serve(async (req) => {
  const suppliedCorrelationId = req.headers.get("x-correlation-id")?.trim();
  const correlationId = suppliedCorrelationId && suppliedCorrelationId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : `c-${crypto.randomUUID()}`;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn(JSON.stringify({ event: "BULK_IMPORT_UNAUTHORIZED", correlationId, reason: "missing_authorization" }));
    return json({ error: "no auth" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error(JSON.stringify({ event: "BULK_IMPORT_CONFIG_MISSING", correlationId }));
    return json({ error: "server_misconfigured" }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const {
    data: { user },
    error: userErr
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn(JSON.stringify({ event: "BULK_IMPORT_UNAUTHORIZED", correlationId, code: userErr?.code }));
    return json({ error: "unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: ap, error: adminError } = await adminClient
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (adminError || !ap) {
    console.warn(JSON.stringify({ event: "BULK_IMPORT_FORBIDDEN", correlationId, code: adminError?.code }));
    return json({ error: "forbidden" }, 403);
  }

  let body: { rows?: Array<Record<string, unknown>> };
  try {
    body = await req.json();
  } catch {
    console.warn(JSON.stringify({ event: "BULK_IMPORT_REJECTED", correlationId, reason: "invalid_json" }));
    return json({ error: "invalid json" }, 400);
  }

  const rows = body.rows ?? [];
  const results: { username: string; ok: boolean; error?: string }[] = [];

  for (const raw of rows) {
    const username = String(raw.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(raw.password ?? "");
    const full_name = String(raw.full_name ?? "").trim();
    const gender = raw.gender === "girl" ? "girl" : "boy";
    const rawGrade = String(raw.grade ?? "").trim();
    const cleanGrade = rawGrade.replace(/['"]+/g, "");
    const validLetters = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
    const numMap: Record<string, string> = {
      "1": "א", "2": "ב", "3": "ג", "4": "ד", "5": "ה", "6": "ו", "7": "ז", "8": "ח"
    };
    const grade = validLetters.includes(cleanGrade)
      ? cleanGrade
      : (numMap[cleanGrade] ?? "א");
    const role = raw.role === "teacher" ? "teacher" : "kid";

    if (!username || !password || !full_name) {
      results.push({ username, ok: false, error: "missing fields" });
      continue;
    }

    const email = syntheticEmail(username);
    const { data: created, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
    if (createErr || !created.user) {
      console.warn(JSON.stringify({ event: "BULK_IMPORT_USER_CREATE_FAILED", correlationId, row: results.length, code: createErr?.code }));
      results.push({
        username,
        ok: false,
        error: createErr?.message ?? "create failed"
      });
      continue;
    }

    const { error: profErr } = await adminClient.from("kid_profiles").insert({
      id: created.user.id,
      username,
      full_name,
      gender,
      grade,
      role
    });
    if (profErr) {
      console.error(JSON.stringify({ event: "BULK_IMPORT_PROFILE_CREATE_FAILED", correlationId, row: results.length, userId: created.user.id, code: profErr.code }));
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id);
      if (cleanupError) {
        console.error(JSON.stringify({ event: "BULK_IMPORT_COMPENSATION_FAILED", correlationId, userId: created.user.id, code: cleanupError.code }));
      }
      results.push({ username, ok: false, error: profErr.message });
      continue;
    }
    results.push({ username, ok: true });
  }

  const successful = results.filter((r) => r.ok).length;
  const failed = results.length - successful;
  const { error: auditError } = await adminClient.from("audit_log").insert({
    actor_id: user.id,
    actor_kind: "admin",
    action: "bulk_import_kids",
    entity_type: "system",
    entity_id: null,
    metadata: {
      correlation_id: correlationId,
      requested: rows.length,
      ok: successful,
      failed
    }
  });
  if (auditError) {
    console.error(JSON.stringify({ event: "BULK_IMPORT_AUDIT_FAILED", correlationId, code: auditError.code }));
  }
  console.log(JSON.stringify({ event: "BULK_IMPORT_COMPLETED", correlationId, requested: rows.length, successful, failed }));

  return json({ results });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
