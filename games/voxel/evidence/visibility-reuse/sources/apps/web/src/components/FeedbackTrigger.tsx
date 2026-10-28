import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        id="feedback-trigger-btn"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-white/95 text-slate-800 border-slate-300 hover:bg-slate-50 dark:bg-[#150d32]/95 dark:border-white/10 dark:text-white dark:hover:bg-[#1f154c]/95
                   text-xs font-black py-2.5 px-4 rounded-full shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border
                   hover:scale-105 transition-all duration-200"
        aria-label="שלח משוב"
      >
        💬 דיווח על בעיה / משוב
      </button>

      {isOpen && <FeedbackModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
