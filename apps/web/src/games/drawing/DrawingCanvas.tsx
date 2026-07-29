import React, { Suspense, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { DrawingState } from "@playground/game-logic";
import {
  createYjsCanvasSession,
  uint8ArrayToBase64,
  base64ToUint8Array,
  encodeYjsStateAsUpdate,
  populateYElements,
  populateYAssets,
  replaceYElements,
  replaceYAssets,
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
import { compressImage, isImageDataUrl, MAX_IMAGES_PER_BOARD, prepareImageForBoard } from "./drawingImages";
import { cn } from "@/lib/cn";

// Import Excalidraw CSS
import "@excalidraw/excalidraw/index.css";

// Lazy load Excalidraw
const ExcalidrawLazy = React.lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw }))
);
const ExcalidrawComponent = ExcalidrawLazy as any;

export interface DrawingCanvasProps {
  gameState: DrawingState;
  mySeat: string | null;
  myUserId: string | null;
  onIntent: (intent: any) => void;
  onLiveDelta?: (payload: any) => void;
  subscribeLiveDeltas?: (cb: (payload: any) => void) => () => void;
  showToast: (msg: string) => void;
  isFullscreen?: boolean;
  isHost?: boolean;
  checkpointSignal?: number;
  serverAuthoritative?: boolean;
  initialYjsUpdate?: string | null;
  initialYjsSyncToken?: string | null;
  players?: { userId: string; displayName: string }[];
}

