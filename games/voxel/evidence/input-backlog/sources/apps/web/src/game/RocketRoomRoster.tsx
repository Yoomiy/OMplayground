import { desktopPanelClass } from '@/components/KidDesktopShell';
import { Button } from '@/components/ui/button';
import type { RocketView } from '@/lib/rocketProtocol';

export function RocketRoomRoster({ view, control }: {
  view: RocketView; control: (action: string, fields?: Record<string, unknown>) => void;
}) {
  const badge = 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-white/70';
  const self = (userId: string | null) => userId === view.selfUserId;
  const remove = (userId: string) => view.phase !== 'ended' && view.canModerate && <Button size="sm"
    className="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300"
    onClick={() => control('remove', { userId })}>הסרה</Button>;
  return <section className={desktopPanelClass('space-y-3 p-3 text-sm', { backdropBlur: false })} aria-label="שחקנים בחדר">
    <h2 className="font-black">שחקנים בחדר</h2>
    <ul className="space-y-2">{view.players.filter(player => player.kind !== 'empty').map(player => <li key={player.actorId} className="flex flex-wrap items-center gap-2">
      <span aria-label={player.team === 'blue' ? 'קבוצה כחולה' : 'קבוצה כתומה'} className={player.team === 'blue' ? 'text-blue-500' : 'text-orange-500'}>●</span>
      <bdi className="min-w-0 flex-1 break-words">{player.name}</bdi>
      {self(player.userId) && <span className={badge}>אני</span>}
      {player.userId === view.hostUserId && <span className={badge}>מארח</span>}
      {player.kind === 'bot' ? <span className={badge}>בוט</span> : <span className={badge}>{player.connected ? 'מחובר' : 'מנותק'}</span>}
      {player.userId && remove(player.userId)}
    </li>)}</ul>
    {view.pendingPlayers.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
      <h3 className="font-bold">ממתינים לבעיטת הפתיחה</h3>
      {view.canControl && <p className="text-xs text-slate-500 dark:text-white/60">אפשר לבחור מקום פנוי או להחליף בוט. השינוי ייכנס לתוקף בבעיטת הפתיחה הבאה.</p>}
      <ul className="space-y-3">{view.pendingPlayers.map(player => <li key={player.userId} className="space-y-2">
        <div className="flex items-center gap-2"><bdi className="min-w-0 flex-1 break-words">{player.name}</bdi>
          {self(player.userId) && <span className={badge}>אני</span>}
          {!player.connected && <span className={badge}>מנותק</span>}{remove(player.userId)}</div>
        {view.canControl ? <select aria-label={`שיבוץ ${player.name}`} value={player.actorId ?? ''}
          className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-white/20 dark:bg-slate-900"
          onChange={event => control('assign-pending', { userId: player.userId, actorId: event.target.value || null })}>
          <option value="">שיבוץ אוטומטי</option>
          {view.players.filter(slot => slot.kind !== 'human').map(slot => <option key={slot.actorId} value={slot.actorId}
            disabled={view.pendingPlayers.some(other => other.userId !== player.userId && other.actorId === slot.actorId)}>
            {slot.team === 'blue' ? 'כחולה' : 'כתומה'} · {slot.kind === 'bot' ? `במקום ${slot.name}` : `מקום פנוי ${Number(slot.actorId.slice(-1)) + 1}`}
          </option>)}
        </select> : <p className="text-xs text-slate-500 dark:text-white/60">{player.actorId
          ? `מיועד לקבוצה ${view.players.find(slot => slot.actorId === player.actorId)?.team === 'blue' ? 'הכחולה' : 'הכתומה'}` : 'ישובץ בבעיטת הפתיחה הבאה'}</p>}
      </li>)}</ul>
    </div>}
    {view.observers.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
      <h3 className="font-bold">צופים בחדר</h3>
      <ul className="space-y-2">{view.observers.map(observer => <li key={observer.userId} className="flex items-center gap-2">
        <bdi className="min-w-0 flex-1 break-words">{observer.name}</bdi>
        {self(observer.userId) && <span className={badge}>אני</span>}
        <span className={badge}>{observer.role === 'admin' ? 'מנהל' : 'מורה'}</span>
      </li>)}</ul>
    </div>}
  </section>;
}
