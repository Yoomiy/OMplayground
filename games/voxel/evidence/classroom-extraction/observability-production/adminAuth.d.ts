import type { RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface AdminAuthOptions {
    supabaseAdmin: SupabaseClient | null;
}
export declare function requireAdmin(options: AdminAuthOptions): RequestHandler;
//# sourceMappingURL=adminAuth.d.ts.map