export interface DrawingCanvasRef {
  exportPNG: () => Promise<void>;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  gameState,
  mySeat,
  myUserId,
  onIntent,
  onLiveDelta,
  subscribeLiveDeltas,
  showToast,
  isFullscreen,
  isHost,
  checkpointSignal,
  serverAuthoritative = false,
  initialYjsUpdate,
  initialYjsSyncToken,
  players
}, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [excalidrawSceneReady, setExcalidrawSceneReady] = useState(false);
  const excalidrawSceneReadyRef = useRef(false);

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
  const serverSyncReadyRef = useRef(!serverAuthoritative);
  const onLiveDeltaRef = useRef(onLiveDelta);
  const isHostRef = useRef(Boolean(isHost));
  const yjsDestroyTimersRef = useRef(new Map<object, number>());

  useEffect(() => {
    onLiveDeltaRef.current = onLiveDelta;
  }, [onLiveDelta]);

  useEffect(() => {
    yjsSessionRef.current = yjsSession;
  }, [yjsSession]);

  useEffect(() => {
    isHostRef.current = Boolean(isHost);
  }, [isHost]);

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
  if (!initialData.current && serverAuthoritative) {
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
      !serverAuthoritative &&
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
    if (serverAuthoritative) {
      serverSyncReadyRef.current = false;
      readyFrame = window.requestAnimationFrame(() => {
        serverSyncReadyRef.current = true;
        if (yjsSession.canonicalSyncToken) {
          onLiveDeltaRef.current?.({ yjsCanonicalSyncAck: yjsSession.canonicalSyncToken });
        }
      });
    }

    return () => {
      if (readyFrame !== undefined) window.cancelAnimationFrame(readyFrame);
      binding.destroy();
      bindingRef.current = null;
    };
  }, [excalidrawAPI, excalidrawSceneReady, serverAuthoritative, yjsSession]);

  // A late joiner can have an empty stale checkpoint. Only an authoritative
  // clear revision is allowed to erase a populated local document.
  const lastVersionRef = useRef<number>(gameState.canvas?.version || 0);
  const lastClearVersionRef = useRef<number>(gameState.canvas?.clearVersion || 0);
  useEffect(() => {
    if (serverAuthoritative || !gameState.canvas || !yjsSession) return;
    const { yElements, yAssets } = yjsSession;

    const serverVersion = gameState.canvas.version ?? 0;
    const serverClearVersion = gameState.canvas.clearVersion ?? 0;
    if (serverVersion > lastVersionRef.current) {
      lastVersionRef.current = serverVersion;
      const serverElements = gameState.canvas.elements || [];
      const serverFiles = gameState.canvas.files || {};

      if (serverClearVersion > lastClearVersionRef.current) {
        lastClearVersionRef.current = serverClearVersion;
        replaceYElements(yElements, [], YJS_ORIGIN_SYSTEM);
        clearYAssets(yAssets, YJS_ORIGIN_SYSTEM);
      } else if (yElements.length === 0 && serverElements.length > 0) {
        replaceYElements(yElements, serverElements, YJS_ORIGIN_SYSTEM);
        replaceYAssets(yAssets, serverFiles, YJS_ORIGIN_SYSTEM);
      }
    }
  }, [gameState.canvas, serverAuthoritative, yjsSession]);

  // Image compression & file count guards
  const processingFileIdsRef = useRef(new WeakMap<object, Map<string, string>>());
  const rejectedImageElementIdsRef = useRef(new Set<string>());
  const boardDirtyRef = useRef(false);

  const handleLocalChange = useCallback(
    async (_elements: readonly any[], _appState: any, files: any) => {
      if (!excalidrawSceneReadyRef.current) {
        excalidrawSceneReadyRef.current = true;
        setExcalidrawSceneReady(true);
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
    [excalidrawAPI, mySeat, showToast, yjsSession]
  );

  // Emit local Yjs updates and Awareness changes
  useEffect(() => {
    if (!yjsSession || !onLiveDelta || mySeat === null) return;
    const { ydoc, awareness } = yjsSession;

    const handleDocUpdate = (update: Uint8Array, origin: any) => {
      if (serverAuthoritative && !serverSyncReadyRef.current) return;
      if (!serverAuthoritative && isHostRef.current && origin !== YJS_ORIGIN_SYSTEM) {
        boardDirtyRef.current = true;
      }
      // Only broadcast local user drawing edits (skip remote updates and system initializations)
      if (origin !== YJS_ORIGIN_REMOTE && origin !== YJS_ORIGIN_SYSTEM) {
        onLiveDelta({
          yjsUpdate: uint8ArrayToBase64(update)
        });
      }
    };

    const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
      if (serverAuthoritative && !serverSyncReadyRef.current) return;
      if (origin !== YJS_ORIGIN_REMOTE && origin !== YJS_ORIGIN_SYSTEM) {
        const changedClients = [...added, ...updated, ...removed];
        if (changedClients.length > 0) {
          const encoded = encodeAwarenessUpdate(awareness, changedClients);
          onLiveDelta({
            yjsAwareness: uint8ArrayToBase64(encoded),
            yjsAwarenessClientIds: changedClients
          });
        }
      }
    };

    ydoc.on("update", handleDocUpdate);
    awareness.on("update", handleAwarenessUpdate);

    return () => {
      if (!serverAuthoritative || serverSyncReadyRef.current) {
        onLiveDelta({ yjsAwarenessRemove: [awareness.clientID] });
      }
      ydoc.off("update", handleDocUpdate);
      awareness.off("update", handleAwarenessUpdate);
    };
  }, [mySeat, yjsSession, onLiveDelta]);

  // Subscribe to remote live deltas and Yjs sync messages
  const lastHostViewportRef = useRef<{ scrollX: number; scrollY: number; zoom: any } | null>(null);

  useEffect(() => {
    if (!subscribeLiveDeltas || !yjsSession) return;
    const { ydoc, yElements, awareness } = yjsSession;

    // Non-classroom boards retain their peer-sync compatibility path.
    if (!serverAuthoritative && onLiveDelta && !authoritativeDocumentsRef.current.has(ydoc)) {
      onLiveDelta({ yjsSyncRequest: true });
    }

    const unsubscribe = subscribeLiveDeltas((payload) => {
      if (!payload) return;
      const fromSocketId = payload.fromSocketId;

      const delta = payload.delta || payload;

      const yjsUpdate = delta.yjsUpdate;
      const yjsAwareness = delta.yjsAwareness;
      const yjsSyncRequest = delta.yjsSyncRequest;
      const yjsSyncResponse = delta.yjsSyncResponse;
      const yjsSyncFullState = delta.yjsSyncFullState === true;
      const yjsServerSync = delta.yjsServerSync;
      const yjsAwarenessRemove = delta.yjsAwarenessRemove;
      const targetUserId = delta.targetUserId;
      const targetSocketId = delta.targetSocketId;

      if (serverAuthoritative && typeof yjsServerSync === "string") {
        try {
          if (serverSyncReadyRef.current && onLiveDelta) {
            onLiveDelta({ yjsAwarenessRemove: [yjsSession.awareness.clientID] });
          }
          serverSyncReadyRef.current = false;
          const replacement = createSession(yjsServerSync, delta.yjsServerSyncToken);
          authoritativeDocumentsRef.current.add(replacement.ydoc);
          setYjsSession(replacement);
        } catch (err) {
          console.error("Failed to apply canonical classroom Yjs state:", err);
        }
        return;
      }

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

      // Handle a late joiner's sync request from the host's current document.
      // The host is the sole source for a late joiner's Yjs document. A viewer
      // may have reconstructed an older checkpoint and must not overwrite it.
      if (!serverAuthoritative && yjsSyncRequest && onLiveDelta && isHost) {
        const stateUpdate = encodeYjsStateAsUpdate(ydoc);
        onLiveDelta({
          targetSocketId: fromSocketId,
          yjsSyncResponse: stateUpdate,
          yjsSyncFullState: true
        });
      }

      // Handle sync response containing missing Yjs updates
      if (!serverAuthoritative && yjsSyncResponse && (targetSocketId || targetUserId === myUserId || !targetUserId)) {
        try {
          const bytes = base64ToUint8Array(yjsSyncResponse);
          if (yjsSyncFullState) {
            const replacement = createYjsCanvasSession("משתתף", "#6366f1");
            Y.applyUpdate(replacement.ydoc, bytes, YJS_ORIGIN_REMOTE);
            authoritativeDocumentsRef.current.add(replacement.ydoc);
            setYjsSession(replacement);
          } else {
            Y.applyUpdate(ydoc, bytes, YJS_ORIGIN_REMOTE);
            deduplicateYElements(yElements);
          }
        } catch (err) {
          console.error("Failed to apply Yjs sync response:", err);
        }
      }

      // Handle host viewport focus sync
      if (delta.viewport && !isHost && excalidrawAPI) {
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
  }, [subscribeLiveDeltas, myUserId, isHost, excalidrawAPI, onLiveDelta, serverAuthoritative, yjsSession]);

  const publishCheckpoint = useCallback(async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const rawFiles = excalidrawAPI.getFiles() || {};
    const sanitized = sanitizeExcalidrawElements(elements);
    const referencedFileIds = new Set(
      sanitized.filter((el: any) => el && el.type === "image" && el.fileId).map((el: any) => el.fileId)
    );
    const files: Record<string, any> = {};
    for (const fileId of referencedFileIds) {
      const fileData = rawFiles[fileId];
      if (!fileData) continue;
      if (fileData.dataURL?.startsWith("data:image/") && fileData.dataURL.length > 50000) {
        try {
          const compressedUrl = await compressImage(fileData.dataURL);
          files[fileId] = { ...fileData, dataURL: compressedUrl };
        } catch {
          files[fileId] = fileData;
        }
      } else {
        files[fileId] = fileData;
      }
    }
    onIntent({
      type: "CHECKPOINT",
      version: Date.now(),
      elements: sanitized,
      files
    });
  }, [excalidrawAPI, onIntent]);

  // Persist an active board periodically, without writing idle classrooms.
  useEffect(() => {
    if (serverAuthoritative || !isHost) return;
    const interval = setInterval(async () => {
      if (excalidrawAPI && boardDirtyRef.current) {
        boardDirtyRef.current = false;
        void publishCheckpoint();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [serverAuthoritative, isHost, excalidrawAPI, publishCheckpoint]);

  const lastCheckpointSignalRef = useRef(0);
  useEffect(() => {
    if (serverAuthoritative || !isHost || !checkpointSignal || checkpointSignal === lastCheckpointSignalRef.current) return;
    lastCheckpointSignalRef.current = checkpointSignal;
    boardDirtyRef.current = false;
    void publishCheckpoint();
  }, [checkpointSignal, serverAuthoritative, isHost, publishCheckpoint]);

  useEffect(() => {
    if (serverAuthoritative || !isHost || !excalidrawAPI) return;
    return () => {
      if (!boardDirtyRef.current) return;
      boardDirtyRef.current = false;
      void publishCheckpoint();
    };
  }, [serverAuthoritative, isHost, excalidrawAPI, publishCheckpoint]);

  // Expose exportPNG function to parent via ref
  useImperativeHandle(ref, () => ({
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
  }));

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

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/20 shadow-inner",
        isFullscreen ? "h-full" : "h-[650px]",
        mySeat === null && "no-board-privileges"
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
        .no-board-privileges .dropdown-menu-button {
          display: none !important;
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
      </Suspense>
    </div>
  );
});

DrawingCanvas.displayName = "DrawingCanvas";
