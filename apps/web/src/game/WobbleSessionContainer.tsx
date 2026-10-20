import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize, Minimize, MessageCircle, Pause, Play, Square, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { desktopPanelClass } from '@/components/KidDesktopShell';
import { GameVoicePanel } from '@/components/GameVoicePanel';
import { useTheme } from '@/context/ThemeContext';
import { kidFieldInputClass } from '@/lib/fieldStyles';
import { useWobbleSession } from '@/hooks/useWobbleSession';
import { RUNNER_COLORS, GRAPHICS_QUALITY_KEY, isGraphicsQuality, type GraphicsQuality } from '@/lib/wobbleProtocol';
import { SessionChatPanel } from './SessionChatPanel';
import { WobbleRematchControls } from './WobbleRematchControls';

const colorNames = ['אלמוג', 'תכלת', 'ירוק', 'צהוב', 'סגול', 'ורוד', 'טורקיז', 'כתום'];

const secondary = 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10';
const primary = 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400';
const danger = 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300';
const badge = 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-white/10 dark:text-white/70';
const time = (ms: number | null) => ms === null ? 'ללא סיום' : `${(ms / 1000).toFixed(2)} שנ׳`;

export function WobbleSessionContainer({ sessionId, backHref = '/home', backLabel = 'יציאה' }: {
  sessionId: string; backHref?: string; backLabel?: string;
}) {
  const game = useWobbleSession(sessionId, backHref);
  const { view } = game;
  const { theme } = useTheme();
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
    try { const value = localStorage.getItem(GRAPHICS_QUALITY_KEY); return isGraphicsQuality(value) ? value : 'balanced'; }
    catch { return 'balanced'; }
  });
  const [social, setSocial] = useState(false);
  const [roster, setRoster] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const post = game.post;
  useEffect(() => { post({ kind: 'theme', theme }); }, [post, theme, view?.selfUserId]);
  useEffect(() => { post({ kind: 'graphics-quality', quality: graphicsQuality }); }, [post, graphicsQuality, view?.selfUserId]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
      setFullscreenError(null);
    } catch { setFullscreenError('לא ניתן לפתוח מסך מלא בדפדפן הזה.'); }
  };
  const openPanel = (kind: 'social' | 'roster') => {
    post({ kind: 'release-input' });
    if (kind === 'social') setSocial(value => !value);
    else setRoster(value => !value);
  };
  const finish = view?.phase === 'finished';
  const lobby = view?.phase === 'lobby';
  const players = view?.players ?? [];
  const self = players.find(player => player.userId === view?.selfUserId);
  const participants = players.filter(player => !player.pending);
  const canStart = participants.length >= 2 && participants.every(player => player.connected && player.loaded);
  const courses = game.config?.courses ?? [];
  const currentCourse = courses.find(course => course.id === view?.courseId)?.name ?? '';
  const winner = view?.winnerText;
  const configure = (change: Partial<{ courseId: string; mode: 'race' | 'cup'; remix: boolean }>) => {
    if (view) game.control({ action: 'configure', courseId: view.courseId, mode: view.mode, remix: view.remix, ...change });
  };
  const overlay = !view || !!game.error || lobby || finish || view.paused || view.ended;
  return <div ref={root} className="flex h-[100dvh] flex-col gap-2 bg-slate-50 p-2 text-slate-900 dark:bg-slate-950 dark:text-white sm:p-3" dir="rtl">
    <header className={desktopPanelClass('flex flex-wrap items-center gap-2 px-3 py-2', { backdropBlur: false })}>
      <Button size="sm" className={secondary} asChild><Link to={backHref}>{backLabel}</Link></Button>
      <h1 className="ml-auto font-black" dir="ltr">Wobble Rush</h1>
      <Button size="sm" className={secondary} aria-expanded={roster} onClick={() => openPanel('roster')}><Users size={16} />שחקנים ({players.length}/8)</Button>
      <Button size="sm" className={secondary} onClick={() => void game.copyInvite()}>{game.copied ? 'ההזמנה הועתקה' : 'הזמנת חברים'}</Button>
      <Button size="sm" className={secondary} aria-expanded={social} onClick={() => openPanel('social')}><MessageCircle size={16} />צ׳אט וקול</Button>
      <label className="flex items-center gap-2 text-xs font-bold">איכות תצוגה<select aria-label="איכות תצוגה" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-slate-900" value={graphicsQuality} onChange={event => {
        if (!isGraphicsQuality(event.target.value)) return;
        setGraphicsQuality(event.target.value);
        try { localStorage.setItem(GRAPHICS_QUALITY_KEY, event.target.value); } catch { /* Keep the active choice if storage is restricted. */ }
      }}><option value="low">חסכונית</option><option value="balanced">מאוזנת</option><option value="high">גבוהה</option></select></label>
      {document.fullscreenEnabled && <Button size="sm" className={secondary} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}</Button>}
      {view?.canControl && !view.ended && <>
        {!lobby && !finish && <Button size="sm" className={secondary} disabled={view.paused && !canStart} onClick={() => game.control({ action: view.paused ? 'resume' : 'pause' })}>{view.paused ? <Play size={16} /> : <Pause size={16} />}{view.paused ? 'המשך משחק' : 'השהיה'}</Button>}
        <Button size="sm" className={danger} onClick={() => { if (window.confirm('לסיים את המפגש לכולם?')) game.control({ action: 'end' }); }}><Square size={16} />סיום</Button>
      </>}
    </header>
    {(fullscreenError || game.status) && <p className="px-3 text-sm text-slate-600 dark:text-white/70" role="status">{fullscreenError ?? game.status}</p>}
    <div className="relative flex min-h-0 flex-1 gap-3">
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black">
        {game.src && <iframe key={game.bridgeId} ref={game.frame} src={game.src} title="מרוץ Wobble Rush" className="h-full w-full border-0" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin" />}
        {view?.pending && !overlay && <p role="status" className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-center text-sm font-bold text-slate-900 shadow dark:bg-slate-900/95 dark:text-white">הצטרפת לחדר. אפשר לצפות כעת ולהתחרות {view.mode === 'cup' ? 'בגביע הבא' : 'במרוץ הבא'}.</p>}
        {overlay && <section className="absolute inset-0 overflow-y-auto bg-slate-50/95 p-4 dark:bg-slate-950/95 sm:p-6" aria-label="מצב המפגש">
          <div className="mx-auto max-w-2xl space-y-5">
            {game.error && <div role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><p>{game.error}</p><Button className={secondary} onClick={game.retry}>ניסיון נוסף</Button></div>}
            {!view && !game.error && !game.ended && <p role="status">טוענים את המשחק…</p>}
            {(game.ended || view?.ended) && <><h2 className="text-2xl font-black">המפגש הסתיים</h2><p>אפשר לחזור לבית ולפתוח משחק חדש.</p></>}
            {view?.paused && !view.ended && <>
              <h2 className="text-2xl font-black">המשחק מושהה</h2>
              <p role="status">{view.saved ? 'המשחק נשמר. אפשר לחזור אליו מהמשחקים השמורים בבית.' : 'השמירה עדיין לא אושרה. כדאי להמתין לפני היציאה.'}</p>
              {!canStart && <p>ממתינים לחזרת השחקנים ולטעינת המשחק.</p>}
              {view.canControl && <Button className={primary} disabled={!canStart} onClick={() => game.control({ action: 'resume' })}>המשך משחק</Button>}
            </>}
            {lobby && view && !view.paused && !view.ended && <>
              <h2 className="text-2xl font-black">חדר ההמתנה</h2>
              <p className="text-sm text-slate-600 dark:text-white/70">{view.canControl ? 'בוחרים מסלול ומתחילים כשהחברים כאן.' : 'ממתינים למארח שיתחיל את המרוץ.'}</p>
              {!view.observer && self && <fieldset className="space-y-2">
                <legend className="font-bold">הצבע שלי</legend>
                <div className="flex flex-wrap gap-2">{RUNNER_COLORS.map((color, index) => <button
                  key={color} type="button" aria-label={`צבע ${colorNames[index]}`} title={colorNames[index]}
                  aria-pressed={self.colorIndex === index}
                  className={`flex size-11 items-center justify-center rounded-full border-2 text-xl font-black text-slate-950 shadow-sm outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${self.colorIndex === index ? 'border-slate-950 ring-2 ring-violet-500 ring-offset-2 dark:border-white dark:ring-offset-slate-950' : 'border-slate-950/20 hover:scale-110'}`}
                  style={{ backgroundColor: color }} onClick={() => game.control({ action: 'color', colorIndex: index })}
                ><span aria-hidden="true">{self.colorIndex === index ? '✓' : ''}</span></button>)}</div>
              </fieldset>}
              {view.round === 0 ? <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2"><span className="block font-bold">סוג משחק</span><select className={kidFieldInputClass} disabled={!view.canControl} value={view.mode} onChange={event => configure({ mode: event.target.value as 'race' | 'cup' })}><option value="race">מרוץ יחיד</option><option value="cup">גביע של שלושה מרוצים</option></select></label>
                <label className="space-y-2"><span className="block font-bold">מסלול</span><select className={kidFieldInputClass} disabled={!view.canControl} value={view.courseId} onChange={event => configure({ courseId: event.target.value })}>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
                <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" disabled={!view.canControl} checked={view.remix} onChange={event => configure({ remix: event.target.checked })} />קצב מכשולים משתנה</label>
              </div> : <p>מרוץ <bdi>{view.round + 1}/3</bdi>: {currentCourse}</p>}
              {view.canControl && <Button className={primary} disabled={!canStart} onClick={() => game.control({ action: 'start' })}><Play size={16} />התחלת מרוץ</Button>}
              {!canStart && <p className="text-sm text-slate-600 dark:text-white/70">צריך לפחות שני שחקנים מחוברים שסיימו לטעון את המשחק.</p>}
              <ul className="space-y-2">{participants.map(player => <li key={player.userId} className="flex flex-wrap items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-slate-950/20" style={{ backgroundColor: RUNNER_COLORS[player.colorIndex] }} /><bdi className="font-bold">{player.name}</bdi> · {player.connected ? player.loaded ? 'מוכנים' : 'טוענים…' : 'ממתינים לחזרה'}</li>)}</ul>
            </>}
            {finish && view && !view.paused && !view.ended && <>
              <h2 className="text-2xl font-black">{view.complete ? view.mode === 'cup' ? 'הגביע הסתיים!' : 'המרוץ הסתיים!' : `מרוץ ${view.round + 1} הסתיים`}</h2>
              {winner && <p className="rounded-2xl bg-amber-100 p-4 text-xl font-black text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">🏆 {winner}</p>}
              <ol className="space-y-2">{view.results.map(row => <li key={row.id} className="flex gap-3 rounded-xl bg-white p-3 dark:bg-white/5"><span>{row.place}.</span><bdi className="min-w-0 flex-1 break-words">{row.name}</bdi><bdi>{time(row.timeMs)}</bdi></li>)}</ol>
              {view.mode === 'cup' && <><h3 className="font-black">{view.complete ? 'דירוג הגביע הסופי' : 'דירוג הגביע'}</h3><ol className="space-y-2">{view.standings.map((row, index) => <li key={row.id} className="flex gap-3"><span>{index + 1}.</span><bdi className="min-w-0 flex-1 break-words">{row.name}</bdi><span>{row.points} נק׳</span></li>)}</ol></>}
              {!view.saved && <p role="status">ממתינים לאישור שמירת התוצאות…</p>}
              {!view.complete && view.canControl && <Button className={primary} disabled={!view.saved} onClick={() => game.control({ action: 'next' })}>המרוץ הבא</Button>}
              {view.complete && !view.observer && <WobbleRematchControls view={view} error={game.error} control={game.control} />}
            </>}
          </div>
        </section>}
      </main>
      {view && (social || roster) && <aside className="absolute inset-0 z-20 flex flex-col gap-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950 lg:static lg:w-80 lg:shrink-0">
        <Button className={secondary} onClick={() => { setSocial(false); setRoster(false); game.frame.current?.focus(); }}>חזרה למשחק</Button>
        {roster && <section className={desktopPanelClass('space-y-3 p-3 text-sm', { backdropBlur: false })} aria-label="שחקנים בחדר">
          <h2 className="font-black">שחקנים בחדר</h2>
          <ul className="space-y-3">{players.map(player => <li key={player.userId} className="flex flex-wrap items-center gap-2">
            <bdi className="min-w-0 flex-1 break-words">{player.name}</bdi>
            {player.userId === view.selfUserId && <span className={badge}>אני</span>}
            {player.userId === view.hostUserId && <span className={badge}>מארח</span>}
            <span className={badge}>{!player.connected ? 'מקום שמור · מנותק' : player.pending ? `ממתינים ל${view.mode === 'cup' ? 'גביע' : 'מרוץ'} הבא` : player.loaded ? 'מחובר' : 'טוענים…'}</span>
            {view.canModerate && player.userId !== view.selfUserId && <Button size="sm" className={danger} onClick={() => game.control({ action: 'remove', userId: player.userId })}>הסרה</Button>}
          </li>)}</ul>
          {view.observers.length > 0 && <><h3 className="font-bold">צופים</h3><ul>{view.observers.map(observer => <li key={observer.userId}><bdi>{observer.name}</bdi> · {observer.role === 'admin' ? 'מנהל' : 'מורה'}</li>)}</ul></>}
          {players.some(player => player.pending) && <p role="status">מצטרפים חדשים ייכנסו אוטומטית למשחק הבא לאחר הסכמה למשחק נוסף.</p>}
        </section>}
        {social && <>
          {!view.ended && !view.observer && <GameVoicePanel sessionId={sessionId} requestToken={game.requestVoiceToken} manualJoin />}
          <SessionChatPanel sessionId={sessionId} observer={view.observer} canModerate={view.canModerate} ended={view.ended} send={game.sendChat} />
        </>}
      </aside>}
    </div>
  </div>;
}
