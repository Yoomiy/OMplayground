import { useInbox } from "@/hooks/useInbox";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useOnlinePresence } from "@/hooks/usePresence";
import { useAuth } from "@/hooks/useAuth";
import { respondChallenge, type GameChallengeRow } from "@/lib/challengeApi";

type Invitation = GameChallengeRow & { partner_role: string; partner_name: string; game_name: string; partner_busy: boolean; self_busy: boolean; can_cancel: boolean };
export function PendingChallengeBanner() {
  const { user } = useAuth();
  const { select: openMessage } = useInbox();
  const { isOnline } = useOnlinePresence();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Invitation[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const navigating = useRef(false);
  useEffect(() => { if (!location.pathname.startsWith("/play/")) navigating.current = false; }, [location.pathname]);
  const route = useRef(location.pathname);
  route.current = location.pathname;
  const enter = useCallback((sessionId: string) => {
    // Editing and game routes require explicit navigation.
    if (!navigating.current && (['/home', '/teacher', '/inbox', '/friends'].includes(route.current) || route.current.startsWith('/profile/'))) {
      navigating.current = true;
      navigate(`/play/${sessionId}?mode=player`);
    }
  }, [navigate]);
  useEffect(() => {
    const epoch = ++generation.current;
    setRows([]); setErrors({}); setBusy({}); seen.current.clear();
    if (!user) return;
    let fetching = false;
    const refresh = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const { data, error } = await supabase.rpc('list_game_challenges');
        if (generation.current !== epoch) return;
        if (error) { setErrors(previous => ({ ...previous, refresh: 'לא ניתן לרענן הזמנות' })); return; }
        const next = data as Invitation[];
        const first = seen.current.has('__loaded');
        let automaticEntry: string | undefined;
        for (const row of [...next].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
          if (first && row.status === 'accepted' && row.from_kid_id === user.id && !row.self_busy && !seen.current.has(row.id + ':accepted')) automaticEntry ??= row.session_id;
          seen.current.add(row.id + ':' + row.status);
        }
        seen.current.add('__loaded');
        if (automaticEntry) enter(automaticEntry);
        setRows(next);
        setErrors(previous => { const { refresh: _, ...rest } = previous; return rest; });
      } finally { fetching = false; }
    };
    void refresh();
    const channel = supabase.channel(`invitations:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'game_challenges' }, () => void refresh()).subscribe();
    const timer = window.setInterval(() => void refresh(), 5000);
    const onRefresh = () => void refresh();
    window.addEventListener('challenges-changed', onRefresh);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('online', onRefresh);
    return () => { ++generation.current; clearInterval(timer); window.removeEventListener('challenges-changed', onRefresh); window.removeEventListener('focus', onRefresh); window.removeEventListener('online', onRefresh); void supabase.removeChannel(channel); };
  }, [user?.id, enter]);
  async function act(row: Invitation, action: 'accept' | 'decline' | 'cancel') {
    const epoch = generation.current;
    setBusy(previous => ({ ...previous, [row.id]: true }));
    try {
      await respondChallenge(row.id, action);
      if (epoch !== generation.current) return;
      setErrors(previous => ({ ...previous, [row.id]: '' }));
      window.dispatchEvent(new Event('challenges-changed'));
      if (action === 'accept' && !row.self_busy) enter(row.session_id);
    } catch (error) {
      if (epoch === generation.current) setErrors(previous => ({ ...previous, [row.id]: error instanceof Error ? error.message : 'הפעולה נכשלה' }));
    } finally { if (epoch === generation.current) setBusy(previous => ({ ...previous, [row.id]: false })); }
  }
  if (!user || (!rows.length && !errors.refresh)) return null;
  return <section className="sticky top-0 z-30 border-b border-amber-300 bg-amber-50 p-3 text-slate-900" aria-label="הזמנות למשחק">
    <button onClick={() => setOpen(!open)} aria-expanded={open}>🎮 הזמנות למשחק ({rows.length})</button>
    {errors.refresh && <p role="alert">{errors.refresh}</p>}
    {open && <div className="max-h-80 overflow-auto">{rows.map(row => <article key={row.id} className="my-2 rounded-lg border p-3">
      <p>{row.partner_name} · {row.game_name} · {row.status === 'accepted' ? 'מוכן לכניסה' : row.to_kid_id === user.id ? 'הזמנה חדשה' : 'ממתינים לתשובה'} · {Math.max(0, Math.ceil((Date.parse(row.expires_at) - Date.now()) / 1000))} שניות</p>
      {row.self_busy && <p>אפשר להיכנס אחרי היציאה מהמשחק הנוכחי</p>}
      {row.status === 'accepted' && <p>{row.partner_busy ? 'השחקן השני במשחק אחר' : row.partner_role === 'kid' && !isOnline(row.from_kid_id === user.id ? row.to_kid_id : row.from_kid_id) ? 'השחקן השני אינו מחובר כרגע' : 'השחקן השני עדיין לא נכנס'}</p>}
      <div className="flex flex-wrap gap-4">
        {row.status === 'pending' && row.to_kid_id === user.id && <><button disabled={busy[row.id]} onClick={() => void act(row, 'accept')}>קבלה וכניסה</button><button disabled={busy[row.id]} onClick={() => void act(row, 'decline')}>לא הפעם</button></>}
        {row.status === 'accepted' && !row.self_busy && <Link to={`/play/${row.session_id}?mode=player`}>כניסה למשחק</Link>}
        {row.from_kid_id === user.id && row.can_cancel && <button disabled={busy[row.id]} onClick={() => void act(row, 'cancel')}>ביטול</button>}
        <button onClick={() => openMessage(row.from_kid_id === user.id ? row.to_kid_id : row.from_kid_id)}>שליחת הודעה</button>
      </div>{errors[row.id] && <p role="alert">{errors[row.id]}</p>}
    </article>)}</div>}
  </section>;
}
