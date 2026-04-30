import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, MessageCircle, Search, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineKids, type PublicKidProfile } from "@/hooks/useOnlineKids";
import { useProfile } from "@/hooks/useProfile";
import { KidActionSheet } from "@/components/KidActionSheet";
import { KidAvatar } from "@/components/KidAvatar";
import { Button } from "@/components/ui/button";
import { desktopPanelClass } from "@/components/KidDesktopShell";
import { cn } from "@/lib/cn";

function KidRow({
  kid,
  sameGrade,
  onInvite
}: {
  kid: PublicKidProfile;
  sameGrade: boolean;
  onInvite: () => void;
}) {
  const navigate = useNavigate();
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <KidAvatar
        profile={kid}
        className="size-10 min-h-10 min-w-10 rounded-xl text-sm shadow-inner"
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black text-slate-900">
            {kid.full_name}
          </span>
          {sameGrade ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              הכיתה שלי
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">
          @{kid.username} · כיתה {kid.grade}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" type="button" onClick={onInvite} aria-label={`הזמן את ${kid.full_name}`}>
          <Gamepad2 className="size-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => navigate(`/inbox?kidId=${kid.id}`)}
          aria-label={`שלח הודעה אל ${kid.full_name}`}
        >
          <MessageCircle className="size-4" aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" type="button" asChild aria-label={`צפה בפרופיל ${kid.full_name}`}>
          <Link to={`/profile/${kid.id}`}>
            <UserRound className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function OnlineKids({ className }: { className?: string }) {
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { kids, loading } = useOnlineKids(true);
  const [selected, setSelected] = useState<PublicKidProfile | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kids
      .filter((kid) => {
        if (!q) return true;
        return (
          kid.full_name.toLowerCase().includes(q) ||
          kid.username.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aSame = a.grade === profile?.grade;
        const bSame = b.grade === profile?.grade;
        if (aSame !== bSame) return aSame ? -1 : 1;
        return a.full_name.localeCompare(b.full_name, "he");
      });
  }, [kids, profile?.grade, query]);

  const sameGrade = filtered.filter((kid) => kid.grade === profile?.grade);
  const otherKids = filtered.filter((kid) => kid.grade !== profile?.grade);

  return (
    <section className={desktopPanelClass(cn("flex min-h-0 flex-col p-4", className))}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-black text-slate-900">מחוברים</h2>
          <p className="text-xs font-semibold text-slate-500">
            {kids.length} ילדים זמינים
          </p>
        </div>
      </div>

      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          className="min-h-10 w-full rounded-xl border-2 border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש ילד…"
        />
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading && kids.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">טוען…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm font-medium text-slate-500">
            אין ילדים מתאימים כרגע.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                הכיתה שלי
              </h3>
              {sameGrade.length > 0 ? (
                <ul className="space-y-2">
                  {sameGrade.map((kid) => (
                    <KidRow
                      key={kid.id}
                      kid={kid}
                      sameGrade
                      onInvite={() => setSelected(kid)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-500">
                  אין כרגע מחוברים מהכיתה.
                </p>
              )}
            </div>

            {otherKids.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                  שאר המחוברים
                </h3>
                <ul className="space-y-2">
                  {otherKids.map((kid) => (
                    <KidRow
                      key={kid.id}
                      kid={kid}
                      sameGrade={false}
                      onInvite={() => setSelected(kid)}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <KidActionSheet kid={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
