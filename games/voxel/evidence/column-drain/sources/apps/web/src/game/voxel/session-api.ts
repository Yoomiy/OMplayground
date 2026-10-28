import {
  readModerationAction,
  readModerationReceipt,
} from "../../../../../games/voxel/src/shared/moderation.ts";
import type {
  ModerationAction,
  ModerationReceipt,
} from "../../../../../games/voxel/src/shared/moderation.ts";
export type { ModerationAction, ModerationReceipt };
import {
  readVoiceTicket,
  readMediaReceipt,
  readMediaState,
} from "../../../../../games/voxel/src/shared/media.ts";
import type {
  MediaAction,
  MediaReceipt,
  MediaState,
  VoiceTicket,
} from "../../../../../games/voxel/src/shared/media.ts";
export type { MediaAction, MediaReceipt, MediaState, VoiceTicket };
export type ModerationTarget = Readonly<{
  id: string;
  name: string;
  banned: boolean;
  pendingReadmission: boolean;
}>;
import {
  readStaffCommand,
  readStaffResult,
} from "../../../../../games/voxel/src/shared/staff.ts";
import type {
  StaffCommand,
  StaffResult,
} from "../../../../../games/voxel/src/shared/staff.ts";
export type { StaffCommand };
export type StaffReceipt = Readonly<{
  requestId: string;
  command: StaffCommand;
  result: StaffResult;
  completed: true;
  revision: number;
  ownerEpoch: number;
  current: boolean;
  saved: false;
}>;
import { readSessionProjection } from "./session-projection";
export type Participation = "player" | "observer";
export type LifecycleAction = "pause" | "resume" | "end";
export type ControlReceipt = Readonly<{
  requestId: string;
  action: LifecycleAction;
  completed: true;
  saved: boolean;
  savedSequence: number | null;
  revision: number;
  current: boolean;
}>;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export class VoxelApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable = false) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}
export function voxelEndpoint(value: string): {
  origin: string;
  socketUrl: string;
} {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VoxelApiError("CONFIGURATION");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname) ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new VoxelApiError("CONFIGURATION");
  return {
    origin: url.origin,
    socketUrl: `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/voxel`,
  };
}
/** Browser tokens go only to the configured service header, never URLs or telemetry. */
export function createVoxelApi(options: {
  serverUrl: string;
  room: string;
  invitationCode?: string;
  participation?: Participation;
  getToken: () => Promise<string>;
  request?: typeof fetch;
}) {
  if (!UUID.test(options.room)) throw new VoxelApiError("INVALID");
  const endpoint = voxelEndpoint(options.serverUrl),
    request = options.request ?? fetch;
  async function post(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const token = await options.getToken();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!token || token.length > 16384) throw new VoxelApiError("UNAUTHORIZED");
    const abort = new AbortController(),
      relay = () => abort.abort();
    signal?.addEventListener("abort", relay, { once: true });
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      let response: Response;
      try {
        response = await request(endpoint.origin + path, {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abort.signal,
        });
      } catch {
        if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        throw new VoxelApiError("UNAVAILABLE", true);
      }
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        throw new VoxelApiError("PROTOCOL", true);
      }
      if (!response.ok) {
        const code =
          record(value) &&
          typeof value.error === "string" &&
          /^[A-Z_]{1,48}$/.test(value.error)
            ? value.error
            : "UNAVAILABLE";
        throw new VoxelApiError(
          code,
          response.status >= 500 || response.status === 429,
        );
      }
      return value;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", relay);
    }
  }

  return {
    socketUrl: endpoint.socketUrl,
    voiceUrl: endpoint.origin.replace(/^http/, "ws") + "/voxel-media",
    async voiceTicket(signal?: AbortSignal): Promise<VoiceTicket> {
      const value = readVoiceTicket(
        await post("/api/voxel/voice-ticket", { room: options.room }, signal),
      );
      if (!value) throw new VoxelApiError("PROTOCOL", true);
      return value;
    },
    async mediaState(signal?: AbortSignal): Promise<MediaState> {
      const value = readMediaState(
        await post("/api/voxel/media-state", { room: options.room }, signal),
      );
      if (!value) throw new VoxelApiError("PROTOCOL", true);
      return value;
    },
    async moderateMedia(
      action: MediaAction,
      target: string | null,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<MediaReceipt> {
      if (
        !UUID.test(requestId) ||
        !["mute", "unmute"].includes(action) ||
        !(target === null || UUID.test(target))
      )
        throw new VoxelApiError("INVALID");
      const value = readMediaReceipt(
        await post(
          "/api/voxel/media-moderate",
          { room: options.room, requestId, action, target },
          signal,
        ),
      );
      if (
        !value ||
        value.requestId !== requestId ||
        value.action !== action ||
        value.target !== target
      )
        throw new VoxelApiError("PROTOCOL", true);
      return value;
    },
    async chatHistory(
      before: number | null = null,
      signal?: AbortSignal,
    ): Promise<ChatPage> {
      if (before !== null && (!Number.isSafeInteger(before) || before < 1))
        throw new VoxelApiError("INVALID");
      const page = readChatPage(
        await post(
          "/api/voxel/chat-history",
          { room: options.room, before },
          signal,
        ),
      );
      if (
        !page ||
        (before !== null && page.messages.some((m) => m.sequence >= before))
      )
        throw new VoxelApiError("PROTOCOL");
      return page;
    },
    async sendChat(
      message: string,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<ChatReceipt> {
      if (!validChatText(message) || !UUID.test(requestId))
        throw new VoxelApiError("INVALID");
      const receipt = readChatReceipt(
        await post(
          "/api/voxel/chat-send",
          { room: options.room, requestId, message: message.trim() },
          signal,
        ),
      );
      if (
        !receipt ||
        receipt.requestId !== requestId ||
        receipt.action !== "send" ||
        receipt.messageId !== requestId
      )
        throw new VoxelApiError("PROTOCOL", true);
      return receipt;
    },
    async moderateChat(
      action: "delete" | "clear",
      target: string | null,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<ChatReceipt> {
      if (
        !UUID.test(requestId) ||
        !["delete", "clear"].includes(action) ||
        (action === "clear" ? target !== null : !target || !UUID.test(target))
      )
        throw new VoxelApiError("INVALID");
      const receipt = readChatReceipt(
        await post(
          "/api/voxel/chat-moderate",
          { room: options.room, requestId, action, target },
          signal,
        ),
      );
      if (
        !receipt ||
        receipt.requestId !== requestId ||
        receipt.action !== action ||
        receipt.messageId !== target
      )
        throw new VoxelApiError("PROTOCOL", true);
      return receipt;
    },
    async moderate(
      action: ModerationAction,
      target: string,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<ModerationReceipt> {
      if (
        !readModerationAction(action) ||
        !UUID.test(target) ||
        !UUID.test(requestId)
      )
        throw new VoxelApiError("INVALID");
      const value = readModerationReceipt(
        await post(
          "/api/voxel/moderation",
          { room: options.room, requestId, target, action },
          signal,
        ),
      );
      if (
        !value ||
        value.requestId !== requestId ||
        value.target !== target ||
        value.action !== action
      )
        throw new VoxelApiError("PROTOCOL", true);
      return value;
    },
    async moderationTargets(
      signal?: AbortSignal,
    ): Promise<readonly ModerationTarget[]> {
      const value = await post(
        "/api/voxel/moderation-targets",
        { room: options.room },
        signal,
      );
      if (
        !record(value) ||
        Object.keys(value).length !== 1 ||
        !Array.isArray(value.targets) ||
        value.targets.some(
          (row) =>
            !record(row) ||
            Object.keys(row).length !== 4 ||
            typeof row.id !== "string" ||
            !UUID.test(row.id) ||
            typeof row.name !== "string" ||
            typeof row.banned !== "boolean" ||
            typeof row.pendingReadmission !== "boolean",
        ) ||
        new Set(value.targets.map((row) => row.id)).size !==
          value.targets.length
      )
        throw new VoxelApiError("PROTOCOL", true);
      return value.targets as readonly ModerationTarget[];
    },
    async staff(
      command: StaffCommand,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<StaffReceipt> {
      const checked = readStaffCommand(command);
      if (!checked || !UUID.test(requestId)) throw new VoxelApiError("INVALID");
      const result = await post(
        "/api/voxel/control",
        { room: options.room, requestId, command: checked },
        signal,
      );
      const outcome = record(result) ? readStaffResult(result.result) : null;
      if (
        !record(result) ||
        Object.keys(result).length !== 8 ||
        result.requestId !== requestId ||
        result.completed !== true ||
        result.saved !== false ||
        !Number.isSafeInteger(result.revision) ||
        (result.revision as number) < 1 ||
        !Number.isSafeInteger(result.ownerEpoch) ||
        (result.ownerEpoch as number) < 1 ||
        typeof result.current !== "boolean" ||
        !outcome ||
        (outcome.ok &&
          outcome.reason !== checked.kind &&
          !(checked.kind === "mode" && outcome.reason === "unchanged")) ||
        JSON.stringify(readStaffCommand(result.command)) !==
          JSON.stringify(checked)
      )
        throw new VoxelApiError("PROTOCOL", true);
      return result as StaffReceipt;
    },
    async leave(requestId: string, signal?: AbortSignal) {
      if (!UUID.test(requestId)) throw new VoxelApiError("INVALID");
      const result = await post(
        "/api/voxel/leave",
        { room: options.room, requestId },
        signal,
      );
      if (
        !record(result) ||
        Object.keys(result).length !== 4 ||
        result.requestId !== requestId ||
        result.left !== true ||
        typeof result.ended !== "boolean" ||
        !Number.isSafeInteger(result.revision) ||
        (result.revision as number) < 1
      )
        throw new VoxelApiError("PROTOCOL", true);
      return result as {
        requestId: string;
        left: true;
        ended: boolean;
        revision: number;
      };
    },
    async session(signal?: AbortSignal) {
      const result = await post(
        "/api/voxel/session",
        {
          room: options.room,
          ...(options.invitationCode
            ? { invitationCode: options.invitationCode }
            : {}),
          ...(options.participation
            ? { participation: options.participation }
            : {}),
        },
        signal,
      );
      const value = readSessionProjection(result);
      if (value.id !== options.room) throw new VoxelApiError("PROTOCOL");
      return value;
    },
    async report(
      operation: string,
      code: string,
      buildId: string | null,
      signal?: AbortSignal,
    ) {
      await post(
        "/api/voxel/diagnostics",
        {
          room: options.room,
          operation,
          code,
          buildId,
          correlationId: crypto.randomUUID(),
        },
        signal,
      );
    },
    async admit(signal?: AbortSignal) {
      const result = await post(
        "/api/voxel/admission",
        {
          room: options.room,
          ...(options.invitationCode
            ? { invitationCode: options.invitationCode }
            : {}),
          ...(options.participation
            ? { participation: options.participation }
            : {}),
        },
        signal,
      );
      if (
        !record(result) ||
        Object.keys(result).length !== 2 ||
        typeof result.ticket !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(result.ticket) ||
        typeof result.buildId !== "string" ||
        !HASH.test(result.buildId)
      )
        throw new VoxelApiError("PROTOCOL");
      return { ticket: result.ticket, buildId: result.buildId };
    },
    async control(
      action: LifecycleAction,
      requestId: string,
      signal?: AbortSignal,
    ): Promise<ControlReceipt> {
      if (!UUID.test(requestId)) throw new VoxelApiError("INVALID");
      const result = await post(
        "/api/voxel/control",
        { room: options.room, requestId, action },
        signal,
      );
      if (
        !record(result) ||
        Object.keys(result).length !== 7 ||
        result.requestId !== requestId ||
        result.action !== action ||
        result.completed !== true ||
        typeof result.current !== "boolean" ||
        !Number.isSafeInteger(result.revision) ||
        (result.revision as number) < 1 ||
        !(
          result.savedSequence === null ||
          (Number.isSafeInteger(result.savedSequence) &&
            (result.savedSequence as number) > 0)
        ) ||
        (action === "resume"
          ? result.saved !== false || result.savedSequence !== null
          : result.saved !== true || result.savedSequence === null)
      )
        throw new VoxelApiError("PROTOCOL", true);
      return result as ControlReceipt;
    },
  };
}
export type VoxelApi = ReturnType<typeof createVoxelApi>;
export function admissionMessage(code: string): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: "יש להתחבר מחדש למגרש המשחקים.",
    RECESS_CLOSED: "זמן ההפסקה הסתיים. אפשר לחזור בהפסקה הבאה.",
    GENDER_MISMATCH: "אי אפשר להצטרף למפגש הזה.",
    MODE_DENIED: "מצב ההשתתפות הזה אינו זמין לחשבון שלכם.",
    PAUSED_ROSTER: "המפגש מושהה. רק משתתפים שכבר הצטרפו יכולים לחזור אליו.",
    SESSION_CLOSED: "נדרשת הזמנה בתוקף למפגש הזה.",
    SESSION_ENDED: "המפגש הסתיים.",
    NOT_FOUND: "המפגש אינו זמין.",
    WRONG_GAME: "המפגש אינו זמין.",
    FORBIDDEN: "אין הרשאה לפעולה הזאת.",
    BANNED: "הגישה לעולם נחסמה. פנו לאיש צוות.",
    CONFIGURATION: "החיבור לעולם עדיין לא הוגדר.",
  };
  return messages[code] ?? "לא ניתן להתחבר כרגע. אפשר לנסות שוב.";
}
import {
  readChatPage,
  readChatReceipt,
  validChatText,
} from "../../../../../games/voxel/src/shared/chat.ts";
import type {
  ChatPage,
  ChatReceipt,
} from "../../../../../games/voxel/src/shared/chat.ts";
export type { ChatPage, ChatReceipt };
