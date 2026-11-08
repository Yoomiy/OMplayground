import { useCallback, useLayoutEffect, useRef } from "react";
import type { Message } from "@/lib/directMessages";

/** Keep the visible message anchored while older pages or live updates arrive. */
export function useInboxScroll(options: {
  active: string | null;
  messages: Message[];
  userId?: string;
  hasHistory: boolean;
  loadingHistory: boolean;
  historyError: string;
  loadHistory: () => Promise<void>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const position = useRef<{
    active: string | null;
    initialized: boolean;
    atBottom: boolean;
    newestId?: string;
    anchor?: { id: string; offset: number };
  }>({ active: null, initialized: false, atBottom: true });
  const remember = useCallback(() => {
    const node = root.current;
    if (!node || !node.clientHeight) return;
    position.current.atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
    const top = node.getBoundingClientRect().top;
    const firstVisible = [...node.querySelectorAll<HTMLElement>("[data-inbox-message-id]")]
      .find((message) => message.getBoundingClientRect().bottom > top);
    position.current.anchor = firstVisible
      ? { id: firstVisible.dataset.inboxMessageId!, offset: firstVisible.getBoundingClientRect().top - top }
      : undefined;
  }, []);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !options.active) return;
    if (position.current.active !== options.active)
      position.current = { active: options.active, initialized: false, atBottom: true };
    const sync = () => {
      if (!node.clientHeight || !options.messages.length) return;
      const newest = options.messages[0];
      const sent = position.current.newestId !== newest.id && newest.from_kid_id === options.userId;
      if (!position.current.initialized || position.current.atBottom || sent) {
        node.scrollTop = node.scrollHeight;
      } else if (position.current.anchor) {
        const anchor = [...node.querySelectorAll<HTMLElement>("[data-inbox-message-id]")]
          .find((message) => message.dataset.inboxMessageId === position.current.anchor?.id);
        if (anchor)
          node.scrollTop += anchor.getBoundingClientRect().top - node.getBoundingClientRect().top - position.current.anchor.offset;
      }
      position.current.initialized = true;
      position.current.newestId = newest.id;
      remember();
    };
    sync();
    // Floating dialogs can be hidden on mount; initialize when their viewport opens.
    const resize = new ResizeObserver(sync);
    resize.observe(node);
    return () => resize.disconnect();
  }, [options.active, options.messages, options.userId, options.loadingHistory, options.historyError, remember]);

  const onScroll = () => {
    remember();
    if (root.current && root.current.scrollTop < 96 && position.current.initialized &&
      options.hasHistory && !options.loadingHistory && !options.historyError)
      void options.loadHistory();
  };
  return { ref: root, onScroll };
}
