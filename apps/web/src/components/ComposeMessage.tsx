import { useEffect } from "react";
import { useInbox } from "@/hooks/useInbox";
export interface ComposeMessageProps {
  open: boolean;
  onClose: () => void;
  fromId: string;
  fromDisplayName: string;
  senderGender: "boy" | "girl";
  toId: string;
  toDisplayName: string;
}
/** Compatibility entry point for profile/action-sheet message buttons. */
export function ComposeMessage({ open, onClose, toId }: ComposeMessageProps) {
  const { select } = useInbox();
  useEffect(() => {
    if (open) {
      select(toId);
      onClose();
    }
  }, [open, toId, select, onClose]);
  return null;
}
