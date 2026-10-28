/**
 * Synchronization, reconciliation, and diffing logic for collaborative drawing.
 */

export interface DrawingDelta {
  changed: any[];
  deleted: string[];
  files?: Record<string, any>;
}

/**
 * Reconcile local and remote elements based on Excalidraw's element-version rules:
 * - Keep the element with the higher `version`.
 * - If versions are equal, use `versionNonce` as a tie-breaker.
 * - Preserve deletes if version is >=.
 */
export function reconcileElements(local: any[], remote: any[]): any[] {
  const localMap = new Map<string, any>();
  for (const el of local) {
    localMap.set(el.id, el);
  }

  const mergedMap = new Map<string, any>(localMap);

  for (const rem of remote) {
    const loc = localMap.get(rem.id);
    if (!loc) {
      mergedMap.set(rem.id, rem);
    } else {
      const locVer = loc.version ?? 0;
      const remVer = rem.version ?? 0;
      if (remVer > locVer) {
        mergedMap.set(rem.id, rem);
      } else if (remVer === locVer) {
        const locNonce = loc.versionNonce ?? 0;
        const remNonce = rem.versionNonce ?? 0;
        if (remNonce > locNonce) {
          mergedMap.set(rem.id, rem);
        }
      }
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Strips volatile AppState properties that should not be synced/persisted.
 * This prevents remote viewports from hijacking a viewer's scroll or zoom.
 */
export function stripVolatileAppState(appState: any): any {
  if (!appState) return {};
  // Keep only structural/UI setting preferences, discard navigation/volatile ones
  const {
    viewBackgroundColor,
    currentItemStrokeColor,
    currentItemBackgroundColor,
    currentItemFillStyle,
    currentItemStrokeWidth,
    currentItemStrokeStyle,
    currentItemRoughness,
    currentItemOpacity,
    currentItemFontFamily,
    currentItemFontSize,
    currentItemTextAlign,
    currentItemStartArrowhead,
    currentItemEndArrowhead
  } = appState;
  
  return {
    viewBackgroundColor,
    currentItemStrokeColor,
    currentItemBackgroundColor,
    currentItemFillStyle,
    currentItemStrokeWidth,
    currentItemStrokeStyle,
    currentItemRoughness,
    currentItemOpacity,
    currentItemFontFamily,
    currentItemFontSize,
    currentItemTextAlign,
    currentItemStartArrowhead,
    currentItemEndArrowhead,
  };
}

/**
 * Helper to extract changed elements and binary files between two snapshots
 */
export function diffScene(
  prevElements: any[],
  currentElements: any[],
  prevFiles: Record<string, any>,
  currentFiles: Record<string, any>
): DrawingDelta | null {
  const prevMap = new Map<string, any>();
  for (const el of prevElements) {
    prevMap.set(el.id, el);
  }

  const changed: any[] = [];
  const deleted: string[] = [];

  for (const curr of currentElements) {
    const prev = prevMap.get(curr.id);
    if (!prev) {
      // New element
      if (curr.isDeleted) {
        deleted.push(curr.id);
      } else {
        changed.push(curr);
      }
    } else {
      // Existing element - check if version is higher or changed
      const prevVer = prev.version ?? 0;
      const currVer = curr.version ?? 0;
      if (currVer > prevVer) {
        if (curr.isDeleted) {
          deleted.push(curr.id);
        } else {
          changed.push(curr);
        }
      }
    }
  }

  // Find newly added files
  const newFiles: Record<string, any> = {};
  let hasNewFiles = false;
  for (const [fileId, fileData] of Object.entries(currentFiles)) {
    if (!prevFiles[fileId]) {
      newFiles[fileId] = fileData;
      hasNewFiles = true;
    }
  }

  if (changed.length === 0 && deleted.length === 0 && !hasNewFiles) {
    return null;
  }

  return {
    changed,
    deleted,
    ...(hasNewFiles ? { files: newFiles } : {})
  };
}
