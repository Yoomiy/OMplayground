import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInbox } from "@/hooks/useInbox";
import { Button } from "@/components/ui/button";

export function InboxPage() {
  const { user } = useAuth();
  const { messages, loading } = useInbox(user?.id);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">הודעות</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      {loading ? (
        <p className="text-sm text-slate-400">טוען…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-slate-400">אין הודעות עדיין.</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
            >
              <span className="text-slate-400">
                {m.from_display_name}
                {m.to_kid_id === user?.id ? " ← אליך" : ""}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
