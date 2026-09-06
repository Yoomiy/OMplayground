import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { cn } from "@/lib/cn";
import { kidFieldInputClass } from "@/lib/fieldStyles";
import { formatClassroomActivity, formatClassroomFullDate } from "@/lib/classroomActivityTime";

type RecordRow = {
  id: string;
  title: string;
  subject: string | null;
  teacher_name: string;
  room_code: string;
  status: "active" | "ended";
  is_persistent: boolean;
  created_at: string;
  ended_at: string | null;
  last_activity: string;
  sessionCount: number;
  participantCount: number;
  livePresenceKnown: boolean;
  liveParticipantCount: number;
  liveHostConnected: boolean;
  liveCohostCount: number;
  cohosts: string[];
};
type Meeting = { id: string; started_at: string; ended_at: string | null; close_reason: string | null };
type Participant = {
  id: string;
  meeting_id: string;
  display_name: string;
  roles_held: string[];
  first_joined_at: string;
  connected_now: boolean;
  current_visit_started_at: string | null;
  total_seconds: number;
};
type Detail = {
  classroom: RecordRow;
  meetings: Meeting[];
  participants: Participant[];
  delegates: { display_name: string; is_active: boolean }[];
  snapshotAt: string;
  livePresenceKnown: boolean;
};

const PAGE_SIZE = 50;

function formatDate(value: string | null): string {
  return formatClassroomFullDate(value);
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return hours ? `${hours}ש׳ ${minutes}ד׳` : minutes ? `${minutes}ד׳ ${remainingSeconds}ש׳` : `${remainingSeconds}ש׳`;
}

function roleLabel(roles: string[]): string {
  if (roles.includes("host")) return "מארח";
  if (roles.includes("cohost")) return "מארח-שותף";
  return "משתתף";
}

