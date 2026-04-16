import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Admin CRUD is intended to use Supabase + RLS or a service-role backend only.
 * This route is a shell placeholder per Phase 4 milestones.
 */
export function AdminPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ניהול</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      <p className="text-sm text-slate-400">
        ממשקי משחקים, ילדים, לוחות זמנים ודיווחים — מול Supabase עם מדיניות RLS;
        מפתח שירות לא נטען בדפדפן.
      </p>
    </div>
  );
}
