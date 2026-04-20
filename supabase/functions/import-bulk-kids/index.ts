import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

function syntheticEmail(username: string): string {
  return `${username.trim().toLowerCase()}@playground.school.local`;
}

Deno.serve(async (req) => {
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
    return json({ error: "no auth" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
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
    return json({ error: "unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: ap } = await adminClient
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!ap) {
    return json({ error: "forbidden" }, 403);
  }

  let body: { rows?: Array<Record<string, unknown>> };
  try {
    body = await req.json();
  } catch {
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
    const grade = Math.min(7, Math.max(1, Number(raw.grade) || 1));
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
        email_confirm: true,
        user_metadata: { username, full_name }
      });
    if (createErr || !created.user) {
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
      await adminClient.auth.admin.deleteUser(created.user.id);
      results.push({ username, ok: false, error: profErr.message });
      continue;
    }
    results.push({ username, ok: true });
  }

  await adminClient.from("audit_log").insert({
    actor_id: user.id,
    actor_kind: "admin",
    action: "bulk_import_kids",
    entity_type: "system",
    entity_id: null,
    metadata: {
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results
    }
  });

  return json({ results });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
