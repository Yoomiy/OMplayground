import { useCallback, useEffect, useRef, useState } from "react";

export type OutgoingChatMessage = {
  id: string;
  message: string;
  at: string;
  state: "sending" | "sent" | "unconfirmed" | "failed";
  error?: string;
};
export type DeliverChatMessage = (
  message: string,
  id: string,
  signal: AbortSignal,
) => Promise<unknown>;
export class ChatDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** Local display only. A transport receipt/history still owns delivery and moderation. */
export function useChatOutbox(scope: unknown) {
  const [messages, setMessages] = useState<OutgoingChatMessage[]>([]);
  const current = useRef(messages);
  const inFlight = useRef(new Map<string, AbortController>());
  const update = useCallback(
    (change: (messages: OutgoingChatMessage[]) => OutgoingChatMessage[]) => {
      current.current = change(current.current);
      setMessages(current.current);
    },
    [],
  );
  useEffect(() => {
    update(() => []);
    return () => {
      for (const abort of inFlight.current.values()) abort.abort();
      inFlight.current.clear();
    };
  }, [scope, update]);
  const send = useCallback(
    async (
      message: string,
      deliver: DeliverChatMessage,
      id: string = crypto.randomUUID(),
    ) => {
      if (inFlight.current.has(id)) return false;
      const abort = new AbortController();
      inFlight.current.set(id, abort);
      update((messages) =>
        messages.some((entry) => entry.id === id)
          ? messages.map((entry) =>
              entry.id === id
                ? { ...entry, state: "sending", error: undefined }
                : entry,
            )
          : [
              ...messages,
              { id, message, at: new Date().toISOString(), state: "sending" },
            ],
      );
      try {
        await deliver(message, id, abort.signal);
        if (abort.signal.aborted) return false;
        update((messages) =>
          messages.map((entry) =>
            entry.id === id ? { ...entry, state: "sent" } : entry,
          ),
        );
        return true;
      } catch (error) {
        if (!abort.signal.aborted)
          update((messages) =>
            messages.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    state:
                      error instanceof ChatDeliveryError && error.retryable
                        ? "unconfirmed"
                        : "failed",
                    error:
                      error instanceof Error
                        ? error.message
                        : "שליחת ההודעה נכשלה.",
                  }
                : entry,
            ),
          );
        return false;
      } finally {
        if (inFlight.current.get(id) === abort) inFlight.current.delete(id);
      }
    },
    [update],
  );
  const acknowledged = useCallback(
    () =>
      new Set(
        current.current
          .filter((entry) => entry.state === "sent")
          .map((entry) => entry.id),
      ),
    [],
  );
  const reconcile = useCallback(
    (
      received: ReadonlySet<string>,
      acknowledgedBeforeRead: ReadonlySet<string> = new Set(),
    ) => {
      update((messages) =>
        messages.filter(
          (entry) =>
            !received.has(entry.id) && !acknowledgedBeforeRead.has(entry.id),
        ),
      );
    },
    [update],
  );
  const remove = useCallback(
    (id: string) => {
      update((messages) => messages.filter((entry) => entry.id !== id));
    },
    [update],
  );
  return { messages, send, acknowledged, reconcile, remove };
}
