import React, { Suspense, useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import type { DrawingState } from "@playground/game-logic";
import {
  createYjsCanvasSession,
  uint8ArrayToBase64,
  base64ToUint8Array,
  populateYElements,
  populateYAssets,
  replaceYElements,
  replaceYAssets,
  sanitizeExcalidrawElements,
  ExcalidrawBinding,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  Y
} from "./yjsSyncHelper";
import { compressImage, MAX_IMAGES_PER_BOARD } from "./drawingImages";
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
  players
}, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // User details for awareness
  const myPlayer = players?.find((p) => p.userId === myUserId);
  const myDisplayName = myPlayer?.displayName || (myUserId === "solo" ? "משתתף" : mySeat ? `משתתף (${mySeat})` : "משתתף");

  // Create Yjs Session instance using useMemo so it stays alive across renders
  const yjsSession = useMemo(() => {
    return createYjsCanvasSession(myDisplayName, "#6366f1");
  }, [myDisplayName]);

  // Clean up Yjs session on component unmount
  useEffect(() => {
    return () => {
      yjsSession.destroy();
    };
  }, [yjsSession]);

  const bindingRef = useRef<ExcalidrawBinding | null>(null);

  // Compute static initialData once on mount
  const initialData = useRef<any>(null);
  if (!initialData.current && gameState.canvas) {
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
    if (!excalidrawAPI || !yjsSession) return;
    const { yElements, yAssets, awareness } = yjsSession;

    // Populate initial elements into Yjs if brand new document and initial elements exist
    if (yElements.length === 0 && initialData.current) {
      if (initialData.current.elements?.length > 0) {
        populateYElements(yElements, initialData.current.elements);
      }
      if (initialData.current.files && Object.keys(initialData.current.files).length > 0) {
        populateYAssets(yAssets, initialData.current.files);
      }
    }

    const binding = new ExcalidrawBinding(yElements, yAssets, excalidrawAPI, awareness);
    bindingRef.current = binding;

    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
  }, [excalidrawAPI, yjsSession]);

  // Sync state from server on join / checkpoint update / clear canvas
  const lastVersionRef = useRef<number>(gameState.canvas?.version || 0);
  useEffect(() => {
    if (!gameState.canvas || !yjsSession) return;
    const { yElements, yAssets } = yjsSession;

    const serverVersion = gameState.canvas.version ?? 0;
    if (serverVersion > lastVersionRef.current) {
      lastVersionRef.current = serverVersion;
      const serverElements = gameState.canvas.elements || [];
      const serverFiles = gameState.canvas.files || {};

      replaceYElements(yElements, serverElements, bindingRef.current);
      replaceYAssets(yAssets, serverFiles, bindingRef.current);
    }
  }, [gameState.canvas, yjsSession]);

  // Image compression & file count guards
  const processingFileIdsRef = useRef<Set<string>>(new Set());

  const handleLocalChange = useCallback(
    async (_elements: readonly any[], _appState: any, files: any) => {
      if (!excalidrawAPI || !files) return;
      const fileIds = Object.keys(files);
      const currentImgCount = fileIds.length;

      if (currentImgCount > MAX_IMAGES_PER_BOARD) {
        showToast("הגעת למגבלת התמונות בלוח (מקסימום 10)");
      }

      for (const id of fileIds) {
        if (!processingFileIdsRef.current.has(id)) {
          processingFileIdsRef.current.add(id);
          const fileData = files[id];
          if (fileData && fileData.dataURL?.startsWith("data:image/")) {
            try {
              const compressedUrl = await compressImage(fileData.dataURL);
              if (compressedUrl && compressedUrl !== fileData.dataURL) {
                excalidrawAPI.addFiles([{ ...fileData, dataURL: compressedUrl }]);
              }
            } catch (err) {
              console.error("Compression failed", err);
            }
          }
        }
      }
    },
    [excalidrawAPI, showToast]
  );

  // Emit local Yjs updates and Awareness changes
  useEffect(() => {
    if (!yjsSession || !onLiveDelta) return;
    const { ydoc, awareness } = yjsSession;

    const handleDocUpdate = (update: Uint8Array, origin: any) => {
      if (origin !== "remote") {
        onLiveDelta({
          yjsUpdate: uint8ArrayToBase64(update)
        });
      }
    };

    const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
      if (origin !== "remote") {
        const changedClients = [...added, ...updated, ...removed];
        if (changedClients.length > 0) {
          const encoded = encodeAwarenessUpdate(awareness, changedClients);
          onLiveDelta({
            yjsAwareness: uint8ArrayToBase64(encoded)
          });
        }
      }
    };

    ydoc.on("update", handleDocUpdate);
    awareness.on("update", handleAwarenessUpdate);

    return () => {
      ydoc.off("update", handleDocUpdate);
      awareness.off("update", handleAwarenessUpdate);
    };
  }, [yjsSession, onLiveDelta]);

  // Subscribe to remote live deltas and Yjs sync messages
  const lastHostViewportRef = useRef<{ scrollX: number; scrollY: number; zoom: any } | null>(null);

  useEffect(() => {
    if (!subscribeLiveDeltas || !yjsSession) return;
    const { ydoc, awareness } = yjsSession;

    // Request initial Yjs state sync from connected peers upon joining
    if (onLiveDelta) {
      onLiveDelta({ yjsSyncRequest: true });
    }

    const unsubscribe = subscribeLiveDeltas((payload) => {
      if (!payload) return;
      const from = payload.from;
      if (from === myUserId) return; // ignore own echo

      const delta = payload.delta || payload;

      const yjsUpdate = delta.yjsUpdate;
      const yjsAwareness = delta.yjsAwareness;
      const yjsSyncRequest = delta.yjsSyncRequest;
      const yjsSyncResponse = delta.yjsSyncResponse;
      const targetUserId = delta.targetUserId;

      // Handle Yjs document update
      if (yjsUpdate) {
        try {
          const bytes = base64ToUint8Array(yjsUpdate);
          Y.applyUpdate(ydoc, bytes, "remote");
        } catch (err) {
          console.error("Failed to apply remote Yjs update:", err);
        }
      }

      // Handle Yjs awareness update
      if (yjsAwareness) {
        try {
          const bytes = base64ToUint8Array(yjsAwareness);
          applyAwarenessUpdate(awareness, bytes, "remote");
        } catch (err) {
          console.error("Failed to apply remote Yjs awareness:", err);
        }
      }

      // Handle sync request from late joiner
      if (yjsSyncRequest && isHost && onLiveDelta) {
        const stateUpdate = Y.encodeStateAsUpdate(ydoc);
        onLiveDelta({
          targetUserId: from,
          yjsSyncResponse: uint8ArrayToBase64(stateUpdate)
        });
      }

      // Handle sync response containing full Yjs document snapshot
      if (yjsSyncResponse && (targetUserId === myUserId || !targetUserId)) {
        try {
          const bytes = base64ToUint8Array(yjsSyncResponse);
          Y.applyUpdate(ydoc, bytes, "remote");
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
  }, [subscribeLiveDeltas, myUserId, isHost, excalidrawAPI, onLiveDelta, yjsSession]);

  // Periodic Checkpoint Cadence: host only, every 5s
  useEffect(() => {
    if (!isHost) return;
    const interval = setInterval(() => {
      if (excalidrawAPI) {
        const elements = excalidrawAPI.getSceneElements();
        const files = excalidrawAPI.getFiles();
        onIntent({
          type: "CHECKPOINT",
          version: Date.now(),
          elements: sanitizeExcalidrawElements(elements),
          files
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [onIntent, isHost, excalidrawAPI]);

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