export function ClassroomAdminExplorer() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("classStatus") as "all" | "active" | "ended" | null) ?? "all";
  const appliedSearch = params.get("classSearch") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("classPage") ?? "1", 10) || 1);
  const selectedId = params.get("classroom");
  const [search, setSearch] = useState(appliedSearch);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [openMeeting, setOpenMeeting] = useState<string | null>(null);

  useEffect(() => setSearch(appliedSearch), [appliedSearch]);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const session = (await supabase.auth.getSession()).data.session;
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        status,
        search: appliedSearch,
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });
      const response = await fetch(`${getVoxelServerUrl()}/rtc/admin/classroom-records?${query}`, { headers: await authHeaders() });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "טעינת רשומות הכיתות נכשלה.");
      setRecords(body.items ?? []);
      setTotal(body.total ?? 0);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "טעינת רשומות הכיתות נכשלה.");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, authHeaders, page, status]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`${getVoxelServerUrl()}/rtc/admin/classroom-records/${id}`, { headers: await authHeaders() });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "טעינת פרטי הכיתה נכשלה.");
      setDetail(body);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "טעינת פרטי הכיתה נכשלה.");
    } finally {
      setDetailLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
      if (selectedId) void loadDetail(selectedId);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [load, loadDetail, selectedId]);
  useEffect(() => {
    if (!detail) return;
    const activeMeeting = detail.meetings.find((meeting) => !meeting.ended_at);
    setOpenMeeting((current) => current && detail.meetings.some((meeting) => meeting.id === current)
      ? current
      : activeMeeting?.id ?? null);
  }, [detail]);

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      mutate(next);
      return next;
    });
  };
  const selectRecord = (id: string) => updateParams((next) => next.set("classroom", id));
  const closeDetail = () => updateParams((next) => next.delete("classroom"));
  const setStatus = (value: "all" | "active" | "ended") => updateParams((next) => {
    next.set("classStatus", value);
    next.set("classPage", "1");
    next.delete("classroom");
  });
  const applySearch = () => updateParams((next) => {
    if (search.trim()) next.set("classSearch", search.trim());
    else next.delete("classSearch");
    next.set("classPage", "1");
  });
  const setPage = (value: number) => updateParams((next) => {
    next.set("classPage", String(value));
    next.delete("classroom");
  });

  const endClassroom = async (roomCode: string) => {
    if (!window.confirm("לסגור את הכיתה כעת? הרשומה והיסטוריית הנוכחות יישמרו.")) return;
    const response = await fetch(`${getVoxelServerUrl()}/rtc/classroom-end`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ roomCode })
    });
    const body = await response.json().catch(() => ({}));
    setNotice(response.ok ? "הכיתה נסגרה; היסטורייתה נשמרה." : body.error || "סגירת הכיתה נכשלה.");
    if (response.ok) { await load(); if (selectedId) await loadDetail(selectedId); }
  };

  const removeRecord = async (id: string) => {
    if (!window.confirm("להסיר לצמיתות את רשומת הכיתה ואת היסטוריית הנוכחות שלה?")) return;
    const response = await fetch(`${getVoxelServerUrl()}/rtc/admin/classroom-records/${id}`, {
      method: "DELETE",
      headers: await authHeaders()
    });
    const body = await response.json().catch(() => ({}));
    setNotice(response.ok ? "רשומת הכיתה הוסרה לצמיתות." : body.error || "הסרת הרשומה נכשלה.");
    if (response.ok) { closeDetail(); await load(); }
  };

  const createClassroom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const roomCode = `class-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("classroom_sessions").insert({
      title: title.trim(),
      teacher_id: null,
      teacher_name: "מנהל מערכת (אדמין)",
      room_code: roomCode,
      status: "active",
      is_persistent: persistent
    });
    if (error) { setNotice(error.message); return; }
    navigate(`/classroom/${roomCode}`);
  };

  const togglePersistent = async (record: RecordRow) => {
    if (record.status !== "active") return;
    const { error } = await supabase
      .from("classroom_sessions")
      .update({ is_persistent: !record.is_persistent })
      .eq("id", record.id);
    if (error) setNotice(error.message);
    else void load();
  };

  const meetingParticipants = useMemo(() => {
    const groups = new Map<string, Participant[]>();
    for (const participant of detail?.participants ?? []) {
      groups.set(participant.meeting_id, [...(groups.get(participant.meeting_id) ?? []), participant]);
    }
    for (const people of groups.values()) {
      people.sort((a, b) => Number(b.connected_now) - Number(a.connected_now) || a.display_name.localeCompare(b.display_name, "he"));
    }
    return groups;
  }, [detail]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <section className="space-y-4" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">כיתות, מפגשים ונוכחות</h2>
        <p className="text-xs text-slate-500 dark:text-white/50">כל הכיתות נשמרות עד למחיקה מפורשת וממוינות לפי השימוש האחרון.</p>
      </div>
      <button onClick={() => setShowCreate(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 shadow-sm">+ צור כיתה חדשה</button>
    </div>

    {notice ? <div className="flex items-center justify-between rounded-xl border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm font-bold text-indigo-800 dark:text-indigo-100"><span>{notice}</span><button onClick={() => setNotice(null)} className="px-2 text-slate-400 hover:text-slate-700 dark:text-white/60 dark:hover:text-white" aria-label="סגור הודעה">×</button></div> : null}

    <div className="flex flex-wrap gap-2">
      <select value={status} onChange={(event) => setStatus(event.target.value as "all" | "active" | "ended")} className={cn(kidFieldInputClass, "min-h-9 rounded-lg border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 py-1.5 text-sm font-bold text-slate-900 dark:text-white shadow-sm")}>
        <option value="all">כל הכיתות</option>
        <option value="active">כיתות פעילות</option>
        <option value="ended">כיתות שנסגרו</option>
      </select>
      <form onSubmit={(event) => { event.preventDefault(); applySearch(); }} className="flex min-w-[16rem] flex-1 gap-2">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש שם, קוד או מארח…" className={cn(kidFieldInputClass, "min-h-9 flex-1 rounded-lg border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 py-1.5 text-sm text-slate-900 dark:text-white shadow-sm")} />
        <button className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-3 text-xs font-bold text-slate-700 dark:text-white shadow-sm">חפש</button>
      </form>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
      <table className="w-full text-right text-sm text-slate-700 dark:text-white/80">
        <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/10 text-slate-800 dark:text-white">
          <tr>
            <th className="p-3 whitespace-nowrap">כיתה</th>
            <th className="p-3 whitespace-nowrap">סטטוס</th>
            <th className="p-3 whitespace-nowrap">מארח / שותפים</th>
            <th className="p-3 whitespace-nowrap">שימוש אחרון</th>
            <th className="p-3 text-center whitespace-nowrap">מפגשים</th>
            <th className="p-3 text-center whitespace-nowrap">משתתפים</th>
            <th className="p-3 whitespace-nowrap">פעולות</th>
          </tr>
        </thead>
        <tbody>{records.map((record) => {
          const occupied = record.status === "active" && record.liveParticipantCount > 0;
          return <tr key={record.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
            <td className="p-3">
              <div className="flex flex-col items-start gap-0.5">
                <button
                  type="button"
                  onClick={() => selectRecord(record.id)}
                  className="text-right font-bold text-slate-900 dark:text-white underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
                >
                  {record.title}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300">{record.room_code}</span>
                  {record.is_persistent ? (
                    <span className="rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/25 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      קבועה
                    </span>
                  ) : null}
                </div>
              </div>
            </td>
            <td className="p-3 whitespace-nowrap">
              {record.status === "active" && !record.livePresenceKnown ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 dark:border-slate-500/30 bg-slate-100 dark:bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  סטטוס חי לא זמין
                </span>
              ) : occupied ? (
                <div>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    {record.liveParticipantCount} מחוברים
                  </span>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-white/50 whitespace-nowrap">
                    {record.liveHostConnected ? "המארח מחובר" : "המארח לא מחובר"}
                    {record.liveCohostCount ? ` · ${record.liveCohostCount} שותפים מחוברים` : ""}
                  </div>
                </div>
              ) : record.status === "active" ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                  פעילה (ריקה)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-2.5 py-0.5 text-xs text-slate-500 dark:text-white/50">
                  <span className="size-1.5 rounded-full bg-slate-400 dark:bg-white/30" />
                  נסגרה
                </span>
              )}
            </td>
            <td className="p-3">
              <div className="font-bold text-slate-900 dark:text-white/90">{record.teacher_name}</div>
              <div className="text-xs text-slate-500 dark:text-white/45 truncate max-w-[140px]" title={record.cohosts.length ? `שותפים: ${record.cohosts.join(", ")}` : undefined}>
                {record.cohosts.length ? `שותפים: ${record.cohosts.join(", ")}` : "ללא שותפים"}
              </div>
            </td>
            <td className="p-3 text-xs text-slate-600 dark:text-white/70 whitespace-nowrap">{formatClassroomActivity(record.last_activity)}</td>
            <td className="p-3 text-center font-bold text-slate-800 dark:text-white/90 whitespace-nowrap">{record.sessionCount}</td>
            <td className="p-3 text-center font-bold text-slate-800 dark:text-white/90 whitespace-nowrap">{record.participantCount}</td>
            <td className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => selectRecord(record.id)}
                  className="rounded-lg bg-indigo-100 dark:bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 whitespace-nowrap transition-colors shadow-sm"
                >
                  פרטים
                </button>
                {record.status === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/classroom/${record.room_code}?spectate=invisible`)}
                      title="הצטרף כצופה בלתי נראה"
                      className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-2 py-1 text-xs font-bold text-slate-700 dark:text-white whitespace-nowrap transition-colors shadow-sm"
                    >
                      צפה בסתר
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/classroom/${record.room_code}?spectate=visible`)}
                      title="הצטרף כצופה עם תג אדמין"
                      className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-2 py-1 text-xs font-bold text-slate-700 dark:text-white whitespace-nowrap transition-colors shadow-sm"
                    >
                      צפה בגלוי
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePersistent(record)}
                      title={record.is_persistent ? "כיתה קבועה — לחץ להחלפה לזמנית" : "כיתה זמנית — לחץ להחלפה לקבועה"}
                      className="rounded-lg border border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/25 whitespace-nowrap transition-colors shadow-sm"
                    >
                      {record.is_persistent ? "קבועה" : "זמנית"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void endClassroom(record.room_code)}
                      className="rounded-lg border border-rose-300 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-500/25 whitespace-nowrap transition-colors shadow-sm"
                    >
                      סגור כיתה
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void removeRecord(record.id)}
                    className="rounded-lg border border-rose-300 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-500/25 whitespace-nowrap transition-colors shadow-sm"
                  >
                    מחק רשומה
                  </button>
                )}
              </div>
            </td>
          </tr>;
        })}</tbody>
      </table>
      {!loading && records.length === 0 ? <p className="py-8 text-center text-sm font-bold text-slate-500 dark:text-white/50">לא נמצאו כיתות מתאימות.</p> : null}
      {loading ? <p className="py-8 text-center text-sm font-bold text-slate-500 dark:text-white/50">טוען כיתות…</p> : null}
    </div>

    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-white/60">
      <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} מתוך ${total}` : "אין תוצאות"}</span>
      <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 dark:bg-white/10 px-3 py-1.5 disabled:opacity-30">הקודם</button><button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 dark:bg-white/10 px-3 py-1.5 disabled:opacity-30">הבא</button></div>
    </div>

    {selectedId ? <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={closeDetail}>
      <aside className="h-full w-full overflow-y-auto border-r border-slate-200 dark:border-indigo-500/30 bg-white dark:bg-slate-950 p-5 shadow-2xl md:max-w-2xl text-slate-800 dark:text-slate-100" onClick={(event) => event.stopPropagation()} aria-label="פרטי כיתה">
        {detailLoading && !detail ? <p className="text-sm font-bold text-slate-500 dark:text-white/50">טוען פרטים…</p> : detail ? <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-slate-900 dark:text-white">{detail.classroom.title}</h3><p className="text-xs font-bold text-slate-500 dark:text-white/50">נוצרה: {formatDate(detail.classroom.created_at)}</p></div><button onClick={closeDetail} className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/15">סגור פרטים</button></div>
          <p className="text-xs text-slate-600 dark:text-white/60">מארח: {detail.classroom.teacher_name} · שותפים רשומים: {detail.delegates.filter((delegate) => delegate.is_active).map((delegate) => delegate.display_name).join(", ") || "ללא"}</p>
          {!detail.livePresenceKnown ? <p className="rounded-lg border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-2 text-xs font-bold text-amber-800 dark:text-amber-100">לא ניתן לאמת כרגע מי מחובר. ההיסטוריה עדיין זמינה.</p> : null}
          {detail.meetings.length ? detail.meetings.map((meeting) => {
            const people = meetingParticipants.get(meeting.id) ?? [];
            const expanded = openMeeting === meeting.id;
            const connectedCount = people.filter((person) => person.connected_now).length;
            return <div key={meeting.id} className={cn("rounded-xl border p-3 shadow-sm", !meeting.ended_at ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/[0.06]" : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]")}>
              <button onClick={() => setOpenMeeting(expanded ? null : meeting.id)} className="flex w-full items-center justify-between gap-3 text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">
                <span className="font-bold text-slate-900 dark:text-white">מפגש {formatClassroomActivity(meeting.started_at)}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-white/60">{people.length} משתתפים{connectedCount ? ` · ${connectedCount} מחוברים` : ""} · {meeting.ended_at ? `הסתיים ${formatClassroomActivity(meeting.ended_at)}` : "פעיל כעת"}</span>
              </button>
              {expanded ? <div className="mt-3 space-y-2 border-t border-slate-200 dark:border-white/10 pt-3"><p className="text-xs text-slate-500 dark:text-white/50">התחיל: {formatDate(meeting.started_at)}{meeting.ended_at ? ` · הסתיים: ${formatDate(meeting.ended_at)}` : " · עדיין פעיל"}</p>{people.map((person) => <div key={person.id} className={cn("rounded-lg p-2 text-sm", person.connected_now ? "border border-emerald-300 dark:border-emerald-500/25 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-900 dark:text-white" : "bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-white")}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{person.display_name} <span className="text-xs font-normal text-indigo-600 dark:text-indigo-200">{roleLabel(person.roles_held)}</span></span><div className="flex items-center gap-2">{person.connected_now ? <span className="rounded-full bg-emerald-200 dark:bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">● מחובר/ת</span> : <span className="text-xs text-slate-500 dark:text-white/40">לא מחובר/ת</span>}<span className="font-mono">{formatDuration(person.total_seconds)}</span></div></div>
              </div>)}{!people.length ? <p className="text-sm text-slate-500 dark:text-white/45">אין משתתפים במפגש זה.</p> : null}</div> : null}
            </div>;
          }) : <p className="text-sm font-bold text-slate-500 dark:text-white/50">אין עדיין מפגשים לכיתה זו.</p>}
        </div> : null}
      </aside>
    </div> : null}

    {showCreate ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={createClassroom} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-right shadow-2xl"><h3 className="font-black text-slate-900 dark:text-white">צור כיתה וירטואלית</h3><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="שם הכיתה" className={cn(kidFieldInputClass, "w-full rounded-xl border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white")} /><label className="flex gap-2 text-sm font-bold text-slate-700 dark:text-white"><input type="checkbox" checked={persistent} onChange={(event) => setPersistent(event.target.checked)} className="rounded accent-indigo-600" />כיתה קבועה</label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-200 dark:border-transparent bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-3 py-2 text-xs font-bold text-slate-700 dark:text-white">ביטול</button><button className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm">צור</button></div></form></div> : null}
  </section>;
}
