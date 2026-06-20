import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Report {
  id: string;
  reporter_id: string;
  user_message: string;
  category: "bug" | "suggestion" | "other";
  browser_info: any;
  hardware_info: any;
  console_logs: Array<{ level: string; msg: string; time: string; count: number }>;
  screenshot_url: string | null;
  canvas_screenshot_url: string | null;
  status: "pending" | "resolved";
  created_at: string;
  reporter?: {
    username: string;
    full_name: string;
    role: string;
  };
}

export function AdminFeedbackSection() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("pending");
  const [filterCategory, setFilterCategory] = useState<"all" | "bug" | "suggestion" | "other">("all");
  const [loading, setLoading] = useState(true);
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);
  const [signedScreenshot, setSignedScreenshot] = useState<string | null>(null);
  const [signedCanvasScreenshot, setSignedCanvasScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (selectedReport) {
      void loadSignedUrls(selectedReport);
    } else {
      setSignedScreenshot(null);
      setSignedCanvasScreenshot(null);
    }
  }, [selectedReport]);

  const loadSignedUrls = async (report: Report) => {
    setSignedScreenshot(null);
    setSignedCanvasScreenshot(null);

    if (report.screenshot_url) {
      if (report.screenshot_url.startsWith("http")) {
        setSignedScreenshot(report.screenshot_url);
      } else {
        const { data, error } = await supabase.storage
          .from("feedback-screenshots")
          .createSignedUrl(report.screenshot_url, 3600); // 1 hour
        if (!error && data) {
          setSignedScreenshot(data.signedUrl);
        }
      }
    }

    if (report.canvas_screenshot_url) {
      if (report.canvas_screenshot_url.startsWith("http")) {
        setSignedCanvasScreenshot(report.canvas_screenshot_url);
      } else {
        const { data, error } = await supabase.storage
          .from("feedback-screenshots")
          .createSignedUrl(report.canvas_screenshot_url, 3600); // 1 hour
        if (!error && data) {
          setSignedCanvasScreenshot(data.signedUrl);
        }
      }
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus, filterCategory]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("feedback_reports")
        .select(`
          *,
          reporter:kid_profiles!reporter_id (
            username,
            full_name,
            role
          )
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      if (filterCategory !== "all") {
        query = query.eq("category", filterCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
      
      // Auto-select the first report if none is selected
      if (data && data.length > 0) {
        setSelectedReport(data[0]);
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (report: Report) => {
    const nextStatus = report.status === "pending" ? "resolved" : "pending";
    try {
      const { error } = await supabase
        .from("feedback_reports")
        .update({ status: nextStatus })
        .eq("id", report.id);

      if (error) throw error;

      // Update local state
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: nextStatus } : r))
      );
      if (selectedReport?.id === report.id) {
        setSelectedReport((prev) => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Helper to render Category Badges
  const renderCategory = (cat: string) => {
    const styles = {
      bug: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      suggestion: "bg-sky-500/20 text-sky-300 border-sky-500/30",
      other: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
    const labels = { bug: "באג 🐛", suggestion: "הצעה 💡", other: "אחר 💬" };
    const key = cat as keyof typeof styles;
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[key] || ""}`}>
        {labels[key] || cat}
      </span>
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)] text-white" dir="rtl">
      {/* Master View: List Panel (Right) */}
      <div className="w-80 flex flex-col bg-[#150d32]/95 border border-white/10 rounded-2xl overflow-hidden shrink-0">
        {/* Filters */}
        <div className="p-4 border-b border-white/10 space-y-3 bg-[#0d0724]">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("pending")}
              className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-bold transition-all border ${
                filterStatus === "pending"
                  ? "bg-violet-600 border-violet-400 text-white shadow-lg"
                  : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              ממתין
            </button>
            <button
              onClick={() => setFilterStatus("resolved")}
              className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-bold transition-all border ${
                filterStatus === "resolved"
                  ? "bg-emerald-600 border-emerald-400 text-white shadow-lg"
                  : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              טופל
            </button>
            <button
              onClick={() => setFilterStatus("all")}
              className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-bold transition-all border ${
                filterStatus === "all"
                  ? "bg-white/20 border-white/10 text-white"
                  : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              הכל
            </button>
          </div>

          <select
            value={filterCategory}
            onChange={(e: any) => setFilterCategory(e.target.value)}
            className="w-full text-xs rounded-xl border border-white/10 p-2 bg-[#1b1240] text-white focus:outline-none focus:border-violet-500"
          >
            <option value="all">כל הקטגוריות</option>
            <option value="bug">באגים 🐛</option>
            <option value="suggestion">הצעות 💡</option>
            <option value="other">אחר 💬</option>
          </select>
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-white/40 text-xs">טוען דיווחים...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-xs">אין דיווחים להצגה</div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className={`w-full text-right p-3 rounded-xl border transition-all duration-200 block ${
                  selectedReport?.id === r.id
                    ? "bg-violet-600/30 border-violet-500/50 shadow-md"
                    : "bg-white/5 border-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <span className="text-xs font-black text-white truncate max-w-[120px]">
                    {r.reporter?.full_name || "משתמש לא ידוע"}
                  </span>
                  {renderCategory(r.category)}
                </div>
                <p className="text-xs text-white/65 line-clamp-2 leading-relaxed mb-1.5">
                  {r.user_message}
                </p>
                <div className="flex justify-between items-center text-[10px] text-white/40">
                  <span>{new Date(r.created_at).toLocaleDateString("he-IL")}</span>
                  {r.status === "resolved" && <span className="text-emerald-400 font-bold">✓ טופל</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail View Panel (Left) */}
      <div className="flex-1 bg-[#150d32]/95 border border-white/10 rounded-2xl overflow-y-auto custom-scrollbar p-6">
        {selectedReport ? (
          <div className="space-y-6">
            {/* Header Details */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-white">
                  דיווח מאת: {selectedReport.reporter?.full_name || "לא ידוע"} (@{selectedReport.reporter?.username || "unknown"})
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  תאריך דיווח: {new Date(selectedReport.created_at).toLocaleString("he-IL")} | מזהה: {selectedReport.id}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {renderCategory(selectedReport.category)}
                <button
                  onClick={() => toggleStatus(selectedReport)}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition-all border ${
                    selectedReport.status === "resolved"
                      ? "bg-amber-600 border-amber-400 text-white hover:bg-amber-700"
                      : "bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                  }`}
                >
                  {selectedReport.status === "resolved" ? "החזר לממתין ↩" : "סמן כטופל ✓"}
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <h4 className="text-xs font-bold text-white/40 mb-1.5">ההודעה:</h4>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedReport.user_message}
              </div>
            </div>

            {/* Screenshots View */}
            {(signedScreenshot || signedCanvasScreenshot) && (
              <div>
                <h4 className="text-xs font-bold text-white/40 mb-2">צילומי מסך מצורפים (לחץ להגדלה):</h4>
                <div className="flex gap-4">
                  {signedScreenshot && (
                    <div className="flex-1 max-w-[240px] space-y-1">
                      <span className="block text-[10px] text-white/50 font-bold">צילום מסך מלא:</span>
                      <div 
                        onClick={() => setActiveImageModal(signedScreenshot)}
                        className="relative cursor-pointer border border-white/10 rounded-2xl overflow-hidden aspect-video bg-black/40 hover:border-violet-500 transition duration-200"
                      >
                        <img
                          src={signedScreenshot}
                          alt="Full screen capture"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  {signedCanvasScreenshot && (
                    <div className="flex-1 max-w-[240px] space-y-1">
                      <span className="block text-[10px] text-white/50 font-bold">צילום משחק (נקי):</span>
                      <div 
                        onClick={() => setActiveImageModal(signedCanvasScreenshot)}
                        className="relative cursor-pointer border border-white/10 rounded-2xl overflow-hidden aspect-video bg-black/40 hover:border-violet-500 transition duration-200"
                      >
                        <img
                          src={signedCanvasScreenshot}
                          alt="Game canvas capture"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Diagnostic Specs Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Browser Specs */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-violet-300 border-b border-white/5 pb-1.5 mb-2.5">
                  🌐 דפדפן ומערכת הפעלה
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">נתיב:</span> <span className="font-mono text-white/80">{selectedReport.browser_info.pathname}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">רזולוציה:</span> <span className="font-mono text-white/80">{selectedReport.browser_info.screenWidth}x{selectedReport.browser_info.screenHeight}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">חלון תצוגה:</span> <span className="font-mono text-white/80">{selectedReport.browser_info.viewportWidth}x{selectedReport.browser_info.viewportHeight}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">יחס פיקסלים:</span> <span className="font-mono text-white/80">{selectedReport.browser_info.devicePixelRatio}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">שפה:</span> <span className="font-mono text-white/80">{selectedReport.browser_info.language}</span></div>
                  <div className="text-[10px] text-white/35 mt-2 break-all font-mono leading-normal border-t border-white/5 pt-2">
                    {selectedReport.browser_info.userAgent}
                  </div>
                </div>
              </div>

              {/* Hardware Specs */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-violet-300 border-b border-white/5 pb-1.5 mb-2.5">
                  💻 חומרה ומעבד גרפי
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">ליבות מעבד (CPU):</span> <span className="font-mono text-white/80">{selectedReport.hardware_info.cpuCores}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">זיכרון מערכת:</span> <span className="font-mono text-white/80">{selectedReport.hardware_info.deviceMemory}</span></div>
                  <div className="border-t border-white/5 pt-2.5 mt-2">
                    <span className="block text-[10px] text-white/45 mb-1">מעבד גרפי (GPU):</span>
                    <span className="block font-mono text-[10px] text-white/70 leading-normal break-words bg-black/20 p-2 rounded-lg">
                      {selectedReport.hardware_info.gpu || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Console Log Interceptions */}
            <div>
              <h4 className="text-xs font-bold text-white/40 mb-1.5">יומן פעולות קונסול (Console Logs):</h4>
              <div className="bg-[#0b071e] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-72 custom-scrollbar space-y-1.5 leading-relaxed" dir="ltr">
                {selectedReport.console_logs && selectedReport.console_logs.length > 0 ? (
                  selectedReport.console_logs.map((log, index) => {
                    const colors = {
                      error: "text-rose-400 bg-rose-500/5",
                      warn: "text-amber-400 bg-amber-500/5",
                      info: "text-white/80",
                    };
                    const badgeColors = {
                      error: "text-rose-300 border-rose-500/40 bg-rose-500/20",
                      warn: "text-amber-300 border-amber-500/40 bg-amber-500/20",
                      info: "text-white/50 border-white/10 bg-white/5",
                    };
                    const lvl = log.level as keyof typeof colors;
                    return (
                      <div key={index} className={`flex items-start gap-2.5 p-1 rounded ${colors[lvl] || ""}`}>
                        <span className="text-white/30 shrink-0 select-none font-mono text-[10px]">
                          {new Date(log.time).toLocaleTimeString()}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1 py-px rounded border shrink-0 font-mono ${badgeColors[lvl] || ""}`}>
                          {log.level}
                        </span>
                        {log.count > 1 && (
                          <span className="text-[10px] font-black text-violet-400 bg-violet-500/20 border border-violet-500/30 px-1 rounded shrink-0 select-none">
                            x{log.count}
                          </span>
                        )}
                        <span className="break-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                          {log.msg}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-white/30 text-xs">לא הוקלטו לוגים בדיווח זה</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/40 text-xs py-12">
            <span>בחר דיווח מהרשימה מימין כדי להציג את הפרטים המלאים שלו</span>
          </div>
        )}
      </div>

      {/* Image Modal Lightbox overlay */}
      {activeImageModal && (
        <div 
          onClick={() => setActiveImageModal(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <img
            src={activeImageModal}
            alt="Enlarged screenshot view"
            className="max-w-full max-h-[92vh] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>
      )}
    </div>
  );
}
