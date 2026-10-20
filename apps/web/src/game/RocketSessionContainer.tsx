import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize, Minimize, MessageCircle, Pause, Play, Square, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { desktopPanelClass } from '@/components/KidDesktopShell';
import { GameVoicePanel } from '@/components/GameVoicePanel';
import { useRocketSession } from '@/hooks/useRocketSession';
import { SessionChatPanel } from '@/game/SessionChatPanel';
import { RocketRoomRoster } from '@/game/RocketRoomRoster';

const secondary = 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10';
const primary = 'border border-violet-400/50 bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400';
const danger = 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25';

export function RocketSessionContainer({ sessionId, backHref = '/home', backLabel = 'יציאה' }: {
  sessionId: string; backHref?: string; backLabel?: string;
}) {
  const game = useRocketSession(sessionId, backHref);
  const { view } = game;
  const [socialOpen, setSocialOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (view?.phase === 'ended') { setSocialOpen(false); setRosterOpen(false); }
  }, [view?.phase]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
      setFullscreenError(null);
    } catch { setFullscreenError('לא ניתן לפתוח מסך מלא בדפדפן הזה.'); }
  };
  const waiting = view?.phase === 'waiting';
  const ended = view?.phase === 'ended';
  const humans = view?.players.filter(player => player.kind === 'human').length ?? 0;
  const bots = view?.players.filter(player => player.kind === 'bot').length ?? 0;
  const active = humans + bots;
  return <div ref={root} className="flex h-[100dvh] flex-col gap-2 bg-slate-50 p-2 text-slate-900 dark:bg-slate-950 dark:text-white sm:p-3" dir="rtl">
    <header className={desktopPanelClass('flex flex-wrap items-center gap-2 px-3 py-2', { backdropBlur: false })}>
      <Button size="sm" className={secondary} asChild><Link to={backHref}>{backLabel}</Link></Button>
      <h1 className="ml-auto font-black">רוקט ארנה</h1>
      <span className="hidden items-center gap-2 text-sm lg:inline-flex"><Users size={16} />{humans + (view?.pendingPlayers.length ?? 0)}/8 שחקנים · {bots} בוטים</span>
      <Button size="sm" className={`${secondary} lg:hidden`} aria-label="הצגת שחקנים בחדר" aria-expanded={rosterOpen} onClick={() => setRosterOpen(value => !value)}><Users size={16} />{humans + (view?.pendingPlayers.length ?? 0)}/8 שחקנים · {bots} בוטים</Button>
      {document.fullscreenEnabled && <Button size="sm" className={secondary} onClick={() => void toggleFullscreen()}>
        {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
      </Button>}
      <Button size="sm" className={secondary} onClick={() => void game.copyInvite()}>{game.copied ? 'ההזמנה הועתקה' : 'הזמנת חברים'}</Button>
      <Button size="sm" className={secondary} aria-expanded={socialOpen} onClick={() => setSocialOpen(value => !value)}><MessageCircle size={16} />צ׳אט וקול</Button>
      {view?.canControl && !waiting && !ended && <>
        <Button size="sm" className={secondary} onClick={() => game.control(view.paused ? 'resume' : 'pause')}>
          {view.paused ? <Play size={16} /> : <Pause size={16} />}{view.paused ? 'המשך משחק' : 'השהיית משחק'}
        </Button>
        <Button size="sm" className={danger} onClick={() => game.control('end')}><Square size={14} />סיום משחק</Button>
      </>}
    </header>
    {(game.status || view?.pending || view?.paused || view?.observer || ended) && <p className="px-3 py-1 text-center text-sm font-bold text-slate-600 dark:text-white/70" role="status">
      {game.status || (ended ? 'המשחק הסתיים.' : view?.paused ? 'המשחק מושהה' : view?.pending ? 'ממתינים לבעיטת הפתיחה הבאה כדי להצטרף' : 'מצב צפייה')}
    </p>}
    {fullscreenError && <p role="alert" className="px-3 text-center text-sm text-amber-700 dark:text-amber-300">{fullscreenError}</p>}
    {!ended && view?.canControl && view.pendingPlayers.some(player => player.connected) && <div role="status" className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-2 text-sm text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200">
      <span>{view.pendingPlayers.filter(player => player.connected).length} מצטרפים ממתינים לבעיטת הפתיחה הבאה</span>
    </div>}
    {game.error && <div className="flex items-center justify-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" role="alert">
      <span>{game.error}</span><Button size="sm" className={secondary} onClick={game.retry}>ניסיון נוסף</Button>
    </div>}
    <div className="relative flex min-h-0 flex-1 gap-3 max-lg:flex-col">
      <main className="relative flex min-h-[240px] min-w-0 flex-1 overflow-hidden rounded-2xl bg-slate-950">
        {game.src && <iframe ref={game.frame} key={game.bridgeId} src={game.src} title="רוקט ארנה" className="h-full min-h-0 w-full flex-1 border-0"
          allow="autoplay; fullscreen" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-pointer-lock" />}
        {ended && <section className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto bg-slate-50/95 p-5 text-center dark:bg-slate-950/95" aria-label="סיום המשחק">
          <h2 className="text-2xl font-black">המשחק הסתיים</h2>
          <p aria-label="תוצאה" className="flex items-center justify-center gap-3 text-lg font-black"><span className="text-blue-600 dark:text-blue-300">כחולה</span><bdi>{view.score.blue} : {view.score.orange}</bdi><span className="text-orange-600 dark:text-orange-300">כתומה</span></p>
          {view.canRematch && !view.observer && !view.rematch && (view.selfUserId === view.hostUserId
            ? <Button className={primary} onClick={() => game.control('rematch')}>משחק חוזר</Button>
            : <p>ממתינים למארח שיציע משחק חוזר.</p>)}
          {view.canRematch && view.rematch && <>
            <p>{view.rematch.accepted.length} שחקנים רוצים לשחק שוב. ממתינים לתשובות שאר השחקנים.</p>
            {!view.observer && !view.rematch.accepted.includes(view.selfUserId) && !view.rematch.refused.includes(view.selfUserId) && <div className="flex flex-wrap justify-center gap-3">
              <Button className={primary} onClick={() => game.control('rematch-response', { accept: true })}>כן, משחק חוזר</Button>
              <Button className={secondary} onClick={() => game.control('rematch-response', { accept: false })}>לא הפעם</Button>
            </div>}
          </>}
          <Button className={secondary} asChild><Link to={backHref}>חזרה לבית</Link></Button>
        </section>}
        {waiting && <section className="absolute inset-0 overflow-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6" aria-label="חדר המתנה">
          <div className="mx-auto max-w-3xl space-y-5">
            <div><h2 className="text-xl font-black">חדר המתנה</h2><p className="mt-1 text-sm text-slate-500 dark:text-white/60">מזמינים חברים, בוחרים קבוצות ומתחילים כשמוכנים. אפשר גם להתאמן לבד.</p></div>
            {view.canControl ? <div className={desktopPanelClass('flex flex-wrap items-center gap-3 p-4', { backdropBlur: false })}>
              <label className="flex items-center gap-3 text-sm font-bold">מספר בוטים
                <select aria-label="מספר בוטים" value={bots} onChange={event => game.control('bots', { count: Number(event.target.value) })}
                  className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 dark:border-white/20 dark:bg-slate-900">
                  {Array.from({ length: 9 - humans }, (_, count) => <option key={count} value={count}>{count === 0 ? 'ללא בוטים' : count}</option>)}
                </select>
              </label>
              <Button className={primary} disabled={!humans} onClick={() => game.control('start')}><Play size={16} />התחלת משחק ({active} מכוניות)</Button>
              <Button className={secondary} onClick={() => game.control('end')}>סגירת החדר</Button>
            </div> : <p className="text-sm font-bold text-violet-700 dark:text-violet-300">ממתינים למארח שיבחר בוטים וקבוצות ויתחיל את המשחק.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {(['blue', 'orange'] as const).map(team => <div key={team} className={desktopPanelClass('space-y-3 p-4', { backdropBlur: false })}>
                <h3 className={`font-black ${team === 'blue' ? 'text-blue-600 dark:text-blue-300' : 'text-orange-600 dark:text-orange-300'}`}>{team === 'blue' ? 'קבוצה כחולה' : 'קבוצה כתומה'}</h3>
                <ul className="space-y-2">{view.players.filter(player => player.team === team).map(player => <li key={player.actorId} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                  <bdi className="min-w-0 flex-1 truncate">{player.kind === 'empty' ? 'מקום פנוי' : player.name}</bdi>
                  {player.actorId === view.actorId && <span className="text-xs text-violet-600 dark:text-violet-300">אני</span>}
                  {player.kind === 'human' && !player.connected && <span className="text-xs">מנותק</span>}
                  {view.canControl && player.kind !== 'empty' && <Button size="sm" className={secondary} aria-label={`העברת ${player.name} לקבוצה ${team === 'blue' ? 'כתומה' : 'כחולה'}`}
                    onClick={() => game.control('team', { actorId: player.actorId, team: team === 'blue' ? 'orange' : 'blue' })}>החלפת קבוצה</Button>}
                  {view.canModerate && player.userId && <Button size="sm" variant="destructive" className={danger} onClick={() => game.control('remove', { userId: player.userId })}>הסרה</Button>}
                </li>)}</ul>
              </div>)}
            </div>
          </div>
        </section>}
      </main>
      {view && <aside className={`${socialOpen || rosterOpen ? 'flex' : 'hidden lg:flex'} min-h-0 w-full shrink-0 flex-col gap-3 overflow-auto lg:w-72 max-lg:absolute max-lg:inset-0 max-lg:z-20 max-lg:rounded-2xl max-lg:bg-slate-50 max-lg:p-3 max-lg:dark:bg-slate-950`}>
        <Button size="sm" className={`${secondary} lg:hidden`} onClick={() => { setSocialOpen(false); setRosterOpen(false); }}>חזרה למשחק</Button>
        <RocketRoomRoster view={view} control={game.control} />
        {!ended && <GameVoicePanel sessionId={sessionId} requestToken={game.requestVoiceToken} manualJoin />}
        <SessionChatPanel sessionId={sessionId} observer={view.observer} canModerate={view.canModerate} ended={!!ended} send={game.sendChat} />
      </aside>}
    </div>
  </div>;
}
