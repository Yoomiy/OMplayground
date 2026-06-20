import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, MessageCircle, Search, UserRound } from "lucide-react";
import { useOnlineKids, type PublicKidProfile } from "@/hooks/useOnlineKids";
import { useProfile } from "@/hooks/useProfile";
import { KidActionSheet } from "@/components/KidActionSheet";
import { KidAvatar } from "@/components/KidAvatar";
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
  const buttonStyleBase =
    "rounded-2xl size-11 flex items-center justify-center border transition-all hover:scale-105 active:scale-95 font-bold text-sm shrink-0";

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 transition hover:-translate-y-0.5 hover:bg-white/10 hover:border-white/20">
      <KidAvatar
        profile={kid}
        className="size-10 min-h-10 min-w-10 rounded-xl text-sm shadow-inner border border-white/10"
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-black text-white leading-none">
            {kid.full_name}
          </span>
          {sameGrade ? (
            <span className="shrink-0 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-black text-emerald-400 leading-none border border-emerald-500/25">
              הכיתה שלי
            </span>
          ) : null}
        </div>
        <p className="truncate text-[10px] font-black text-white/40 mt-1">
          @{kid.username} · כיתה {kid.grade}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onInvite}
          className={cn(
            buttonStyleBase,
            "bg-emerald-500/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 hover:shadow-[0_0_12px_rgba(52,211,153,0.4)]"
          )}
          aria-label={`הזמן את ${kid.full_name}`}
          title="להזמין למשחק"
        >
          <Gamepad2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/inbox?kidId=${kid.id}`)}
          className={cn(
            buttonStyleBase,
            "bg-sky-500/10 border-sky-400/30 text-sky-400 hover:bg-sky-500 hover:text-white hover:border-sky-400 hover:shadow-[0_0_12px_rgba(56,189,248,0.4)]"
          )}
          aria-label={`שלח הודעה אל ${kid.full_name}`}
          title="לשלוח הודעה"
        >
          <MessageCircle className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/profile/${kid.id}`)}
          className={cn(
            buttonStyleBase,
            "bg-white/10 border-white/10 text-white/50 hover:bg-white/20 hover:text-white hover:border-white/30"
          )}
          aria-label={`צפה בפרופיל ${kid.full_name}`}
          title="לצפות בפרופיל"
        >
          <UserRound className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function OnlineKids({ className }: { className?: string }) {
  const { profile } = useProfile();
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
    <section
      className={cn(
        "rounded-3xl border border-emerald-400/25 bg-emerald-500/5 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md flex min-h-0 flex-1 flex-col",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
            </span>
            חברים מחוברים
          </h2>
          <p className="text-xs font-bold text-white/50 mt-0.5">
            {kids.length} חברים זמינים עכשיו
          </p>
        </div>
      </div>

      <label className="relative mb-4 block">
        <Search
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40"
          aria-hidden
        />
        <input
          className="min-h-11 w-full rounded-2xl border border-white/10 bg-white/10 py-2 pl-3 pr-10 text-xs font-bold text-white outline-none transition placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חפשו חבר..."
        />
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
        {loading && kids.length === 0 ? (
          <p className="text-xs font-bold text-white/50 py-4 text-center">טוען חברים…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-3 py-6 text-center">
            <span className="text-3xl block mb-2">👀</span>
            <p className="text-xs font-bold text-white/40">
              לא מצאנו אף חבר מחובר כרגע.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                <span>🏫</span> הכיתה שלי
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
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-center">
                  <p className="text-xs font-bold text-white/30">
                    אין כרגע חברים מהכיתה שלך.
                  </p>
                </div>
              )}
            </div>

            {otherKids.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                  <span>🌍</span> שאר המחוברים
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
