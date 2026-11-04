const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
export type ChatMessage = Readonly<{
  id: string;
  sequence: number;
  senderId: string;
  senderName: string;
  message: string;
  at: string;
}>;
export type ChatPage = Readonly<{ messages: readonly ChatMessage[]; before: number | null }>;
export type ChatAction = 'send' | 'delete' | 'clear';
export type ChatReceipt = Readonly<{
  requestId: string;
  action: ChatAction;
  messageId: string | null;
  applied: true;
  persisted: true;
}>;
export function validChatText(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.trim().length > 0 &&
    v.length <= 1000 &&
    Array.from(v).length <= 500 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) &&
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)
  );
}
export function readChatPage(v: unknown): ChatPage | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 2 ||
    !Array.isArray(v.messages) ||
    v.messages.length > 100 ||
    !(v.before === null || integer(v.before))
  )
    return null;
  let previous = 0;
  const ids = new Set<string>();
  for (const m of v.messages) {
    if (
      !record(m) ||
      Object.keys(m).length !== 6 ||
      typeof m.id !== 'string' ||
      !UUID.test(m.id) ||
      ids.has(m.id) ||
      !integer(m.sequence) ||
      m.sequence <= previous ||
      typeof m.senderId !== 'string' ||
      !UUID.test(m.senderId) ||
      typeof m.senderName !== 'string' ||
      !m.senderName.length ||
      m.senderName.length > 320 ||
      !validChatText(m.message) ||
      typeof m.at !== 'string' ||
      !Number.isFinite(Date.parse(m.at))
    )
      return null;
    ids.add(m.id);
    previous = m.sequence;
  }
  if (v.before !== null && (!v.messages.length || v.before !== v.messages[0].sequence)) return null;
  return v as ChatPage;
}
export function readChatReceipt(v: unknown): ChatReceipt | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 5 ||
    typeof v.requestId !== 'string' ||
    !UUID.test(v.requestId) ||
    !['send', 'delete', 'clear'].includes(v.action as string) ||
    v.applied !== true ||
    v.persisted !== true ||
    (v.action === 'clear'
      ? v.messageId !== null
      : typeof v.messageId !== 'string' || !UUID.test(v.messageId))
  )
    return null;
  if (v.action === 'send' && v.messageId !== v.requestId) return null;
  return v as ChatReceipt;
}
