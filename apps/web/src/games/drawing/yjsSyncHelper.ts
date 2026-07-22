import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import { ExcalidrawBinding, yjsToExcalidraw } from "y-excalidraw";

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

export function populateYElements(yElements: Y.Array<Y.Map<any>>, elements: any[]) {
  if (!elements || elements.length === 0) return;
  const sanitized = sanitizeExcalidrawElements(elements);
  const maps = sanitized.map((el, i) => {
    const map = new Y.Map<any>();
    map.set("el", el);
    map.set("pos", "a" + i.toString(36));
    return map;
  });
  yElements.push(maps);
}

export function populateYAssets(yAssets: Y.Map<any>, files: Record<string, any>) {
  if (!files) return;
  for (const [id, file] of Object.entries(files)) {
    if (file && (file as any).id) {
      yAssets.set(id, file);
    }
  }
}

export function replaceYElements(yElements: Y.Array<Y.Map<any>>, elements: any[], origin?: any) {
  const doc = yElements.doc;
  const sanitized = sanitizeExcalidrawElements(elements || []);
  const applyChange = () => {
    yElements.delete(0, yElements.length);
    if (sanitized.length > 0) {
      const maps = sanitized.map((el, i) => {
        const map = new Y.Map<any>();
        map.set("el", el);
        map.set("pos", "a" + i.toString(36));
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

export function replaceYAssets(yAssets: Y.Map<any>, files: Record<string, any>, origin?: any) {
  if (!files) return;
  const doc = yAssets.doc;
  const applyChange = () => {
    for (const [id, file] of Object.entries(files)) {
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
