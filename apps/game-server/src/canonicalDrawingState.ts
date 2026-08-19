import {
  MAX_ELEMENTS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_STATE_BYTES,
  type DrawingState
} from "@playground/game-logic";
import * as Y from "yjs";

export interface CanonicalDrawingLiveState {
  doc: Y.Doc;
  revision: number;
  persistedRevision: number;
  clearRevision: number;
}

export interface CanonicalDrawingCanvas {
  elements: unknown[];
  files: Record<string, unknown>;
}

/**
 * Per-socket initialization state. A client must acknowledge the exact
 * canonical document it was served before its Yjs mutations are accepted.
 */
export interface CanonicalDrawingSocketSync {
  sessionId: string;
  token: string;
  acknowledged: boolean;
  /** Canonical revision included in the document this socket was served. */
  revision?: number;
  operationId?: string;
  startedAt?: number;
  attempts?: number;
  reason?: string;
}

// A full canonical update is base64 encoded for Socket.IO. Keep the binary
// document comfortably below the 10 MB transport buffer after that expansion.
const MAX_YJS_DOCUMENT_BYTES = 6 * 1024 * 1024;
const ORDER_KEY_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function initialOrderKey(index: number): string {
  let remaining = index;
  let width = 1;
  let headCode = "a".charCodeAt(0);
  while (true) {
    const capacity = ORDER_KEY_DIGITS.length ** width;
    if (remaining < capacity) {
      let digits = "";
      for (let position = width - 1; position >= 0; position -= 1) {
        const divisor = ORDER_KEY_DIGITS.length ** position;
        const digit = Math.floor(remaining / divisor);
        digits += ORDER_KEY_DIGITS[digit];
        remaining %= divisor;
      }
      return `${String.fromCharCode(headCode)}${digits}`;
    }
    remaining -= capacity;
    width += 1;
    headCode += 1;
  }
}

function encode(update: Uint8Array): string {
  return Buffer.from(update).toString("base64");
}

function decode(update: string): Uint8Array {
  return new Uint8Array(Buffer.from(update, "base64"));
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function isValidCanvas(canvas: CanonicalDrawingCanvas): boolean {
  if (canvas.elements.length > MAX_ELEMENTS || Object.keys(canvas.files).length > MAX_FILES) {
    return false;
  }
  if (byteLength(canvas) > MAX_STATE_BYTES) return false;
  return Object.values(canvas.files).every((file) => byteLength(file) <= MAX_FILE_BYTES);
}

function roots(doc: Y.Doc) {
  return {
    elements: doc.getArray<Y.Map<unknown>>("elements"),
    assets: doc.getMap<unknown>("assets")
  };
}

function seedCanvas(doc: Y.Doc, canvas: CanonicalDrawingCanvas) {
  const { elements, assets } = roots(doc);
  const sourceElements = Array.isArray(canvas.elements) ? canvas.elements : [];
  doc.transact(() => {
    if (sourceElements.length > 0) {
      elements.push(
        sourceElements.map((element, index) => {
          const map = new Y.Map<unknown>();
          map.set("el", element);
          map.set("pos", initialOrderKey(index));
          return map;
        })
      );
    }
    for (const [id, file] of Object.entries(canvas.files ?? {})) {
      assets.set(id, file);
    }
  }, "server-hydrate");
}

export function canvasFromDoc(doc: Y.Doc): CanonicalDrawingCanvas {
  const { elements, assets } = roots(doc);
  return {
    elements: elements
      .toArray()
      .map((entry) => entry.get("el"))
      .filter((element) => element && typeof element === "object"),
    files: Object.fromEntries(assets.entries())
  };
}

export function createCanonicalDrawingState(savedState: DrawingState | null | undefined): CanonicalDrawingLiveState {
  const canvas = savedState?.canvas;
  const state: CanonicalDrawingLiveState = {
    doc: new Y.Doc(),
    revision: canvas?.version ?? 0,
    persistedRevision: canvas?.version ?? 0,
    clearRevision: canvas?.clearVersion ?? 0,
  };
  if (canvas && (canvas.elements.length || Object.keys(canvas.files).length)) {
    seedCanvas(state.doc, { elements: canvas.elements, files: canvas.files });
  }
  return state;
}

export function encodeFullCanonicalDrawingState(state: CanonicalDrawingLiveState): string {
  return encode(Y.encodeStateAsUpdate(state.doc));
}

export function canApplyCanonicalDrawingSocketUpdate(
  sync: CanonicalDrawingSocketSync | undefined,
  sessionId: string
): boolean {
  return sync?.sessionId === sessionId && sync.acknowledged;
}

export type CanonicalDrawingUpdateResult =
  | { ok: true }
  | { ok: false; code: "BAD_YJS_UPDATE" | "BOARD_LIMIT_EXCEEDED" };

export function applyCanonicalDrawingUpdate(
  state: CanonicalDrawingLiveState,
  encodedUpdate: string
): CanonicalDrawingUpdateResult {
  let update: Uint8Array;
  try {
    update = decode(encodedUpdate);
  } catch {
    return { ok: false, code: "BAD_YJS_UPDATE" };
  }

  const candidate = new Y.Doc();
  try {
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(state.doc));
    Y.applyUpdate(candidate, update);
  } catch {
    candidate.destroy();
    return { ok: false, code: "BAD_YJS_UPDATE" };
  }

  if (
    Y.encodeStateAsUpdate(candidate).byteLength > MAX_YJS_DOCUMENT_BYTES ||
    !isValidCanvas(canvasFromDoc(candidate))
  ) {
    candidate.destroy();
    return { ok: false, code: "BOARD_LIMIT_EXCEEDED" };
  }

  state.doc.destroy();
  state.doc = candidate;
  state.revision += 1;
  return { ok: true };
}

export function applyCanonicalDrawingSocketUpdate(
  state: CanonicalDrawingLiveState,
  sync: CanonicalDrawingSocketSync | undefined,
  sessionId: string,
  encodedUpdate: string
): CanonicalDrawingUpdateResult | { ok: false; code: "SYNC_NOT_ACKNOWLEDGED" } {
  if (!canApplyCanonicalDrawingSocketUpdate(sync, sessionId)) {
    return { ok: false, code: "SYNC_NOT_ACKNOWLEDGED" };
  }
  return applyCanonicalDrawingUpdate(state, encodedUpdate);
}

export function clearCanonicalDrawingState(state: CanonicalDrawingLiveState): void {
  const { elements, assets } = roots(state.doc);
  state.doc.transact(() => {
    elements.delete(0, elements.length);
    assets.clear();
  }, "server-clear");
  state.revision += 1;
  state.clearRevision += 1;
}

export function snapshotCanonicalDrawingState(
  state: CanonicalDrawingLiveState,
  seats: DrawingState["seats"]
): DrawingState {
  const canvas = canvasFromDoc(state.doc);
  return {
    status: "playing",
    seats,
    canvas: {
      engine: "excalidraw",
      version: state.revision,
      clearVersion: state.clearRevision,
      updatedAt: Date.now(),
      elements: canvas.elements,
      files: canvas.files
    }
  };
}

export function isCanonicalDrawingDirty(state: CanonicalDrawingLiveState): boolean {
  return state.revision > state.persistedRevision;
}

export function markCanonicalDrawingPersisted(
  state: CanonicalDrawingLiveState,
  persistedRevision: number
): void {
  state.persistedRevision = Math.max(
    state.persistedRevision,
    Math.min(persistedRevision, state.revision)
  );
}
