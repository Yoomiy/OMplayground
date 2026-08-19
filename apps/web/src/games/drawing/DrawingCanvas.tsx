import React, { Suspense, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { DrawingState } from "@playground/game-logic";
import {
  createYjsCanvasSession,
  uint8ArrayToBase64,
  base64ToUint8Array,
  populateYElements,
  populateYAssets,
  replaceYElements,
  clearYAssets,
  deduplicateYElements,
  sanitizeExcalidrawElements,
  yjsToExcalidraw,
  ExcalidrawBinding,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
  YJS_ORIGIN_SYSTEM,
  YJS_ORIGIN_REMOTE,
  YJS_ORIGIN_LOCAL,
  Y
} from "./yjsSyncHelper";
import { isImageDataUrl, MAX_IMAGES_PER_BOARD, prepareImageForBoard } from "./drawingImages";
import { cn } from "@/lib/cn";
import type { DrawingMode } from "./drawingMode";
import {
  createLocalDrawingSnapshot,
  LocalDrawingPersistenceQueue
} from "./localDrawingPersistence";

// Import Excalidraw CSS
import "@excalidraw/excalidraw/index.css";

// Lazy load Excalidraw
const ExcalidrawLazy = React.lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw }))
);
const ExcalidrawComponent = ExcalidrawLazy as any;
const FOLLOW_HOST_VIEWPORT_BODY_CLASS = "classroom-whiteboard-following-host-focus";

export interface DrawingCanvasProps {
  gameState: DrawingState;
  mode: DrawingMode;
  mySeat: string | null;
  myUserId: string | null;
  showToast: (msg: string) => void;
  isFullscreen?: boolean;
  players?: { userId: string; displayName: string }[];
  isVisible?: boolean;
}

