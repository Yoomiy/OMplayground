import { useState } from "react";
import { useOnlineKids, type PublicKidProfile } from "@/hooks/useOnlineKids";
import { KidActionSheet } from "@/components/KidActionSheet";
import { cn } from "@/lib/cn";

export function OnlineKids() {
  const { kids, loading } = useOnlineKids(true);
  const [selected, setSelected] = useState<PublicKidProfile | null>(null);

  return (
    <section
      className={cn(
        "rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play backdrop-blur-sm"
      )}
    >
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-lg font-bold text-slate-900">מי מחובר עכשיו</h2>
        <p className="mt-1 text-sm text-slate-600">
          לחץ על שם כדי להזמין למשחק או לדבר
        </p>
      </div>
      {loading && kids.length === 0 ? (
        <p className="text-sm text-slate-500">טוען…</p>
      ) : kids.length === 0 ? (
        <p className="text-sm text-slate-500">אף אחד מהחברים לא מחובר כרגע.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {kids.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => setSelected(k)}
                className="flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white py-2 pl-4 pr-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-300 hover:shadow-md active:scale-[0.98]"
              >
                <span
                  className="flex size-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-sm font-bold text-white shadow-inner"
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
