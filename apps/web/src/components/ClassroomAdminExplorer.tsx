import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { cn } from "@/lib/cn";
import { kidFieldInputClass } from "@/lib/fieldStyles";

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
  return value ? new Date(value).toLocaleString("he-IL") : "—";
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

  const authHeaders = useCallback(async () => {
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
        <h2 className="text-lg font-bold text-white">כיתות, מפגשים ונוכחות</h2>
        <p className="text-xs text-white/50">כל הכיתות נשמרות עד למחיקה מפורשת וממוינות לפי השימוש האחרון.</p>
      </div>
      <button onClick={() => setShowCreate(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500">+ צור כיתה חדשה</button>
    </div>

    {notice ? <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-100"><span>{notice}</span><button onClick={() => setNotice(null)} className="px-2 text-white/60" aria-label="סגור הודעה">×</button></div> : null}

    <div className="flex flex-wrap gap-2">
      <select value={status} onChange={(event) => setStatus(event.target.value as "all" | "active" | "ended")} className={cn(kidFieldInputClass, "min-h-9 rounded-lg border-white/10 bg-slate-900 py-1.5 text-sm text-white")}>
        <option value="all">כל הכיתות</option>
        <option value="active">כיתות פעילות</option>
        <option value="ended">כיתות שנסגרו</option>
      </select>
      <form onSubmit={(event) => { event.preventDefault(); applySearch(); }} className="flex min-w-[16rem] flex-1 gap-2">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש שם, קוד או מארח…" className={cn(kidFieldInputClass, "min-h-9 flex-1 rounded-lg border-white/10 bg-white/5 py-1.5 text-sm text-white")} />
        <button className="rounded-lg bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15">חפש</button>
      </form>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
      <table className="w-full min-w-[900px] text-right text-sm text-white/80">
        <thead className="bg-white/10 text-white"><tr><th className="p-3">כיתה</th><th className="p-3">סטטוס</th><th className="p-3">מארח / שותפים</th><th className="p-3">שימוש אחרון</th><th className="p-3">מפגשים</th><th className="p-3">משתתפים</th><th className="p-3">פעולות</th></tr></thead>
        <tbody>{records.map((record) => {
          const occupied = record.status === "active" && record.liveParticipantCount > 0;
          return <tr key={record.id} className="border-t border-white/5 hover:bg-white/[0.04]">
            <td className="p-3"><button onClick={() => selectRecord(record.id)} className="text-right font-bold text-white underline-offset-4 hover:text-indigo-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">{record.title}</button><div className="font-mono text-xs text-indigo-300">{record.room_code}</div></td>
            <td className="p-3">{record.status === "active" && !record.livePresenceKnown
              ? <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-300">סטטוס חי לא זמין</span>
              : occupied
              ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">{record.liveParticipantCount} מחוברים</span>
              : record.status === "active"
                ? <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">פעילה · ריקה</span>
                : <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/55">נסגרה</span>}
              {occupied ? <div className="mt-2 text-xs text-white/50">{record.liveHostConnected ? "המארח מחובר" : "המארח לא מחובר"}{record.liveCohostCount ? ` · ${record.liveCohostCount} שותפים מחוברים` : ""}</div> : null}
            </td>
            <td className="p-3"><div>{record.teacher_name}</div><div className="text-xs text-white/45">{record.cohosts.length ? `שותפים: ${record.cohosts.join(", ")}` : "ללא שותפים"}</div></td>
            <td className="p-3 text-xs">{formatDate(record.last_activity)}</td>
            <td className="p-3">{record.sessionCount}</td>
            <td className="p-3">{record.participantCount}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1.5">
              <button onClick={() => selectRecord(record.id)} className="rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-xs font-bold text-indigo-100 hover:bg-indigo-500/30">פרטים</button>
              {record.status === "active" ? <>
                <button onClick={() => navigate(`/classroom/${record.room_code}?spectate=invisible`)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/15">צפה בסתר</button>
                <button onClick={() => navigate(`/classroom/${record.room_code}?spectate=visible`)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/15">צפה בגלוי</button>
                <button onClick={() => void togglePersistent(record)} className="rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-500/25">{record.is_persistent ? "קבועה" : "זמנית"}</button>
                <button onClick={() => void endClassroom(record.room_code)} className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-100 hover:bg-rose-500/25">סגור כיתה</button>
              </> : <button onClick={() => void removeRecord(record.id)} className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-100 hover:bg-rose-500/25">מחק רשומה</button>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
      {!loading && records.length === 0 ? <p className="py-8 text-center text-sm text-white/50">לא נמצאו כיתות מתאימות.</p> : null}
      {loading ? <p className="py-8 text-center text-sm text-white/50">טוען כיתות…</p> : null}
    </div>

    <div className="flex items-center justify-between text-xs text-white/60">
      <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} מתוך ${total}` : "אין תוצאות"}</span>
      <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg bg-white/10 px-3 py-1.5 disabled:opacity-30">הקודם</button><button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg bg-white/10 px-3 py-1.5 disabled:opacity-30">הבא</button></div>
    </div>

    {selectedId ? <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={closeDetail}>
      <aside className="h-full w-full overflow-y-auto border-r border-indigo-500/30 bg-slate-950 p-5 shadow-2xl md:max-w-2xl" onClick={(event) => event.stopPropagation()} aria-label="פרטי כיתה">
        {detailLoading && !detail ? <p className="text-sm text-white/50">טוען פרטים…</p> : detail ? <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-white">{detail.classroom.title}</h3><p className="text-xs text-white/50">נוצרה: {formatDate(detail.classroom.created_at)}</p></div><button onClick={closeDetail} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/15">סגור פרטים</button></div>
          <p className="text-xs text-white/60">מארח: {detail.classroom.teacher_name} · שותפים רשומים: {detail.delegates.filter((delegate) => delegate.is_active).map((delegate) => delegate.display_name).join(", ") || "ללא"}</p>
          {!detail.livePresenceKnown ? <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">לא ניתן לאמת כרגע מי מחובר. ההיסטוריה עדיין זמינה.</p> : null}
          {detail.meetings.length ? detail.meetings.map((meeting) => {
            const people = meetingParticipants.get(meeting.id) ?? [];
            const expanded = openMeeting === meeting.id;
            const connectedCount = people.filter((person) => person.connected_now).length;
            return <div key={meeting.id} className={cn("rounded-xl border p-3", !meeting.ended_at ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03]")}>
              <button onClick={() => setOpenMeeting(expanded ? null : meeting.id)} className="flex w-full items-center justify-between gap-3 text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">
                <span className="font-bold text-white">מפגש {formatDate(meeting.started_at)}</span>
                <span className="text-xs text-white/60">{people.length} משתתפים{connectedCount ? ` · ${connectedCount} מחוברים` : ""} · {meeting.ended_at ? `הסתיים ${formatDate(meeting.ended_at)}` : "פעיל כעת"}</span>
              </button>
              {expanded ? <div className="mt-3 space-y-2 border-t border-white/10 pt-3">{people.map((person) => <div key={person.id} className={cn("rounded-lg p-2 text-sm", person.connected_now ? "border border-emerald-500/25 bg-emerald-500/10" : "bg-white/5")}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-white">{person.display_name} <span className="text-xs font-normal text-indigo-200">{roleLabel(person.roles_held)}</span></span><div className="flex items-center gap-2">{person.connected_now ? <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200">● מחובר/ת</span> : <span className="text-xs text-white/40">לא מחובר/ת</span>}<span className="font-mono text-white/80">{formatDuration(person.total_seconds)}</span></div></div>
              </div>)}{!people.length ? <p className="text-sm text-white/45">אין משתתפים במפגש זה.</p> : null}</div> : null}
            </div>;
          }) : <p className="text-sm text-white/50">אין עדיין מפגשים לכיתה זו.</p>}
        </div> : null}
      </aside>
    </div> : null}

    {showCreate ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={createClassroom} className="w-full max-w-md space-y-4 rounded-2xl bg-slate-900 p-6 text-right"><h3 className="font-black text-white">צור כיתה וירטואלית</h3><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="שם הכיתה" className={cn(kidFieldInputClass, "w-full rounded-xl border-white/10 bg-white/5 text-white")} /><label className="flex gap-2 text-sm text-white"><input type="checkbox" checked={persistent} onChange={(event) => setPersistent(event.target.checked)} />כיתה קבועה</label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white">ביטול</button><button className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">צור</button></div></form></div> : null}
  </section>;
}
