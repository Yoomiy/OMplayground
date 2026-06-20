import React, { useRef, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getHardwareSpecs,
  getBrowserSpecs,
  getBufferedLogs,
  captureGameScreenshot,
  captureFullViewportScreenshot,
} from "@/utils/diagnostics";

interface Props {
  onClose: () => void;
}

function dataURLtoBlob(dataurl: string): Blob {
  const parts = dataurl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function FeedbackModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [includeLogs, setIncludeLogs] = useState(true);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [fullScreenshot, setFullScreenshot] = useState(false);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    // Safari light-dismiss fallback via boundary check
    const onClickBackdrop = (e: MouseEvent) => {
      if (!("closedBy" in HTMLDialogElement.prototype) && e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        const inside =
          r.top <= e.clientY && e.clientY <= r.bottom &&
          r.left <= e.clientX && e.clientX <= r.right;
        if (!inside) dialog.close();
      }
    };

    // Block key propagation to prevent background games from hijacking WASD keys
    const stopPropagation = (e: KeyboardEvent) => {
      e.stopPropagation();
    };

    dialog.addEventListener("click", onClickBackdrop);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("keydown", stopPropagation);
    dialog.addEventListener("keyup", stopPropagation);
    dialog.addEventListener("keypress", stopPropagation);

    // Capture screenshot at the moment the modal opens
    setScreenshot(captureGameScreenshot());

    return () => {
      dialog.removeEventListener("click", onClickBackdrop);
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("keydown", stopPropagation);
      dialog.removeEventListener("keyup", stopPropagation);
      dialog.removeEventListener("keypress", stopPropagation);
    };
  }, [onClose]);

  const handleFullScreenshotToggle = async (checked: boolean) => {
    if (checked) {
      setCapturingScreen(true);

      const dialog = dialogRef.current;
      if (dialog) {
        dialog.style.display = "none";
      }

      // Wait 50ms for browser to render the hidden state
      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        const fullPic = await captureFullViewportScreenshot();
        if (fullPic) {
          setScreenshot(fullPic);
          setFullScreenshot(true);
        } else {
          setFullScreenshot(false);
        }
      } finally {
        if (dialog) {
          dialog.style.display = "";
        }
        setCapturingScreen(false);
      }
    } else {
      setFullScreenshot(false);
      setScreenshot(captureGameScreenshot());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "submitting") return;
    setStatus("submitting");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const reporterId = user?.id || null;
      // 1. Upload screenshot to Storage if available
      let screenshotUrl: string | null = null;
      if (screenshot) {
        const blob = dataURLtoBlob(screenshot);
        const filename = `${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(filename, blob, { contentType: "image/jpeg" });

        if (!uploadError) {
          screenshotUrl = filename;
        }
      }

      // 2. Capture and upload the game canvas screenshot as backup if a full screenshot was taken
      let canvasScreenshotUrl: string | null = null;
      if (fullScreenshot) {
        const gameCanvasData = captureGameScreenshot();
        if (gameCanvasData) {
          const blob = dataURLtoBlob(gameCanvasData);
          const filename = `${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("feedback-screenshots")
            .upload(filename, blob, { contentType: "image/jpeg" });

          if (!uploadError) {
            canvasScreenshotUrl = filename;
          }
        }
      }

      // 3. Insert the report row
      const { error } = await supabase.from("feedback_reports").insert({
        reporter_id: reporterId,
        user_message: message,
        category,
        browser_info: getBrowserSpecs(),
        hardware_info: getHardwareSpecs(),
        console_logs: includeLogs ? getBufferedLogs() : [],
        screenshot_url: screenshotUrl,
        canvas_screenshot_url: canvasScreenshotUrl,
      });

      if (error) throw error;

      setStatus("success");
      setTimeout(() => dialogRef.current?.close(), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as any)}
      id="feedback-modal-dialog"
      className="rounded-3xl p-6 max-w-md w-full border border-white/10 bg-[#150d32]/95 text-white
                 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md
                 backdrop:bg-black/60 backdrop:backdrop-blur-sm animate-slide-up outline-none"
      aria-labelledby="feedback-title"
    >
      <h2 id="feedback-title" className="text-xl font-black mb-4 text-right flex items-center justify-between">
        <span>שלח משוב / דיווח על תקלה 🐛</span>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="text-white/40 hover:text-white transition duration-200"
          aria-label="סגור"
        >
          ✕
        </button>
      </h2>

      {status === "success" ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-lg font-black text-emerald-400">
            תודה! המשוב נשלח בהצלחה.
          </p>
          <p className="text-xs text-white/50 mt-1">
            הקבוצה מעריכה את העזרה שלך בשיפור המשחק!
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-bold text-white/70 mb-1">סוג המשוב:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-white/10 p-3 bg-[#1e1545]/90 text-white focus:outline-none focus:border-violet-500 transition duration-200"
            >
              <option value="bug">תקלה / באג 🐛</option>
              <option value="suggestion">הצעה לשיפור 💡</option>
              <option value="other">אחר 💬</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1">
              מה קרה? (פרט ככל הניתן):
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="למשל: לא הצלחתי לשבור בלוקים במשחק הווקסל או שהכפתור לא עבד..."
              className="w-full rounded-2xl border border-white/10 p-3 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition duration-200 resize-none text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 py-1">
            <div className="flex items-center gap-2">
              <input
                id="feedback-include-logs"
                type="checkbox"
                checked={includeLogs}
                onChange={(e) => setIncludeLogs(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-[#150d32]"
              />
              <label
                htmlFor="feedback-include-logs"
                className="text-xs font-bold text-white/50 select-none cursor-pointer"
              >
                צרף נתוני מערכת ויומן פעולות (מסייע בפתרון תקלות)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="feedback-full-screenshot"
                type="checkbox"
                checked={fullScreenshot}
                disabled={capturingScreen}
                onChange={(e) => handleFullScreenshotToggle(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-[#150d32]"
              />
              <label
                htmlFor="feedback-full-screenshot"
                className="text-xs font-bold text-white/50 select-none cursor-pointer"
              >
                {capturingScreen ? "מצלם מסך..." : "צרף צילום מסך של כל החלון (מצריך אישור)"}
              </label>
            </div>
          </div>

          {screenshot && (
            <div>
              <span className="block text-xs font-bold text-white/70 mb-1">צילום מסך מצורף:</span>
              <div className="relative border border-white/10 rounded-2xl overflow-hidden aspect-video bg-black/40">
                <img
                  src={screenshot}
                  alt="Screen capture"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-rose-400 font-bold">שגיאה בשליחת המשוב. אנא נסה שוב.</p>
          )}

          <div className="flex justify-stretch gap-3 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={status === "submitting" || !message.trim()}
              className="flex-1 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
            >
              {status === "submitting" ? "שולח..." : "שלח דיווח"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
