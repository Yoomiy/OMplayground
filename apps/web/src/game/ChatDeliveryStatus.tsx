import type { OutgoingChatMessage } from "../hooks/useChatOutbox";

export function ChatDeliveryStatus({
  message,
  disabled,
  retry,
  edit,
}: {
  message: OutgoingChatMessage;
  disabled?: boolean;
  retry?: () => void;
  edit: () => void;
}) {
  return (
    <span className="text-xs">
      {message.state === "sending" && <small role="status">שולח…</small>}
      {message.error && <small role="status">{message.error}</small>}
      {message.state === "unconfirmed" && retry && (
        <button type="button" disabled={disabled} onClick={retry}>
          בדיקת בקשת הצ׳אט
        </button>
      )}
      {message.state === "failed" && (
        <button type="button" onClick={edit}>
          עריכת ההודעה
        </button>
      )}
    </span>
  );
}
