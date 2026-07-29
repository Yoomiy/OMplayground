import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import { ExcalidrawBinding, yjsToExcalidraw } from "y-excalidraw";
import { generateNKeysBetween } from "fractional-indexing";

export const YJS_ORIGIN_SYSTEM = "system";
export const YJS_ORIGIN_REMOTE = "remote";
export const YJS_ORIGIN_LOCAL = "local";

export function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = "";
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeYjsStateVector(ydoc: Y.Doc): string {
  const sv = Y.encodeStateVector(ydoc);
  return uint8ArrayToBase64(sv);
}

export function encodeYjsStateAsUpdate(ydoc: Y.Doc, targetStateVectorBase64?: string): string {
  const sv = targetStateVectorBase64 ? base64ToUint8Array(targetStateVectorBase64) : undefined;
  const update = Y.encodeStateAsUpdate(ydoc, sv);
  return uint8ArrayToBase64(update);
}

export function sanitizeExcalidrawElements(elements: any[]): any[] {
  if (!Array.isArray(elements)) return [];
  const seenIds = new Set<string>();
  const seenIndices = new Set<string>();
  const sanitized: any[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object" || !el.id) continue;
    if (seenIds.has(el.id)) continue;
    seenIds.add(el.id);

    const cleanEl = { ...el };
    if (cleanEl.fractionalIndex) {
      if (seenIndices.has(cleanEl.fractionalIndex)) {
        delete cleanEl.fractionalIndex;
      } else {
        seenIndices.add(cleanEl.fractionalIndex);
      }
    }
    sanitized.push(cleanEl);
  }
  return sanitized;
}

export function deduplicateYElements(yElements: Y.Array<Y.Map<any>>) {
  if (!yElements || yElements.length <= 1) return;
  const doc = yElements.doc;
  const seenIds = new Set<string>();
  const indicesToDelete: number[] = [];

  for (let i = 0; i < yElements.length; i++) {
    const map = yElements.get(i);
    const el = map?.get("el");
    const id = el?.id;
    if (!id) continue;
    if (seenIds.has(id)) {
      indicesToDelete.push(i);
    } else {
      seenIds.add(id);
    }
  }

  if (indicesToDelete.length > 0) {
    const applyDelete = () => {
      for (let i = indicesToDelete.length - 1; i >= 0; i--) {
        yElements.delete(indicesToDelete[i], 1);
      }
    };
    if (doc) {
      doc.transact(applyDelete, YJS_ORIGIN_SYSTEM);
    } else {
      applyDelete();
    }
  }
}

export function populateYElements(yElements: Y.Array<Y.Map<any>>, elements: any[], origin: any = YJS_ORIGIN_SYSTEM) {
  if (!elements || elements.length === 0) return;
  const doc = yElements.doc;
  const sanitized = sanitizeExcalidrawElements(elements);
  const positions = generateNKeysBetween(null, null, sanitized.length);
  const applyChange = () => {
    const maps = sanitized.map((el, i) => {
      const map = new Y.Map<any>();
      map.set("el", el);
      map.set("pos", positions[i]);
      return map;
    });
    yElements.push(maps);
  };
  if (doc) {
    doc.transact(applyChange, origin);
  } else {
    applyChange();
  }
  deduplicateYElements(yElements);
}

export function populateYAssets(yAssets: Y.Map<any>, files: Record<string, any>, origin: any = YJS_ORIGIN_SYSTEM) {
  if (!files) return;
  const doc = yAssets.doc;
  const applyChange = () => {
    for (const [id, file] of Object.entries(files)) {
      if (file && (file as any).id) {
        yAssets.set(id, file);
      }
    }
  };
  if (doc) {
    doc.transact(applyChange, origin);
  } else {
    applyChange();
  }
}

export function replaceYElements(yElements: Y.Array<Y.Map<any>>, elements: any[], origin: any = YJS_ORIGIN_SYSTEM) {
  const doc = yElements.doc;
  const sanitized = sanitizeExcalidrawElements(elements || []);
  const positions = sanitized.length > 0 ? generateNKeysBetween(null, null, sanitized.length) : [];
  const applyChange = () => {
    yElements.delete(0, yElements.length);
    if (sanitized.length > 0) {
      const maps = sanitized.map((el, i) => {
        const map = new Y.Map<any>();
        map.set("el", el);
        map.set("pos", positions[i]);
        return map;
      });
      yElements.push(maps);
    }
  };
  if (doc) {
    doc.transact(applyChange, origin);
  } else {
    applyChange();
  }
}

export function replaceYAssets(yAssets: Y.Map<any>, files: Record<string, any>, origin: any = YJS_ORIGIN_SYSTEM) {
  const doc = yAssets.doc;
  const applyChange = () => {
    yAssets.clear();
    for (const [id, file] of Object.entries(files || {})) {
      if (file && (file as any).id) {
        const existing = yAssets.get(id);
        if (!existing || existing.dataURL !== (file as any).dataURL) {
          yAssets.set(id, file);
        }
      }
    }
  };
  if (doc) {
    doc.transact(applyChange, origin);
  } else {
    applyChange();
  }
}

export function clearYAssets(yAssets: Y.Map<any>, origin: any = YJS_ORIGIN_SYSTEM) {
  const doc = yAssets.doc;
  const clear = () => yAssets.clear();
  if (doc) {
    doc.transact(clear, origin);
  } else {
    clear();
  }
}

export interface YjsCanvasSession {
  ydoc: Y.Doc;
  yElements: Y.Array<Y.Map<any>>;
  yAssets: Y.Map<any>;
  awareness: Awareness;
  destroy: () => void;
}

export function createYjsCanvasSession(
  displayName: string,
  userColor = "#6366f1"
): YjsCanvasSession {
  const ydoc = new Y.Doc();
  const yElements = ydoc.getArray<Y.Map<any>>("elements");
  const yAssets = ydoc.getMap<any>("assets");
  const awareness = new Awareness(ydoc);

  awareness.setLocalState({
    user: {
      name: displayName,
      color: userColor,
    },
  });

  return {
    ydoc,
    yElements,
    yAssets,
    awareness,
    destroy: () => {
      awareness.destroy();
      ydoc.destroy();
    },
  };
}

export { yjsToExcalidraw, ExcalidrawBinding, encodeAwarenessUpdate, applyAwarenessUpdate, Y, Awareness };
