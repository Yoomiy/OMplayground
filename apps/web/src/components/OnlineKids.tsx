import { useState } from "react";
import { useOnlineKids, type PublicKidProfile } from "@/hooks/useOnlineKids";
import { KidActionSheet } from "@/components/KidActionSheet";

export function OnlineKids() {
  const { kids, loading } = useOnlineKids(true);
  const [selected, setSelected] = useState<PublicKidProfile | null>(null);

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">מחוברים עכשיו</h2>
      {loading && kids.length === 0 ? (
        <p className="text-sm text-slate-400">טוען…</p>
      ) : kids.length === 0 ? (
        <p className="text-sm text-slate-400">אף אחד לא מחובר כרגע.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {kids.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => setSelected(k)}
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 py-1 pl-3 pr-2 text-sm hover:border-indigo-500"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: k.avatar_color }}
                >
                  {k.full_name.slice(0, 1)}
                </span>
                <span>{k.full_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <KidActionSheet kid={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
