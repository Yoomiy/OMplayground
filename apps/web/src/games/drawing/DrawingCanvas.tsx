import React, { Suspense, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { DrawingState } from "@playground/game-logic";
import { reconcileElements, diffScene, type DrawingDelta } from "./drawingSync";
import { compressImage, getBase64Size, MAX_FILE_SIZE_BYTES, MAX_IMAGES_PER_BOARD } from "./drawingImages";

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
  isHost
}, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  
  // Keep track of internal snapshots to avoid infinite loop echoes
  const lastElementsRef = useRef<any[]>([]);
  const lastFilesRef = useRef<Record<string, any>>({});
  const lastVersionRef = useRef<number>(0);
  
  // Track remote cursors/collaborators
  const [collaborators, setCollaborators] = useState<Map<string, any>>(new Map());
  
  // Coalescing delta buffers
  const pendingDeltaRef = useRef<DrawingDelta>({ changed: [], deleted: [] });
  const pendingFilesRef = useRef<Record<string, any>>({});
  const syncTimeoutRef = useRef<any>(null);
  
  // For dirty state / checkpoint scheduling
  const isDirtyRef = useRef<boolean>(false);
  const checkpointIntervalRef = useRef<any>(null);

  // Concurrency guard to prevent duplicate compressions of the same image file
  const processingFileIdsRef = useRef<Set<string>>(new Set());

  // Cursor throttle (50ms)
  const lastCursorEmitRef = useRef<number>(0);

  // Compute static initialData once on mount to prevent mounting lifecycle race conditions
  const initialData = useRef<any>(null);
  if (!initialData.current && gameState.canvas) {
    initialData.current = {
      elements: gameState.canvas.elements || [],
      files: gameState.canvas.files || {},
      appState: {
        viewBackgroundColor: "#ffffff"
      }
    };
  }

  // Initialize refs once the API ref is available to align with initialData mount
  useEffect(() => {
    if (excalidrawAPI && initialData.current) {
      lastElementsRef.current = initialData.current.elements || [];
      lastFilesRef.current = initialData.current.files || {};
      lastVersionRef.current = gameState.canvas?.version || 0;
    }
  }, [excalidrawAPI]);

  // Expose exportPNG function to parent via ref
  useImperativeHandle(ref, () => ({
    exportPNG: async () => {
      if (!excalidrawAPI) return;
      try {
        showToast("מכין קובץ לייצוא...");
        const elements = excalidrawAPI.getSceneElements();
        const files = excalidrawAPI.getFiles();
        const appState = excalidrawAPI.getAppState();
        
        // Dynamically import exportToBlob to preserve code splitting
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

  // Sync state from server on join / checkpoint update (authoritative replace, not reconcile)
  useEffect(() => {
    if (!excalidrawAPI || !gameState.canvas) return;
    
    const serverVersion = gameState.canvas.version;
    if (serverVersion > lastVersionRef.current) {
      const serverElements = gameState.canvas.elements || [];
      const serverFiles = gameState.canvas.files || {};
      
      const newFiles = { ...lastFilesRef.current, ...serverFiles };
      
      const filesToRegister: any[] = [];
      for (const [id, file] of Object.entries(serverFiles)) {
        if (!lastFilesRef.current[id]) filesToRegister.push(file);
      }

      lastElementsRef.current = serverElements;
      lastFilesRef.current = newFiles;
      lastVersionRef.current = serverVersion;
      
      if (filesToRegister.length > 0) {
        excalidrawAPI.addFiles(filesToRegister);
      }
      
      excalidrawAPI.updateScene({
        elements: serverElements,
        commitToHistory: false
      });
    }
  }, [excalidrawAPI, gameState.canvas]);

  // Subscribe to remote live deltas
  useEffect(() => {
    if (!subscribeLiveDeltas || !excalidrawAPI) return;

    const unsubscribe = subscribeLiveDeltas((payload) => {
      const { from, delta } = payload;
      if (from === myUserId) return; // ignore own echo

      // Handle cursor updates
      if (delta.pointer !== undefined) {
        setCollaborators((prev) => {
          const next = new Map(prev);
          next.set(from, {
            pointer: delta.pointer,
            username: delta.username || "משתתף",
            color: "#6366f1"
          });
          return next;
        });
      }

      // Handle element changes
      if (delta.changed || delta.deleted || delta.files) {
        const receivedChanged = delta.changed || [];
        const receivedDeletedIds = delta.deleted || [];
        
        // Convert deleted ids to deleted elements
        const receivedDeleted = receivedDeletedIds.map((id: string) => ({
          id,
          isDeleted: true,
          version: (lastElementsRef.current.find((e) => e.id === id)?.version || 0) + 1
        }));
        
        const updates = [...receivedChanged, ...receivedDeleted];
        const reconciled = reconcileElements(lastElementsRef.current, updates);
        
        const mergedFiles = {
          ...lastFilesRef.current,
          ...(delta.files || {})
        };
        
        // Correctly register files using addFiles
        const filesToRegister: any[] = [];
        if (delta.files) {
          for (const [id, file] of Object.entries(delta.files)) {
            if (!lastFilesRef.current[id]) {
              filesToRegister.push(file);
            }
          }
        }
        
        lastElementsRef.current = reconciled;
        lastFilesRef.current = mergedFiles;

        if (filesToRegister.length > 0) {
          excalidrawAPI.addFiles(filesToRegister);
        }
        
        excalidrawAPI.updateScene({
          elements: reconciled,
          commitToHistory: false
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeLiveDeltas, excalidrawAPI, myUserId]);

  // Cleanup remote cursors when player leaves (based on room roster changes)
  const rosterUserIds = useRef<string[]>([]);
  useEffect(() => {
    const activeIds = Object.keys(gameState.seats || {});
    rosterUserIds.current = activeIds;
    
    setCollaborators((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const key of next.keys()) {
        if (!activeIds.includes(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [gameState.seats]);

  // Periodic Checkpoint Cadence: host only, every 5s if dirty
  useEffect(() => {
    if (!isHost) return;
    checkpointIntervalRef.current = setInterval(() => {
      if (isDirtyRef.current) {
        const nextVersion = lastVersionRef.current + 1;
        onIntent({
          type: "CHECKPOINT",
          version: nextVersion,
          elements: lastElementsRef.current,
          files: lastFilesRef.current
        });
        isDirtyRef.current = false;
        lastVersionRef.current = nextVersion;
      }
    }, 5000);

    return () => {
      if (checkpointIntervalRef.current) clearInterval(checkpointIntervalRef.current);
    };
  }, [onIntent, isHost]);

  // Send local edits
  const handleLocalChange = useCallback(
    async (elements: readonly any[], _appState: any, files: any) => {
      if (!excalidrawAPI) return;

      // Filter out elements that are fully initialized and not in-progress
      const currentElements = elements.map((el) => {
        return {
          ...el
        };
      });

      // Intercept image processing
      let updatedFiles = { ...files };
      const currentFileIds = Object.keys(files);

      for (const id of currentFileIds) {
        if (!lastFilesRef.current[id] && !pendingFilesRef.current[id] && !processingFileIdsRef.current.has(id)) {
          processingFileIdsRef.current.add(id);
          const fileData = files[id];
          if (fileData && fileData.dataURL.startsWith("data:image/")) {
            // Check number of images cap
            const currentImgCount = Object.keys(lastFilesRef.current).length + Object.keys(pendingFilesRef.current).length;
            if (currentImgCount >= MAX_IMAGES_PER_BOARD) {
              showToast("הגעת למגבלת התמונות בלוח (מקסימום 10)");
              // Remove the image element
              const imageElement = currentElements.find((e) => e.type === "image" && e.fileId === id);
              if (imageElement) {
                excalidrawAPI.updateScene({
                  elements: elements.map((e) => e.id === imageElement.id ? { ...e, isDeleted: true } : e)
                });
              }
              processingFileIdsRef.current.delete(id);
              continue;
            }

            try {
              showToast("מעבד תמונה ומכווץ...");
              const compressedUrl = await compressImage(fileData.dataURL);
              const compressedSize = getBase64Size(compressedUrl);

              if (compressedSize > MAX_FILE_SIZE_BYTES) {
                showToast("התמונה גדולה מדי גם לאחר כיווץ (מקסימום 512KB)");
                // Remove the image element
                const imageElement = currentElements.find((e) => e.type === "image" && e.fileId === id);
                if (imageElement) {
                  excalidrawAPI.updateScene({
                    elements: elements.map((e) => e.id === imageElement.id ? { ...e, isDeleted: true } : e)
                  });
                }
                processingFileIdsRef.current.delete(id);
                continue;
              }

              const compressedFile = {
                ...fileData,
                dataURL: compressedUrl
              };
              updatedFiles[id] = compressedFile;
              pendingFilesRef.current[id] = compressedFile;
              processingFileIdsRef.current.delete(id);
              
              // Feed the compressed file back to Excalidraw
              excalidrawAPI.addFiles([compressedFile]);
            } catch (err) {
              console.error("Image processing failed", err);
              showToast("עיבוד התמונה נכשל");
              processingFileIdsRef.current.delete(id);
            }
          } else {
            processingFileIdsRef.current.delete(id);
          }
        }
      }

      // Check if geometry/elements changed
      const delta = diffScene(
        lastElementsRef.current,
        currentElements,
        lastFilesRef.current,
        updatedFiles
      );

      // Guard: do not emit delta while any new file is still being compressed (prevents raw image leak)
      if (delta?.files) {
        for (const id of Object.keys(delta.files)) {
          if (processingFileIdsRef.current.has(id)) {
            return; // wait for compression to finish; onChange will fire again
          }
        }
      }

      if (delta) {
        isDirtyRef.current = true;
        
        // Coalesce changes
        const changedMap = new Map<string, any>();
        for (const el of pendingDeltaRef.current.changed) {
          changedMap.set(el.id, el);
        }
        for (const el of delta.changed) {
          changedMap.set(el.id, el);
        }

        const deletedSet = new Set<string>(pendingDeltaRef.current.deleted);
        for (const id of delta.deleted) {
          deletedSet.add(id);
          changedMap.delete(id);
        }

        pendingDeltaRef.current = {
          changed: Array.from(changedMap.values()),
          deleted: Array.from(deletedSet)
        };

        if (delta.files) {
          pendingDeltaRef.current.files = {
            ...pendingDeltaRef.current.files,
            ...delta.files
          };
        }

        // Throttle emissions to ~100ms
        if (!syncTimeoutRef.current && onLiveDelta) {
          syncTimeoutRef.current = setTimeout(() => {
            if (pendingDeltaRef.current.changed.length > 0 || pendingDeltaRef.current.deleted.length > 0 || pendingDeltaRef.current.files) {
              onLiveDelta(pendingDeltaRef.current);
            }
            pendingDeltaRef.current = { changed: [], deleted: [] };
            syncTimeoutRef.current = null;
          }, 100);
        }

        // Update local memory of elements
        const reconciledLocal = reconcileElements(lastElementsRef.current, currentElements);
        lastElementsRef.current = reconciledLocal;
        lastFilesRef.current = {
          ...lastFilesRef.current,
          ...updatedFiles
        };
      }
    },
    [excalidrawAPI, onLiveDelta, showToast]
  );

  // Share user cursor (throttled)
  const handlePointerUpdate = useCallback(
    (payload: any) => {
      if (!onLiveDelta || !payload.pointer) return;
      const now = Date.now();
      if (now - lastCursorEmitRef.current < 50) return;
      lastCursorEmitRef.current = now;
      onLiveDelta({
        pointer: payload.pointer,
        username: gameState.seats?.[myUserId!] || "משתתף"
      });
    },
    [onLiveDelta, gameState.seats, myUserId]
  );

  return (
    <div className={`relative ${isFullscreen ? "h-full" : "h-[650px]"} w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner`}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="text-sm font-semibold text-slate-500">טוען לוח ציור...</p>
            </div>
          </div>
        }
      >
        <ExcalidrawComponent
          excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
          onChange={handleLocalChange}
          onPointerUpdate={handlePointerUpdate}
          collaborators={collaborators}
          theme="light"
          viewModeEnabled={mySeat === null} // Spectators cannot draw, only view
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