export interface DrawingCanvasRef {
  exportPNG: () => Promise<void>;
  clearCanvas: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  gameState,
  mode,
  mySeat,
  myUserId,
  showToast,
  isFullscreen,
  players,
  isVisible = true
}, ref) => {
  const canonicalMode = mode.kind === "canonical" ? mode : null;
  const localMode = mode.kind === "local" ? mode : null;
  const modeKind = mode.kind;
  const viewportRole = canonicalMode?.viewportRole ?? "independent";
  const subscribeCanonical = canonicalMode?.subscribe;
  const initialYjsUpdate = canonicalMode?.initialSync?.update ?? null;
  const initialYjsSyncToken = canonicalMode?.initialSync?.token ?? null;
  const initialViewport = canonicalMode?.initialViewport ?? null;
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [excalidrawSceneReady, setExcalidrawSceneReady] = useState(false);
  const [canonicalReady, setCanonicalReady] = useState(mode.kind === "local");
  const excalidrawSceneReadyRef = useRef(false);
  const interactionSurfaceRef = useRef<HTMLDivElement>(null);
  const pendingHostViewportRef = useRef<{ scrollX: number; scrollY: number; zoom: unknown } | null>(null);
  const hostViewportTimerRef = useRef<number | null>(null);

  // User details for awareness
  const myPlayer = players?.find((p) => p.userId === myUserId);
  const myDisplayName = myPlayer?.displayName || (myUserId === "solo" ? "משתתף" : mySeat ? `משתתף (${mySeat})` : "משתתף");

  type AuthoritativeYjsSession = ReturnType<typeof createYjsCanvasSession> & {
    canonicalSyncToken?: string;
  };

  const createSession = (update?: string | null, syncToken?: string | null): AuthoritativeYjsSession => {
    const session = createYjsCanvasSession("משתתף", "#6366f1");
    if (update) {
      Y.applyUpdate(session.ydoc, base64ToUint8Array(update), YJS_ORIGIN_REMOTE);
    }
    return { ...session, canonicalSyncToken: syncToken ?? undefined };
  };

  const [yjsSession, setYjsSession] = useState<AuthoritativeYjsSession>(() =>
    createSession(initialYjsUpdate, initialYjsSyncToken)
  );
  const yjsSessionRef = useRef(yjsSession);
  const authoritativeDocumentsRef = useRef(new WeakSet<object>());
  const serverSyncReadyRef = useRef(mode.kind === "local");
  const sendDeltaRef = useRef(canonicalMode?.sendDelta);
  const acknowledgeSyncRef = useRef(canonicalMode?.acknowledgeSync);
  const persistSnapshotRef = useRef(localMode?.persistSnapshot);
  const yjsDestroyTimersRef = useRef(new Map<object, number>());
  const appliedInitialSyncTokenRef = useRef(initialYjsSyncToken);

  const discardRemoteAwareness = useCallback((session: AuthoritativeYjsSession) => {
    const remoteClientIds = [...session.awareness.getStates().keys()].filter(
      (clientId) => clientId !== session.awareness.clientID
    );
    if (remoteClientIds.length > 0) {
      removeAwarenessStates(session.awareness, remoteClientIds, YJS_ORIGIN_REMOTE);
    }
  }, []);

  // DRAWING_SYNC replaces the complete canonical document after a rejected
  // mutation or clear. It is never merged with a browser-owned checkpoint.
  useEffect(() => {
    if (!canonicalMode || !initialYjsUpdate || !initialYjsSyncToken) return;
    if (appliedInitialSyncTokenRef.current === initialYjsSyncToken) return;
    try {
      serverSyncReadyRef.current = false;
      setCanonicalReady(false);
      appliedInitialSyncTokenRef.current = initialYjsSyncToken;
      // Awareness is not part of a Yjs document update. Always discard the
      // old document's remote cursors before its binding is replaced; this is
      // also a safe fallback if a stale server-side awareness ID was missed.
      discardRemoteAwareness(yjsSession);
      const replacement = createSession(initialYjsUpdate, initialYjsSyncToken);
      authoritativeDocumentsRef.current.add(replacement.ydoc);
      setYjsSession(replacement);
    } catch (err) {
      console.error("Failed to apply canonical drawing state:", err);
    }
  }, [discardRemoteAwareness, initialYjsSyncToken, initialYjsUpdate, modeKind, yjsSession]);

  useEffect(() => {
    sendDeltaRef.current = canonicalMode?.sendDelta;
    acknowledgeSyncRef.current = canonicalMode?.acknowledgeSync;
    persistSnapshotRef.current = localMode?.persistSnapshot;
  }, [canonicalMode?.acknowledgeSync, canonicalMode?.sendDelta, localMode?.persistSnapshot]);

  useEffect(() => {
    if (modeKind !== "canonical" || initialYjsSyncToken) return;
    serverSyncReadyRef.current = false;
    setCanonicalReady(false);
  }, [initialYjsSyncToken, modeKind]);

  useEffect(() => {
    yjsSessionRef.current = yjsSession;
  }, [yjsSession]);


  // Update Yjs Awareness user info dynamically when the display name changes
  useEffect(() => {
    if (!yjsSession) return;
    yjsSession.awareness.setLocalState({
      user: {
        name: myDisplayName,
        color: "#6366f1"
      }
    });
  }, [yjsSession, myDisplayName]);

  // Clean up Yjs session on component unmount
  useEffect(() => {
    const pendingDestroy = yjsDestroyTimersRef.current.get(yjsSession.ydoc);
    if (pendingDestroy !== undefined) {
      window.clearTimeout(pendingDestroy);
      yjsDestroyTimersRef.current.delete(yjsSession.ydoc);
    }
    return () => {
      const sessionToDestroy = yjsSession;
      const destroyTimer = window.setTimeout(() => {
        yjsDestroyTimersRef.current.delete(sessionToDestroy.ydoc);
        sessionToDestroy.destroy();
      }, 0);
      yjsDestroyTimersRef.current.set(sessionToDestroy.ydoc, destroyTimer);
    };
  }, [yjsSession]);

  const bindingRef = useRef<ExcalidrawBinding | null>(null);

  // Excalidraw must start from the same source as the binding. A persisted
  // checkpoint can be stale, but the initial canonical Yjs update is already
  // available before the component mounts.
  const initialData = useRef<any>(null);
  if (!initialData.current && canonicalMode) {
    initialData.current = {
      elements: sanitizeExcalidrawElements(yjsToExcalidraw(yjsSession.yElements)),
      files: Object.fromEntries(yjsSession.yAssets.entries()),
      appState: {
        viewBackgroundColor: "#ffffff"
      }
    };
  } else if (!initialData.current && gameState.canvas) {
    initialData.current = {
      elements: sanitizeExcalidrawElements(gameState.canvas.elements || []),
      files: gameState.canvas.files || {},
      appState: {
        viewBackgroundColor: "#ffffff"
      }
    };
  }

  // Bind Excalidraw API to Yjs Document
  useEffect(() => {
    if (!excalidrawAPI || !yjsSession || !excalidrawSceneReady) return;
    const { ydoc, yElements, yAssets, awareness } = yjsSession;

    // Populate initial elements into Yjs if brand new document and initial elements exist
    if (
      mode.kind === "local" &&
      yElements.length === 0 &&
      !authoritativeDocumentsRef.current.has(ydoc) &&
      initialData.current
    ) {
      if (initialData.current.elements?.length > 0) {
        populateYElements(yElements, initialData.current.elements, YJS_ORIGIN_SYSTEM);
      }
      if (initialData.current.files && Object.keys(initialData.current.files).length > 0) {
        populateYAssets(yAssets, initialData.current.files, YJS_ORIGIN_SYSTEM);
      }
    }

    // y-excalidraw normally writes every file received from Excalidraw straight
    // into Yjs. Images arrive at their original size, so that is too late to
    // compress them safely. Elements still use the binding; assets are added by
    // handleLocalChange only after they pass the board size budget.
    const elementOnlyApi = new Proxy(excalidrawAPI, {
      get(target, property, receiver) {
        if (property === "onChange") {
          return (listener: (elements: readonly any[], appState: any, files: Record<string, never>) => void) =>
            target.onChange((elements: readonly any[], appState: any) => listener(elements, appState, {}));
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
    const binding = new ExcalidrawBinding(yElements, yAssets, elementOnlyApi, awareness);
    bindingRef.current = binding;

    let readyFrame: number | undefined;
    if (canonicalMode && yjsSession.canonicalSyncToken) {
      serverSyncReadyRef.current = false;
      readyFrame = window.requestAnimationFrame(() => {
        serverSyncReadyRef.current = true;
        setCanonicalReady(true);
        if (yjsSession.canonicalSyncToken) {
          acknowledgeSyncRef.current?.(yjsSession.canonicalSyncToken);
        }
      });
    }

    return () => {
      if (readyFrame !== undefined) window.cancelAnimationFrame(readyFrame);
      binding.destroy();
      bindingRef.current = null;
    };
  }, [excalidrawAPI, excalidrawSceneReady, modeKind, yjsSession]);

  // Image compression & file count guards
  const processingFileIdsRef = useRef(new WeakMap<object, Map<string, string>>());
  const rejectedImageElementIdsRef = useRef(new Set<string>());
  const localClearVersionRef = useRef(gameState.canvas.clearVersion);
  const localPersistenceRef = useRef(new LocalDrawingPersistenceQueue());

  const handleLocalChange = useCallback(
    async (_elements: readonly any[], _appState: any, files: any) => {
      if (!excalidrawSceneReadyRef.current) {
        excalidrawSceneReadyRef.current = true;
        setExcalidrawSceneReady(true);
      }
      if (viewportRole === "publish" && _appState) {
        const zoom = typeof _appState.zoom === "number" ? _appState.zoom : _appState.zoom?.value;
        if (Number.isFinite(_appState.scrollX) && Number.isFinite(_appState.scrollY) && Number.isFinite(zoom)) {
          pendingHostViewportRef.current = {
            scrollX: _appState.scrollX,
            scrollY: _appState.scrollY,
            zoom
          };
          if (hostViewportTimerRef.current === null) {
            hostViewportTimerRef.current = window.setTimeout(() => {
              hostViewportTimerRef.current = null;
              const viewport = pendingHostViewportRef.current;
              pendingHostViewportRef.current = null;
              if (viewport) sendDeltaRef.current?.({ viewport });
            }, 80);
          }
        }
      }
      if (!excalidrawAPI || !files || !yjsSession || mySeat === null) return;
      const fileIds = Object.keys(files);
      const activeImageFileIds = new Set<string>();
      const rejectedImageFileIds = new Set<string>();
      for (const element of _elements) {
        if (element?.type !== "image" || element.isDeleted) continue;
        if (typeof element.fileId !== "string") continue;
        if (activeImageFileIds.has(element.fileId)) continue;
        if (activeImageFileIds.size < MAX_IMAGES_PER_BOARD) {
          activeImageFileIds.add(element.fileId);
        } else {
          rejectedImageFileIds.add(element.fileId);
        }
      }

      if (rejectedImageFileIds.size > 0) {
        showToast("הגעת למגבלת התמונות בלוח (מקסימום 10)");
        const newlyRejectedFileIds = [...rejectedImageFileIds].filter(
          (id) => !rejectedImageElementIdsRef.current.has(id)
        );
        newlyRejectedFileIds.forEach((id) => rejectedImageElementIdsRef.current.add(id));
        if (newlyRejectedFileIds.length > 0) {
          window.queueMicrotask(() => {
            const currentElements = excalidrawAPI.getSceneElements();
            excalidrawAPI.updateScene({
              elements: currentElements.map((element: any) =>
                newlyRejectedFileIds.includes(element.fileId)
                  ? { ...element, isDeleted: true, version: (element.version ?? 0) + 1 }
                  : element
              )
            });
          });
        }
      }

      const processingFiles = processingFileIdsRef.current.get(yjsSession.ydoc) ?? new Map<string, string>();
      processingFileIdsRef.current.set(yjsSession.ydoc, processingFiles);

      for (const id of fileIds) {
        const fileData = files[id];
        if (
          !activeImageFileIds.has(id) ||
          !fileData ||
          !isImageDataUrl(fileData.dataURL) ||
          yjsSession.yAssets.has(id)
        ) continue;
        if (processingFiles.get(id) === fileData.dataURL) continue;

        processingFiles.set(id, fileData.dataURL);
        void prepareImageForBoard(fileData.dataURL)
          .then((dataURL) => {
            if (yjsSessionRef.current !== yjsSession || yjsSession.yAssets.has(id)) return;
            if (!dataURL) {
              showToast("לא ניתן להוסיף את התמונה: היא גדולה מדי עבור הלוח");
              return;
            }
            yjsSession.ydoc.transact(() => {
              yjsSession.yAssets.set(id, { ...fileData, dataURL });
            }, YJS_ORIGIN_LOCAL);
          })
          .catch((err) => {
            console.error("Image preparation failed", err);
            showToast("לא ניתן לעבד את התמונה");
          });
      }

      // Assets are intentionally managed outside y-excalidraw's default file
      // binding. Remove assets no longer referenced by a live image so a board
      // cannot accumulate image data through repeated insert/delete cycles.
      if (bindingRef.current) {
        const staleAssetIds = [...yjsSession.yAssets.keys()].filter((id) => !activeImageFileIds.has(id));
        if (staleAssetIds.length > 0) {
          yjsSession.ydoc.transact(() => {
            staleAssetIds.forEach((id) => yjsSession.yAssets.delete(id));
          }, YJS_ORIGIN_LOCAL);
        }
      }
    },
    [excalidrawAPI, mySeat, showToast, viewportRole, yjsSession]
  );

  useEffect(() => () => {
    if (hostViewportTimerRef.current !== null) window.clearTimeout(hostViewportTimerRef.current);
  }, []);

  useEffect(() => {
    const blockInteraction = viewportRole === "follow" || (modeKind === "canonical" && !canonicalReady);
    interactionSurfaceRef.current?.toggleAttribute("inert", blockInteraction);
    document.body.classList.toggle(FOLLOW_HOST_VIEWPORT_BODY_CLASS, viewportRole === "follow");
    if (!blockInteraction) return () => document.body.classList.remove(FOLLOW_HOST_VIEWPORT_BODY_CLASS);
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && interactionSurfaceRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
    return () => document.body.classList.remove(FOLLOW_HOST_VIEWPORT_BODY_CLASS);
  }, [canonicalReady, modeKind, viewportRole]);

  // Emit local Yjs updates and Awareness changes
  useEffect(() => {
    if (!yjsSession || mySeat === null) return;
    const { ydoc, awareness } = yjsSession;

    const handleDocUpdate = (update: Uint8Array, origin: any) => {
      if (modeKind === "canonical" && !serverSyncReadyRef.current) return;
      if (modeKind === "local" && origin !== YJS_ORIGIN_SYSTEM && origin !== YJS_ORIGIN_REMOTE) {
        localPersistenceRef.current.markDirty();
      }
      // Only broadcast local user drawing edits (skip remote updates and system initializations)
      if (modeKind === "canonical" && origin !== YJS_ORIGIN_REMOTE && origin !== YJS_ORIGIN_SYSTEM) {
        sendDeltaRef.current?.({
          yjsUpdate: uint8ArrayToBase64(update)
        });
      }
    };

    const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
      if (modeKind !== "canonical" || !serverSyncReadyRef.current) return;
      if (origin !== YJS_ORIGIN_REMOTE && origin !== YJS_ORIGIN_SYSTEM) {
        const changedClients = [...added, ...updated, ...removed];
        if (changedClients.length > 0) {
          const encoded = encodeAwarenessUpdate(awareness, changedClients);
          sendDeltaRef.current?.({
            yjsAwareness: uint8ArrayToBase64(encoded),
            yjsAwarenessClientIds: changedClients
          });
        }
      }
    };

    ydoc.on("update", handleDocUpdate);
    awareness.on("update", handleAwarenessUpdate);

    return () => {
      if (modeKind === "canonical" && serverSyncReadyRef.current) {
        sendDeltaRef.current?.({ yjsAwarenessRemove: [awareness.clientID] });
      }
      ydoc.off("update", handleDocUpdate);
      awareness.off("update", handleAwarenessUpdate);
    };
  }, [modeKind, mySeat, yjsSession]);

  // Subscribe to remote live deltas and Yjs sync messages
  const lastHostViewportRef = useRef<{ scrollX: number; scrollY: number; zoom: any } | null>(null);

  useEffect(() => {
    if (!subscribeCanonical || !yjsSession) return;
    const { ydoc, yElements, awareness } = yjsSession;

    const unsubscribe = subscribeCanonical((payload) => {
      if (!payload) return;
      const delta = payload.delta || payload;

      const yjsUpdate = delta.yjsUpdate;
      const yjsAwareness = delta.yjsAwareness;
      const yjsAwarenessRemove = delta.yjsAwarenessRemove;

      // Handle Yjs document update
      if (yjsUpdate) {
        try {
          const bytes = base64ToUint8Array(yjsUpdate);
          Y.applyUpdate(ydoc, bytes, YJS_ORIGIN_REMOTE);
          deduplicateYElements(yElements);
        } catch (err) {
          console.error("Failed to apply remote Yjs update:", err);
        }
      }

      // Handle Yjs awareness update
      if (yjsAwareness) {
        try {
          const bytes = base64ToUint8Array(yjsAwareness);
          applyAwarenessUpdate(awareness, bytes, YJS_ORIGIN_REMOTE);
        } catch (err) {
          console.error("Failed to apply remote Yjs awareness:", err);
        }
      }

      if (Array.isArray(yjsAwarenessRemove)) {
        const clientIds = yjsAwarenessRemove.filter((clientId: unknown) => Number.isSafeInteger(clientId));
        if (clientIds.length > 0) {
          removeAwarenessStates(awareness, clientIds, YJS_ORIGIN_REMOTE);
        }
      }

      // Handle host viewport focus sync
      if (delta.viewport && viewportRole === "follow" && excalidrawAPI) {
        lastHostViewportRef.current = delta.viewport;
        excalidrawAPI.updateScene({
          appState: {
            scrollX: delta.viewport.scrollX,
            scrollY: delta.viewport.scrollY,
            zoom: typeof delta.viewport.zoom === "number" ? { value: delta.viewport.zoom } : delta.viewport.zoom
          },
          commitToHistory: false
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [discardRemoteAwareness, excalidrawAPI, subscribeCanonical, viewportRole, yjsSession]);

  useEffect(() => {
    if (!initialViewport || viewportRole !== "follow" || !excalidrawAPI) return;
    lastHostViewportRef.current = initialViewport;
    excalidrawAPI.updateScene({
      appState: {
        scrollX: initialViewport.scrollX,
        scrollY: initialViewport.scrollY,
        zoom: typeof initialViewport.zoom === "number" ? { value: initialViewport.zoom } : initialViewport.zoom
      },
      commitToHistory: false
    });
  }, [excalidrawAPI, initialViewport, viewportRole]);

  const persistLocalSnapshot = useCallback(() => {
    if (!localMode) return;
    void localPersistenceRef.current.flush(
      () => createLocalDrawingSnapshot(
        sanitizeExcalidrawElements(yjsToExcalidraw(yjsSession.yElements)),
        Object.fromEntries(yjsSession.yAssets.entries()),
        localClearVersionRef.current
      ),
      (snapshot) => persistSnapshotRef.current?.(snapshot)
    ).catch(() => {
        showToast("שמירת הלוח נכשלה; ננסה שוב אוטומטית");
      });
  }, [localMode, showToast, yjsSession]);

  useEffect(() => {
    if (!localMode) return;
    const interval = window.setInterval(persistLocalSnapshot, 2_000);
    return () => {
      window.clearInterval(interval);
      persistLocalSnapshot();
    };
  }, [localMode, persistLocalSnapshot]);

  // Expose exportPNG function to parent via ref
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      if (!localMode) return;
      localClearVersionRef.current += 1;
      replaceYElements(yjsSession.yElements, [], YJS_ORIGIN_LOCAL);
      clearYAssets(yjsSession.yAssets, YJS_ORIGIN_LOCAL);
      localPersistenceRef.current.markDirty();
    },
    exportPNG: async () => {
      if (!excalidrawAPI) return;
      try {
        showToast("מכין קובץ לייצוא...");
        const elements = excalidrawAPI.getSceneElements();
        const files = excalidrawAPI.getFiles();
        const appState = excalidrawAPI.getAppState();

        const { exportToBlob } = await import("@excalidraw/excalidraw");

        const blob = await exportToBlob({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: "#ffffff"
          },
          files,
          getDimensions: (width: number, height: number) => ({ width: width * 1.5, height: height * 1.5 })
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `whiteboard-${Date.now()}.png`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("הקובץ יוצא בהצלחה!");
      } catch (err) {
        console.error("Export failed", err);
        showToast("ייצוא הקובץ נכשל");
      }
    }
  }), [excalidrawAPI, localMode, showToast, yjsSession]);

  // Handle pointer update from Excalidraw component
  const handlePointerUpdate = useCallback(
    (payload: any) => {
      if (bindingRef.current) {
        bindingRef.current.onPointerUpdate(payload);
      }
    },
    []
  );

  const setExcalidrawAPISafely = useCallback((api: any) => {
    if (!api) {
      setExcalidrawAPI(null);
      return;
    }
    // Read-only viewers do not necessarily trigger Excalidraw's onChange
    // callback on mount. Mark the scene ready when the API is available so
    // the Yjs binding is attached before the first remote drawing delta.
    if (!excalidrawSceneReadyRef.current) {
      excalidrawSceneReadyRef.current = true;
      setExcalidrawSceneReady(true);
    }
    // Wrap addFiles
    if (api.addFiles && !api._isWrappedAddFiles) {
      const origAddFiles = api.addFiles.bind(api);
      api.addFiles = (files: any) => {
        let fileList: any[] = [];
        if (Array.isArray(files)) {
          fileList = files;
        } else if (files && typeof files === "object") {
          fileList = Object.values(files);
        }
        const validFiles = fileList.filter((f) => f && typeof f === "object" && typeof f.id === "string");
        if (validFiles.length > 0) {
          origAddFiles(validFiles);
        }
      };
      api._isWrappedAddFiles = true;
    }

    // Wrap updateScene
    if (api.updateScene && !api._isWrappedUpdateScene) {
      const origUpdateScene = api.updateScene.bind(api);
      api.updateScene = (opts: any) => {
        if (opts && Array.isArray(opts.elements)) {
          opts = {
            ...opts,
            elements: sanitizeExcalidrawElements(opts.elements)
          };
        }
        origUpdateScene(opts);
      };
      api._isWrappedUpdateScene = true;
    }

    setExcalidrawAPI(api);
  }, []);

  // Excalidraw caches its container's viewport offsets. A board kept mounted
  // under display:none retains the old offset after the classroom camera area
  // expands and contracts, so pointer input lands above the cursor. Refresh
  // once after reveal and again after the 300ms classroom layout transition.
  useEffect(() => {
    if (!isVisible || !excalidrawAPI?.refresh) return;
    const frame = window.requestAnimationFrame(() => excalidrawAPI.refresh());
    const transitionTimer = window.setTimeout(() => excalidrawAPI.refresh(), 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(transitionTimer);
    };
  }, [excalidrawAPI, isVisible]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/20 shadow-inner",
        isFullscreen ? "h-full" : "h-[650px]",
        mySeat === null && "drawing-read-only",
        (viewportRole === "follow" || (modeKind === "canonical" && !canonicalReady)) && "drawing-interaction-blocked"
      )}
    >
      <style>{`
        /* Remove report/feedback button */
        #feedback-trigger-btn,
        button#feedback-trigger-btn,
        .excalidraw #feedback-trigger-btn,
        .excalidraw .help-icon,
        .excalidraw button[aria-label*="feedback"],
        .excalidraw button[aria-label*="Feedback"],
        .excalidraw button[title*="feedback"],
        .excalidraw button[title*="Feedback"],
        .excalidraw [aria-label*="report"],
        .excalidraw [aria-label*="Report"],
        .excalidraw .excalidraw-feedback-button {
          display: none !important;
        }

        /* Remove .dropdown-menu-button for participants without board privileges */
        .drawing-read-only .dropdown-menu-button {
          display: none !important;
        }

        /* Followers receive the host viewport and must not pan or zoom locally. */
        .drawing-interaction-blocked .excalidraw-interaction-surface {
          pointer-events: none;
          touch-action: none;
          user-select: none;
        }

        .drawing-interaction-blocked .zoom-actions,
        .${FOLLOW_HOST_VIEWPORT_BODY_CLASS} .zoom-actions,
        .${FOLLOW_HOST_VIEWPORT_BODY_CLASS} .zoom-in-button,
        .${FOLLOW_HOST_VIEWPORT_BODY_CLASS} .zoom-out-button,
        .${FOLLOW_HOST_VIEWPORT_BODY_CLASS} .reset-zoom-button {
          display: none !important;
          pointer-events: none !important;
        }
      `}</style>

      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-950/40 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="text-sm font-semibold text-white/55">טוען לוח ציור...</p>
            </div>
          </div>
        }
      >
        <div
          ref={interactionSurfaceRef}
          className="excalidraw-interaction-surface h-full w-full"
        >
          <ExcalidrawComponent
            excalidrawAPI={setExcalidrawAPISafely}
            onChange={handleLocalChange}
            onPointerUpdate={handlePointerUpdate}
            theme="light"
            autoFocus={false}
            handleKeyboardGlobally={false}
            viewModeEnabled={mySeat === null}
            initialData={initialData.current}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false
              }
            }}
          />
        </div>
      </Suspense>
    </div>
  );
});

DrawingCanvas.displayName = "DrawingCanvas";
