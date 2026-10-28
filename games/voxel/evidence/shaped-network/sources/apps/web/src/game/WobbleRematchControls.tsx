import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WobbleControl, WobbleView } from '@/lib/wobbleProtocol';

type RematchAction = 'rematch' | 'accept-rematch' | 'decline-rematch';
const primary = 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400';
const secondary = 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10';

export function WobbleRematchControls({ view, error, control }: {
  view: Pick<WobbleView, 'selfUserId' | 'saved' | 'players' | 'rematch'>; error: string | null; control: (command: WobbleControl) => void;
}) {
  const [pending, setPending] = useState<RematchAction | null>(null);
  const pendingRef = useRef<RematchAction | null>(null);
  const [delayed, setDelayed] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const accepted = view.rematch?.accepted.includes(view.selfUserId) ?? false;
  const declined = view.rematch?.refused.includes(view.selfUserId) ?? false;
  const confirmed = pending === 'decline-rematch' ? declined : accepted;
  useEffect(() => {
    if (!pending) return;
    if (confirmed || error || (pending !== 'rematch' && !view.rematch)) {
      pendingRef.current = null;
      setPending(null);
      if (!confirmed && !error) setInsufficient(true);
      return;
    }
    const timeout = setTimeout(() => { pendingRef.current = null; setPending(null); setDelayed(true); }, 8000);
    return () => clearTimeout(timeout);
  }, [pending, confirmed, error, !!view.rematch]);
  useEffect(() => { if (accepted || declined) setDelayed(false); }, [accepted, declined]);
  const send = (action: RematchAction) => {
    if (pendingRef.current || error || !view.saved) return;
    pendingRef.current = action;
    setDelayed(false);
    setInsufficient(false);
    setPending(action);
    control({ action });
  };
  const waiting = view.players.filter(player => player.connected
    && !view.rematch?.accepted.includes(player.userId)
    && !view.rematch?.refused.includes(player.userId)).length;
  const enoughPlayers = view.players.filter(player => player.connected).length >= 2;
  const busy = pending !== null;
  const disabled = busy || !view.saved || !!error || !enoughPlayers;
  return <div className="space-y-3">
    {busy ? <p role="status" className="flex items-center gap-2 text-sm font-bold">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {pending === 'decline-rematch' ? 'מעדכנים את הבחירה…' : 'מצטרפים למשחק נוסף…'}
    </p> : accepted ? <p role="status" className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
      <Check size={18} aria-hidden="true" />בחרת לשחק שוב!
    </p> : declined ? <p role="status">בחרת לא להצטרף למשחק נוסף.</p> : null}
    {view.rematch && <p className="text-sm text-slate-600 dark:text-white/70" role="status">
      {view.rematch.accepted.length === 1 ? 'שחקן אחד רוצה לשחק שוב.' : `${view.rematch.accepted.length} שחקנים רוצים לשחק שוב.`} {waiting === 1 ? 'ממתינים לתשובה נוספת.' : waiting > 1 ? `ממתינים לעוד ${waiting} תשובות.` : 'צריך לפחות שני שחקנים כדי להתחיל.'}
    </p>}
    {!enoughPlayers && <p role="status" className="text-sm">ממתינים לעוד שחקן כדי לשחק שוב.</p>}
    {insufficient && <p role="status" className="text-sm">לא היו מספיק משתתפים למשחק נוסף.</p>}
    {delayed && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">האישור מתעכב. אפשר לנסות שוב.</p>}
    <div className="flex flex-wrap gap-2" aria-busy={busy}>
      {!view.rematch ? <Button className={primary} disabled={disabled} onClick={() => send('rematch')}>
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{busy ? 'מצטרפים…' : 'משחק נוסף'}
      </Button> : <>
        {!accepted && <Button className={primary} disabled={disabled} onClick={() => send('accept-rematch')}>{declined ? 'בכל זאת רוצה לשחק' : 'אני רוצה לשחק'}</Button>}
        {!declined && <Button className={secondary} disabled={disabled} onClick={() => send('decline-rematch')}>לא הפעם</Button>}
      </>}
    </div>
  </div>;
}
