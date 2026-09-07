import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id"
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  const suppliedCorrelationId = req.headers.get("x-correlation-id")?.trim();
  const correlationId = suppliedCorrelationId && suppliedCorrelationId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : `c-${crypto.randomUUID()}`;

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_UNAUTHORIZED", correlationId, reason: "missing_bearer" }));
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_CONFIG_MISSING", correlationId }));
    return json({ error: "server_misconfigured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const accessToken = authHeader.slice("Bearer ".length);
  const { data: { user: actor }, error: actorError } = await supabase.auth.getUser(accessToken);
  if (actorError || !actor) {
    console.warn(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_UNAUTHORIZED", correlationId, code: actorError?.code }));
    return json({ error: "unauthorized" }, 401);
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", actor.id)
    .maybeSingle();
  if (adminError || !adminProfile) {
    console.warn(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_FORBIDDEN", correlationId, actorId: actor.id, code: adminError?.code }));
    return json({ error: "forbidden" }, 403);
  }

  let body: { userId?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!userId || password.length < 6) return json({ error: "invalid_input" }, 400);

  const { data: target, error: targetError } = await supabase
    .from("kid_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) {
    console.error(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_TARGET_LOOKUP_FAILED", correlationId, actorId: actor.id, code: targetError.code }));
    return json({ error: "reset_failed" }, 500);
  }
  if (!target) return json({ error: "target_not_found" }, 404);

  const { error: resetError } = await supabase.auth.admin.updateUserById(userId, { password });
  if (resetError) {
    console.error(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_FAILED", correlationId, actorId: actor.id, code: resetError.code }));
    return json({ error: "reset_failed" }, 500);
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_id: actor.id,
    actor_kind: "admin",
    action: "admin_password_reset",
    entity_type: "user",
    entity_id: userId,
    metadata: { correlation_id: correlationId }
  });
  if (auditError) {
    console.error(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_AUDIT_FAILED", correlationId, actorId: actor.id, code: auditError.code }));
  }

  console.log(JSON.stringify({ event: "ADMIN_PASSWORD_RESET_COMPLETED", correlationId, actorId: actor.id, userId }));
  return json({ success: true }, 200);
});
