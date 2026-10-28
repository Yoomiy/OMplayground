import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { desktopPanelClass } from '@/components/KidDesktopShell';
import { useTeacherSessionChat } from '@/hooks/useTeacherSessionChat';

export function SessionChatPanel({ sessionId, observer, canModerate, ended, send }: {
  sessionId: string; observer: boolean; canModerate: boolean; ended: boolean; send: (message: string) => Promise<void>;
}) {
  const chat = useTeacherSessionChat(sessionId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = (error: unknown) => setError(error instanceof Error ? error.message : 'הפעולה נכשלה');
  const submit = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true); setError(null);
    try { await send(message); setDraft(''); await chat.reload(); }
    catch (error) { report(error); }
    finally { setSending(false); }
  };
  return <section className={desktopPanelClass('space-y-3 p-3 text-sm', { backdropBlur: false })} aria-label="צ׳אט במשחק">
    <div className="flex items-center justify-between gap-2"><h2 className="font-black">צ׳אט במשחק</h2>
      {canModerate && <Button variant="destructive" size="sm" className="dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20" onClick={() => {
        if (window.confirm('למחוק את כל ההודעות במפגש זה?')) void chat.clearSession().catch(report);
      }}>ניקוי צ׳אט</Button>}
    </div>
    {(error || chat.error) && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{error ?? chat.error}</p>}
    <ul className="max-h-56 space-y-2 overflow-auto break-words" aria-label="הודעות">
      {chat.lines.map(line => <li key={line.id} className="flex items-start gap-2 border-b border-slate-200 pb-1 dark:border-white/10">
        <span className="min-w-0 flex-1"><bdi className="font-bold">{line.sender_name}</bdi>: {line.message}</span>
        {canModerate && !line.is_system && <button type="button" className="text-xs text-rose-700 underline dark:text-rose-300" onClick={() => void chat.softDelete(line.id).catch(report)}>מחק</button>}
      </li>)}
      {!chat.lines.length && <li className="text-slate-500 dark:text-white/50">עדיין אין הודעות.</li>}
    </ul>
    {!observer && !ended && <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <input aria-label="הודעה לחדר" value={draft} maxLength={500} onChange={event => setDraft(event.target.value)} placeholder="כתבו הודעה…"
        className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
      <Button type="submit" size="sm" className="h-10 bg-gradient-to-r from-violet-500 to-indigo-500" disabled={sending || !draft.trim()}>שלח</Button>
    </form>}
  </section>;
}
