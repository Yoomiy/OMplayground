import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { InboxPanel } from "@/components/InboxPanel";
import { KidDesktopShell } from "@/components/KidDesktopShell";
import { useInbox } from "@/hooks/useInbox";
export function InboxPage() {
  const [params] = useSearchParams();
  const { select, setOpen, open } = useInbox();
  const id = params.get("kidId");
  useEffect(() => {
    setOpen(false);
    if (id) select(id, false);
  }, [id, select, setOpen, open]);
  return (
    <KidDesktopShell title="הודעות" subtitle="שיחות עם ילדים וצוות">
      <div className="h-[75dvh] rounded-2xl border bg-white dark:bg-slate-950">
        {!open && <InboxPanel />}
      </div>
    </KidDesktopShell>
  );
}
