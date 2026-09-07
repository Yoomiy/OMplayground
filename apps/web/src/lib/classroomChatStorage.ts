export type ClassroomStoredChatMessage = {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isHost?: boolean;
};

type ClassroomChatCache = {
  version: 1;
  publicMessages: ClassroomStoredChatMessage[];
  privateThreads: Record<string, ClassroomStoredChatMessage[]>;
};

const CACHE_PREFIX = "classroom-chat:v1";
const MAX_MESSAGES_PER_THREAD = 100;

export function classroomChatStorageKey(classroomId: string, attendanceKey: string): string {
  return `${CACHE_PREFIX}:${classroomId}:${attendanceKey}`;
}

function emptyCache(): ClassroomChatCache {
  return { version: 1, publicMessages: [], privateThreads: {} };
}

function sanitizeMessages(value: unknown): ClassroomStoredChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is ClassroomStoredChatMessage =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as ClassroomStoredChatMessage).id === "string" &&
      typeof (entry as ClassroomStoredChatMessage).senderName === "string" &&
      typeof (entry as ClassroomStoredChatMessage).text === "string" &&
      typeof (entry as ClassroomStoredChatMessage).timestamp === "number"
    )
    .slice(-MAX_MESSAGES_PER_THREAD);
}

function readCache(key: string): ClassroomChatCache {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return emptyCache();
    const parsed = JSON.parse(raw) as Partial<ClassroomChatCache>;
    if (parsed.version !== 1) return emptyCache();
    const privateThreads = Object.fromEntries(
      Object.entries(parsed.privateThreads ?? {}).map(([threadKey, messages]) => [
        threadKey,
        sanitizeMessages(messages)
      ])
    );
    return { version: 1, publicMessages: sanitizeMessages(parsed.publicMessages), privateThreads };
  } catch {
    return emptyCache();
  }
}

function writeCache(key: string, cache: ClassroomChatCache): boolean {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(cache));
    return true;
  } catch {
    // Storage is best-effort; the live LiveKit message has already been delivered.
    return false;
  }
}

function appendMessage(
  messages: ClassroomStoredChatMessage[],
  message: ClassroomStoredChatMessage
): ClassroomStoredChatMessage[] {
  if (messages.some((existing) => existing.id === message.id)) return messages;
  return [...messages, message].slice(-MAX_MESSAGES_PER_THREAD);
}

export function loadClassroomChatCache(key: string): ClassroomChatCache {
  return readCache(key);
}

export function storePublicClassroomChatMessage(key: string, message: ClassroomStoredChatMessage): boolean {
  const cache = readCache(key);
  cache.publicMessages = appendMessage(cache.publicMessages, message);
  return writeCache(key, cache);
}

export function storePrivateClassroomChatMessage(
  key: string,
  threadKey: string,
  message: ClassroomStoredChatMessage
): boolean {
  const cache = readCache(key);
  cache.privateThreads[threadKey] = appendMessage(cache.privateThreads[threadKey] ?? [], message);
  return writeCache(key, cache);
}

export function clearClassroomChatCache(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage cleanup must not interfere with leaving a classroom.
  }
}
