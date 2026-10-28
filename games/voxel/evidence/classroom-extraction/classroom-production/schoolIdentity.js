"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchoolIdentity = getSchoolIdentity;
async function getSchoolIdentity(supabaseAdmin, token) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
        throw new Error("UNAUTHORIZED");
    }
    // 1. Check kid_profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
        .from("kid_profiles")
        .select("id, role, gender, grade, full_name, is_active")
        .eq("id", authData.user.id)
        .maybeSingle();
    if (profileError)
        throw profileError;
    if (profile && !profile.is_active)
        throw new Error("FORBIDDEN");
    if (profile && profile.is_active) {
        const result = {
            userId: profile.id,
            role: profile.role,
            gender: profile.gender,
            grade: profile.grade,
            full_name: profile.full_name,
            is_active: profile.is_active,
        };
        return result;
    }
    // 2. Check admin_profiles table (Admins are stored in admin_profiles!)
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
        .from("admin_profiles")
        .select("id, full_name")
        .eq("id", authData.user.id)
        .maybeSingle();
    if (adminProfileError)
        throw adminProfileError;
    if (adminProfile) {
        const result = {
            userId: adminProfile.id,
            role: "admin",
            gender: "boy",
            grade: null,
            full_name: adminProfile.full_name || "מנהל מערכת (אדמין)",
            is_active: true,
        };
        return result;
    }
    throw new Error("FORBIDDEN");
}
//# sourceMappingURL=schoolIdentity.js.map