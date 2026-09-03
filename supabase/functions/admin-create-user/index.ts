import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

interface AdminNewProfile {
  username: string;
  password?: string;
  full_name: string;
  gender: "boy" | "girl";
  role: "kid" | "teacher" | "admin";
  grade: string;
  avatar_color: string;
  avatar_preset_id: string | null;
}

serve(async (req) => {
  const suppliedCorrelationId = req.headers.get("x-correlation-id")?.trim();
  const correlationId = suppliedCorrelationId && suppliedCorrelationId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : `c-${crypto.randomUUID()}`;
  let createdUserId: string | undefined;
  let profileCreated = false;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn(JSON.stringify({ event: "ADMIN_CREATE_USER_UNAUTHORIZED", correlationId, reason: "missing_bearer" }));
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error(JSON.stringify({ event: "ADMIN_CREATE_USER_CONFIG_MISSING", correlationId }));
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }
    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      console.warn(JSON.stringify({ event: "ADMIN_CREATE_USER_UNAUTHORIZED", correlationId, code: userError?.code }));
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const { count, error: adminCheckError } = await supabase
      .from("admin_profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id);
    if (adminCheckError || count !== 1) {
      console.warn(JSON.stringify({ event: "ADMIN_CREATE_USER_FORBIDDEN", correlationId, actorId: user.id, code: adminCheckError?.code }));
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403
      });
    }

    const profile: AdminNewProfile = await req.json();

    const email = `${profile.username}@playground.school.local`;
    const password = profile.password || Math.random().toString(36).slice(-10);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    const newUserId = authData.user!.id;
    createdUserId = newUserId;

    if (profile.role === "admin") {
      const { error: adminProfileError } = await supabase
        .from("admin_profiles")
        .insert({
          id: newUserId,
          email,
          full_name: profile.full_name
        });
      if (adminProfileError) throw adminProfileError;
    } else {
      const { error: kidProfileError } = await supabase
        .from("kid_profiles")
        .insert({
          id: newUserId,
          username: profile.username,
          full_name: profile.full_name,
          gender: profile.gender,
          grade: profile.grade,
          role: profile.role,
          avatar_color: profile.avatar_color,
          avatar_preset_id: profile.avatar_preset_id
        });
      if (kidProfileError) throw kidProfileError;
    }
    profileCreated = true;

    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_kind: "admin",
      action: "admin_user_created",
      entity_type: "user",
      entity_id: newUserId,
      metadata: { correlation_id: correlationId, role: profile.role }
    });
    if (auditError) {
      console.error(JSON.stringify({ event: "ADMIN_CREATE_USER_AUDIT_FAILED", correlationId, code: auditError.code }));
    }
    console.log(JSON.stringify({ event: "ADMIN_CREATE_USER_COMPLETED", correlationId, actorId: user.id, userId: newUserId, role: profile.role }));

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201
    });
  } catch (error) {
    if (createdUserId && !profileCreated) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const cleanupClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: cleanupError } = await cleanupClient.auth.admin.deleteUser(createdUserId);
        if (cleanupError) console.error(JSON.stringify({ event: "ADMIN_CREATE_USER_COMPENSATION_FAILED", correlationId, userId: createdUserId, code: cleanupError.code }));
      }
    }
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error(JSON.stringify({ event: "ADMIN_CREATE_USER_FAILED", correlationId, code }));
    return new Response(JSON.stringify({ error: "user_creation_failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});
