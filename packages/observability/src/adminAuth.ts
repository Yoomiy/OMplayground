import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminAuthOptions {
  supabaseAdmin: SupabaseClient | null;
}

export function requireAdmin(
  options: AdminAuthOptions
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!options.supabaseAdmin) {
      res.status(503).json({ error: "server_config" });
      return;
    }
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { data: authData, error: authErr } =
      await options.supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { data: adminRow, error: adminErr } = await options.supabaseAdmin
      .from("admin_profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (adminErr || !adminRow) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    (req as Request & { adminUserId: string }).adminUserId = authData.user.id;
    next();
  };
}
