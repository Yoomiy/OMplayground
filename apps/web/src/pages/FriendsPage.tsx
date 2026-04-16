import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";
import { Button } from "@/components/ui/button";

export function FriendsPage() {
  const { user } = useAuth();
  const { rows, loading } = useFriendships(user?.id);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">חברים</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      {loading ? (
        <p className="text-sm text-slate-400">טוען…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          אין חיבורים עדיין — שליחת בקשות חברות תתווסף בהמשך דרך הודעות פרטיות
          (RLS מוכן).
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            >
              {r.status} · {r.requester_id.slice(0, 8)}… ↔{" "}
              {r.addressee_id.slice(0, 8)}…
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
