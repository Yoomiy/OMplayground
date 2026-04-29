import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminNewProfile {
  username: string;
  password?: string;
  full_name: string;
  gender: "boy" | "girl";
  role: "kid" | "teacher" | "admin";
  grade: number;
  avatar_color: string;
  avatar_preset_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Enforce admin-only access
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")!.replace("Bearer ", "")
    );
    if (!user) throw new Error("Forbidden");

    const { count, error: adminCheckError } = await supabase
      .from("admin_profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id);
    if (adminCheckError || count !== 1) {
      throw new Error("Forbidden: not an admin");
    }

    const profile: AdminNewProfile = await req.json();

    const email = `${profile.username}@playground.school.local`;
    const password = profile.password || Math.random().toString(36).slice(-10);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name,
        role: profile.role
      }
    });

    if (authError) throw authError;
    const newUserId = authData.user!.id;

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

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});
