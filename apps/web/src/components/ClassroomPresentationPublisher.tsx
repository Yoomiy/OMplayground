import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from "@zip.js/zip.js";
import { Track, VideoPreset, type Room } from "livekit-client";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Maximize2,
  Music,
  Presentation,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  Video,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  CLASSROOM_MEDIA_TTL_MS,
  clearClassroomLibrary,
  defaultMaterialViewState,
  hasClassroomMediaStorageCapacity,
  loadClassroomLibrary,
  purgeExpiredClassroomMedia,
  removeClassroomMaterial,
  saveClassroomLibraryState,
  saveClassroomMaterial,
  type ClassroomMaterialRecord,
  type ClassroomMaterialViewState,
  type ClassroomMediaKind,
  type DocumentSourceFormat
} from "@/lib/classroomMediaLibrary";
import {
  clampDocumentScroll,
  clampPresentationViewport,
  documentPageAt,
  presentationCanvasSize,
  presentationFitHeightZoom,
  presentationFitWidthZoom,
  presentationPageStride,
  scrollDocumentByPixels,
  zoomPresentationAt,
  type PresentationSurfaceDimensions,
  type PresentationViewport
} from "./presentationViewport";

interface PresentationSnapshot {
  ready: boolean;
  hasMedia: boolean;
  published: boolean;
  title: string | null;
  kind: ClassroomMediaKind | null;
}

export interface ClassroomMediaUploadStatus {
  state: "preparing" | "success" | "error";
  message: string;
}

interface Props {
  room: Room | null;
  roomCode: string;
  sessionId: string;
  canPresent: boolean;
  visible: boolean;
  presenterEpoch: number;
  presenterToken: string | null;
  classroomRequest: (path: string, body: Record<string, unknown>) => Promise<Response>;
  onPresentationChange: (snapshot: PresentationSnapshot) => void;
  onUploadStatus: (status: ClassroomMediaUploadStatus) => void;
  canSendToWhiteboard: boolean;
  onSendPageToWhiteboard: (page: Blob, title: string) => Promise<boolean>;
  onRequestHidden: () => void;
  onError: (message: string) => void;
  showBoard: boolean;
  presentationPercent: number;
}

export interface ClassroomPresentationPublisherHandle {
  openMaterialPicker: () => void;
}

interface RuntimeDocument {
  materialId: string;
  reader: ZipReader<Blob>;
  entries: Map<string, Entry>;
  pages: Map<number, { image: HTMLImageElement; blob: Blob; url: string; lastUsed: number }>;
  loadingPages: Map<number, Promise<void>>;
}

const VIDEO_PUBLISH_OPTIONS = {
  source: Track.Source.ScreenShare,
  stream: "classroom-presentation",
  videoCodec: "h264" as const,
  simulcast: true,
  screenShareEncoding: { maxBitrate: 10_000_000, maxFramerate: 60 },
  screenShareSimulcastLayers: [
    new VideoPreset(640, 360, 1_500_000, 24),
    new VideoPreset(1280, 720, 6_000_000, 45)
  ]
};

const DOCUMENT_PUBLISH_OPTIONS = {
  ...VIDEO_PUBLISH_OPTIONS,
  screenShareEncoding: { maxBitrate: 14_000_000, maxFramerate: 30 }
};

const DOCUMENT_WIDTH = 2560;
const DOCUMENT_HEIGHT = 1440;
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const DOCUMENT_CELL_SCALE = 0.9;
const DOCUMENT_PAGE_GAP = 36;
const DOCUMENT_CACHE_SIZE = 7;

function materialKind(file: File): { kind: ClassroomMediaKind; sourceFormat?: DocumentSourceFormat } | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return { kind: "document", sourceFormat: "pdf" };
  if (name.endsWith(".pptx")) return { kind: "document", sourceFormat: "pptx" };
  if (name.endsWith(".ppt")) return { kind: "document", sourceFormat: "ppt" };
  if (file.type.startsWith("image/")) return { kind: "image" };
  if (file.type.startsWith("video/")) return { kind: "video" };
  if (file.type.startsWith("audio/")) return { kind: "audio" };
  return null;
}

function iconFor(kind: ClassroomMediaKind) {
  return kind === "document" ? FileText : kind === "image" ? ImageIcon : kind === "audio" ? Music : Video;
}

function MaterialThumbnail({ material }: { material: ClassroomMaterialRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const Icon = iconFor(material.kind);
  useEffect(() => {
    if (!material.thumbnail) return setUrl(null);
    const nextUrl = URL.createObjectURL(material.thumbnail);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [material.thumbnail]);
  return <div className="flex aspect-video items-center justify-center bg-slate-900">
    {url ? <img src={url} className="h-full w-full object-cover" /> : <Icon className="size-8 text-slate-500" />}
  </div>;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function requestCanvasFrame(track: MediaStreamTrack | undefined) {
  (track as (MediaStreamTrack & { requestFrame?: () => void }) | undefined)?.requestFrame?.();
}

async function requestInitialCanvasFrames(track: MediaStreamTrack | undefined) {
  requestCanvasFrame(track);
  await nextFrame();
  requestCanvasFrame(track);
  await nextFrame();
  requestCanvasFrame(track);
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  state: ClassroomMaterialViewState
) {
  const canvas = context.canvas;
  const scale = Math.min(canvas.width / width, canvas.height / height) * state.zoom;
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    source,
    (canvas.width - drawWidth) / 2 + state.panX,
    (canvas.height - drawHeight) / 2 + state.panY,
    drawWidth,
    drawHeight
  );
}

function documentStride(
  runtime: RuntimeDocument | null,
  scrollPosition: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number
) {
  const page = runtime?.pages.get(Math.round(scrollPosition) + 1)
    ?? runtime?.pages.values().next().value;
  if (!page) return (canvasHeight * DOCUMENT_CELL_SCALE + DOCUMENT_PAGE_GAP) * zoom;
  return presentationPageStride(
    canvasWidth,
    canvasHeight,
    page.image.naturalWidth,
    page.image.naturalHeight,
    zoom,
    DOCUMENT_CELL_SCALE,
    DOCUMENT_PAGE_GAP
  );
}

function drawDocumentStrip(
  context: CanvasRenderingContext2D,
  runtime: RuntimeDocument,
  pageCount: number,
  viewport: PresentationViewport,
  scrollPosition: number
) {
  const canvas = context.canvas;
  const cellWidth = canvas.width * DOCUMENT_CELL_SCALE;
  const cellHeight = canvas.height * DOCUMENT_CELL_SCALE;
  const stride = documentStride(runtime, scrollPosition, canvas.width, canvas.height, viewport.zoom);
  context.fillStyle = "#020617";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const first = Math.max(0, Math.floor(scrollPosition) - 2);
  const last = Math.min(pageCount - 1, Math.ceil(scrollPosition) + 2);
  for (let index = first; index <= last; index += 1) {
    const centerY = canvas.height / 2 + (index - scrollPosition) * stride;
    const cached = runtime.pages.get(index + 1);
    if (!cached) {
      const placeholderWidth = cellWidth * viewport.zoom;
      const placeholderHeight = cellHeight * viewport.zoom;
      context.fillStyle = "#111827";
      context.fillRect(
        (canvas.width - placeholderWidth) / 2 + viewport.panX,
        centerY - placeholderHeight / 2,
        placeholderWidth,
        placeholderHeight
      );
      context.fillStyle = "#94a3b8";
      context.font = "bold 34px sans-serif";
      context.textAlign = "center";
      context.fillText(`טוען עמוד ${index + 1}…`, canvas.width / 2 + viewport.panX, centerY);
      continue;
    }
    cached.lastUsed = performance.now();
    const scale = Math.min(cellWidth / cached.image.naturalWidth, cellHeight / cached.image.naturalHeight) * viewport.zoom;
    const width = cached.image.naturalWidth * scale;
    const height = cached.image.naturalHeight * scale;
    const x = (canvas.width - width) / 2 + viewport.panX;
    const y = centerY - height / 2;
    context.save();
    context.shadowColor = "rgba(0,0,0,0.45)";
    context.shadowBlur = 22;
    context.shadowOffsetY = 8;
    context.fillStyle = "#ffffff";
    context.fillRect(x, y, width, height);
    context.shadowColor = "transparent";
    context.drawImage(cached.image, x, y, width, height);
    context.restore();
  }
}

async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function makeImageThumbnail(blob: Blob): Promise<Blob> {
  const image = await imageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const context = canvas.getContext("2d")!;
  drawContained(context, image, image.naturalWidth, image.naturalHeight, defaultMaterialViewState());
  URL.revokeObjectURL(image.src);
  return new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("thumbnail_failed")), "image/webp", 0.82));
}

async function makeVideoThumbnail(blob: Blob): Promise<Blob> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(blob);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video_thumbnail_failed"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d")!;
    drawContained(context, video, video.videoWidth, video.videoHeight, defaultMaterialViewState());
    return await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("video_thumbnail_failed")), "image/webp", 0.82));
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export const ClassroomPresentationPublisher = forwardRef<ClassroomPresentationPublisherHandle, Props>(function ClassroomPresentationPublisher({
  room,
  roomCode,
  sessionId,
  canPresent,
  visible,
  presenterEpoch,
  presenterToken,
  classroomRequest,
  onPresentationChange,
  onUploadStatus,
  canSendToWhiteboard,
  onSendPageToWhiteboard,
  onRequestHidden,
  onError,
  showBoard,
  presentationPercent
}: Props, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const visualSurfaceRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const publishCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageMaterialIdRef = useRef<string | null>(null);
  const documentRef = useRef<RuntimeDocument | null>(null);
  const animationRef = useRef<number | null>(null);
  const staticFrameTimerRef = useRef<number | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioGraphRef = useRef<{
    media: HTMLMediaElement;
    context: AudioContext;
    source: MediaElementAudioSourceNode;
    destination: MediaStreamAudioDestinationNode;
  } | null>(null);
  const laserRef = useRef<{ x: number; y: number } | null>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ x: number; y: number; at: number; velocityX: number; velocityY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; midpointX: number; midpointY: number } | null>(null);
  const viewportAnimationRef = useRef<number | null>(null);
  const viewportAnimationTimeRef = useRef<number | null>(null);
  const viewportCurrentRef = useRef<PresentationViewport>({ zoom: 1, panX: 0, panY: 0 });
  const viewportTargetRef = useRef<PresentationViewport>({ zoom: 1, panX: 0, panY: 0 });
  const viewportVelocityRef = useRef({ x: 0, y: 0, scroll: 0 });
  const documentScrollCurrentRef = useRef(0);
  const documentScrollTargetRef = useRef(0);
  const preloadDocumentWindowRef = useRef<(material: ClassroomMaterialRecord, position: number) => void>(() => {});
  const reducedMotionRef = useRef(false);
  const persistMaterialTimerRef = useRef<number | null>(null);
  const preparingRef = useRef(false);
  const publishingRef = useRef(false);
  const [materials, setMaterials] = useState<ClassroomMaterialRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [laserMode, setLaserMode] = useState(false);
  const [cacheWarning, setCacheWarning] = useState<string | null>(null);
  const [renderRevision, setRenderRevision] = useState(0);
  const [libraryReady, setLibraryReady] = useState(false);
  const [viewportUi, setViewportUi] = useState<PresentationViewport>({ zoom: 1, panX: 0, panY: 0 });
  const [documentPageUi, setDocumentPageUi] = useState(1);
  const [documentScrollUi, setDocumentScrollUi] = useState(0);
  const [isSendingToWhiteboard, setIsSendingToWhiteboard] = useState(false);

  useImperativeHandle(ref, () => ({
    openMaterialPicker: () => {
      if (!isPreparing) fileInputRef.current?.click();
    }
  }), [isPreparing]);

  const selected = useMemo(() => materials.find((material) => material.id === selectedId) ?? null, [materials, selectedId]);
  const selectedRef = useRef<ClassroomMaterialRecord | null>(null);
  selectedRef.current = selected;
  const width = showBoard ? `${presentationPercent}%` : "100%";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotionRef.current = mediaQuery.matches; };
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const viewport = {
      zoom: selected.state.zoom,
      panX: selected.state.panX,
      panY: selected.state.panY
    };
    viewportCurrentRef.current = viewport;
    viewportTargetRef.current = viewport;
    viewportVelocityRef.current = { x: 0, y: 0, scroll: 0 };
    const documentScroll = Number.isFinite(selected.state.documentScroll)
      ? selected.state.documentScroll
      : Math.max(0, selected.state.page - 1);
    documentScrollCurrentRef.current = documentScroll;
    documentScrollTargetRef.current = documentScroll;
    setDocumentPageUi(Math.round(documentScroll) + 1);
    setDocumentScrollUi(documentScroll);
    setViewportUi(viewport);
  }, [selected?.id]);

  const persistLibraryState = useCallback((nextSelectedId: string | null, desiredVisible: boolean) => {
    void saveClassroomLibraryState({
      sessionId,
      selectedId: nextSelectedId,
      desiredVisible,
      updatedAt: Date.now(),
      expiresAt: Date.now() + CLASSROOM_MEDIA_TTL_MS
    }).catch((error) => {
      console.error("Classroom media library state could not be persisted", error);
      setCacheWarning("לא ניתן לשמור את ספריית המדיה לשחזור לאחר רענון.");
    });
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void purgeExpiredClassroomMedia()
      .then(() => loadClassroomLibrary(sessionId))
      .then(({ materials: restored, state }) => {
        if (cancelled) return;
        setMaterials(restored);
        setSelectedId(state?.selectedId && restored.some((item) => item.id === state.selectedId)
          ? state.selectedId
          : restored[0]?.id ?? null);
      })
      .catch(() => setCacheWarning("לא ניתן לשחזר את ספריית המדיה המקומית."))
      .finally(() => { if (!cancelled) setLibraryReady(true); });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    onPresentationChange({
      ready: libraryReady,
      hasMedia: materials.length > 0,
      published: isPublished,
      title: selected?.title ?? null,
      kind: selected?.kind ?? null
    });
    if (libraryReady && materials.some((material) => !material.localOnly)) persistLibraryState(selectedId, visible);
  }, [isPublished, libraryReady, materials.length, onPresentationChange, persistLibraryState, selected?.kind, selected?.title, selectedId, visible]);

  const updateSelectedState = useCallback((change: Partial<ClassroomMaterialViewState>) => {
    if (!selectedId) return;
    setMaterials((current) => current.map((material) => {
      if (material.id !== selectedId) return material;
      const next = { ...material, state: { ...material.state, ...change }, expiresAt: Date.now() + CLASSROOM_MEDIA_TTL_MS };
      if (!next.localOnly) {
        if (persistMaterialTimerRef.current !== null) window.clearTimeout(persistMaterialTimerRef.current);
        persistMaterialTimerRef.current = window.setTimeout(() => {
          void saveClassroomMaterial(next).catch((error) => {
            console.error("Classroom media material could not be persisted", error);
            setMaterials((items) => items.map((item) => item.id === next.id ? { ...item, localOnly: true } : item));
            setCacheWarning("החומר יישאר זמין בלשונית זו, אך אין מקום לשמור אותו לשחזור לאחר רענון.");
          });
        }, 500);
      }
      return next;
    }));
  }, [selectedId]);

  const removePublishedTracks = useCallback(async (stopTracks: boolean) => {
    if (staticFrameTimerRef.current !== null) {
      window.clearInterval(staticFrameTimerRef.current);
      staticFrameTimerRef.current = null;
    }
    for (const track of publishedTracksRef.current) {
      try { await room?.localParticipant.unpublishTrack(track, stopTracks); } catch {}
      if (stopTracks) track.stop();
    }
    if (stopTracks) publishedTracksRef.current = [];
    setIsPublished(false);
  }, [room]);

  const disposeRuntime = useCallback(async (retireMediaElement = false) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (viewportAnimationRef.current !== null) cancelAnimationFrame(viewportAnimationRef.current);
    viewportAnimationRef.current = null;
    viewportAnimationTimeRef.current = null;
    await removePublishedTracks(true);
    const media = mediaRef.current;
    media?.pause();
    media?.removeAttribute("src");
    media?.load();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (imageRef.current?.src.startsWith("blob:")) URL.revokeObjectURL(imageRef.current.src);
    imageRef.current = null;
    imageMaterialIdRef.current = null;
    for (const page of documentRef.current?.pages.values() ?? []) URL.revokeObjectURL(page.url);
    await documentRef.current?.reader.close().catch(() => {});
    documentRef.current = null;
    const audioGraph = audioGraphRef.current;
    if (audioGraph && (retireMediaElement || !mediaRef.current || audioGraph.media !== mediaRef.current)) {
      await audioGraph.context.close().catch(() => {});
      audioGraphRef.current = null;
    }
    laserRef.current = null;
  }, [removePublishedTracks]);

  const presentationDimensions = useCallback((): PresentationSurfaceDimensions | null => {
    const canvas = displayCanvasRef.current;
    const material = selectedRef.current;
    if (canvas && material?.kind === "document") {
      const runtime = documentRef.current;
      if (!runtime || runtime.materialId !== material.id || !material.documentManifest) return null;
      const pageNumber = documentPageAt(documentScrollCurrentRef.current, material.documentManifest.pageCount);
      const page = runtime.pages.get(pageNumber);
      if (!page) return null;
      const contentWidth = page.image.naturalWidth;
      const contentHeight = page.image.naturalHeight;
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        contentWidth,
        contentHeight,
        baseScale: Math.min(
          (canvas.width * DOCUMENT_CELL_SCALE) / contentWidth,
          (canvas.height * DOCUMENT_CELL_SCALE) / contentHeight
        )
      };
    }
    const image = imageRef.current;
    if (!canvas || material?.kind !== "image" || imageMaterialIdRef.current !== material.id || !image || !image.naturalWidth || !image.naturalHeight) return null;
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      contentWidth: image.naturalWidth,
      contentHeight: image.naturalHeight
    };
  }, []);

  const renderVisual = useCallback(() => {
    const canvas = displayCanvasRef.current;
    const context = canvas?.getContext("2d");
    const material = selectedRef.current;
    if (!canvas || !context || !material) return;
    const image = imageRef.current;
    if (material.kind === "document" && material.documentManifest && documentRef.current?.materialId === material.id) {
      drawDocumentStrip(
        context,
        documentRef.current,
        material.documentManifest.pageCount,
        viewportCurrentRef.current,
        documentScrollCurrentRef.current
      );
    } else if (material.kind === "image" && imageMaterialIdRef.current === material.id && image) {
      drawContained(context, image, image.naturalWidth, image.naturalHeight, {
        ...material.state,
        ...viewportCurrentRef.current
      });
    }
    if (laserRef.current) {
      const gradient = context.createRadialGradient(laserRef.current.x, laserRef.current.y, 2, laserRef.current.x, laserRef.current.y, 24);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.2, "rgba(255,35,55,1)");
      gradient.addColorStop(1, "rgba(255,0,30,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(laserRef.current.x, laserRef.current.y, 24, 0, Math.PI * 2);
      context.fill();
    }
    const publishCanvas = publishCanvasRef.current;
    const publishContext = publishCanvas?.getContext("2d");
    if (publishCanvas && publishContext) {
      publishContext.drawImage(canvas, 0, 0, publishCanvas.width, publishCanvas.height);
      requestCanvasFrame(publishedTracksRef.current.find((track) => track.kind === "video"));
    }
  }, []);

  const resizeVisualCanvases = useCallback(() => {
    const surface = visualSurfaceRef.current;
    const display = displayCanvasRef.current;
    const publisher = publishCanvasRef.current;
    const material = selectedRef.current;
    if (!surface || !display || !publisher || (material?.kind !== "document" && material?.kind !== "image")) return;
    const size = presentationCanvasSize(surface.clientWidth, surface.clientHeight, DOCUMENT_WIDTH, DOCUMENT_HEIGHT);
    if (display.width === size.width && display.height === size.height && publisher.width === size.width && publisher.height === size.height) return;
    display.width = size.width;
    display.height = size.height;
    publisher.width = size.width;
    publisher.height = size.height;
    renderVisual();
  }, [renderVisual]);

  useEffect(() => {
    if (!visible || (selected?.kind !== "document" && selected?.kind !== "image")) return;
    const surface = visualSurfaceRef.current;
    if (!surface) return;
    const observer = new ResizeObserver(resizeVisualCanvases);
    observer.observe(surface);
    resizeVisualCanvases();
    return () => observer.disconnect();
  }, [resizeVisualCanvases, selected?.id, selected?.kind, visible]);

  const startViewportAnimation = useCallback(() => {
    if (viewportAnimationRef.current !== null) return;
    const tick = (now: number) => {
      const dimensions = presentationDimensions();
      if (!dimensions) {
        viewportAnimationRef.current = null;
        viewportAnimationTimeRef.current = null;
        return;
      }
      const previousAt = viewportAnimationTimeRef.current ?? now;
      const elapsed = Math.min(32, Math.max(0, now - previousAt));
      viewportAnimationTimeRef.current = now;
      const velocity = viewportVelocityRef.current;
      const material = selectedRef.current;
      const documentManifest = material?.kind === "document" ? material.documentManifest : undefined;
      const isDocument = Boolean(documentManifest);
      if (Math.abs(velocity.x) > 0.01 || Math.abs(velocity.y) > 0.01 || Math.abs(velocity.scroll) > 0.00001) {
        const before = viewportTargetRef.current;
        const moved = clampPresentationViewport({
          ...before,
          panX: before.panX + velocity.x * elapsed,
          panY: isDocument ? 0 : before.panY + velocity.y * elapsed
        }, dimensions);
        if (moved.panX === before.panX) velocity.x = 0;
        if (moved.panY === before.panY) velocity.y = 0;
        viewportTargetRef.current = moved;
        const damping = Math.exp(-elapsed / 170);
        velocity.x *= damping;
        velocity.y *= damping;
        if (isDocument) {
          const maxPosition = documentManifest!.pageCount - 1;
          const beforeScroll = documentScrollTargetRef.current;
          const nextScroll = clampDocumentScroll(beforeScroll + velocity.scroll * elapsed, maxPosition + 1);
          if (nextScroll === beforeScroll) velocity.scroll = 0;
          documentScrollTargetRef.current = nextScroll;
          velocity.scroll *= damping;
          setDocumentPageUi(documentPageAt(nextScroll, maxPosition + 1));
          setDocumentScrollUi(nextScroll);
          preloadDocumentWindowRef.current(material!, nextScroll);
        } else {
          velocity.scroll = 0;
        }
        setViewportUi(moved);
      }

      const target = viewportTargetRef.current;
      const current = viewportCurrentRef.current;
      const ease = reducedMotionRef.current ? 1 : 1 - Math.exp(-elapsed / 75);
      const next = {
        zoom: current.zoom + (target.zoom - current.zoom) * ease,
        panX: current.panX + (target.panX - current.panX) * ease,
        panY: current.panY + (target.panY - current.panY) * ease
      };
      viewportCurrentRef.current = next;
      const scrollTarget = documentScrollTargetRef.current;
      const scrollCurrent = documentScrollCurrentRef.current;
      documentScrollCurrentRef.current = scrollCurrent + (scrollTarget - scrollCurrent) * ease;
      renderVisual();

      const settled = Math.abs(target.zoom - next.zoom) < 0.0005
        && Math.abs(target.panX - next.panX) < 0.25
        && Math.abs(target.panY - next.panY) < 0.25
        && Math.abs(scrollTarget - documentScrollCurrentRef.current) < 0.0005
        && Math.abs(velocity.x) < 0.01
        && Math.abs(velocity.y) < 0.01
        && Math.abs(velocity.scroll) < 0.00001;
      if (settled) {
        viewportCurrentRef.current = target;
        documentScrollCurrentRef.current = scrollTarget;
        viewportVelocityRef.current = { x: 0, y: 0, scroll: 0 };
        viewportAnimationRef.current = null;
        viewportAnimationTimeRef.current = null;
        renderVisual();
        updateSelectedState({
          ...target,
          ...(isDocument ? { documentScroll: scrollTarget, page: documentPageAt(scrollTarget, documentManifest!.pageCount) } : {})
        });
        return;
      }
      viewportAnimationRef.current = requestAnimationFrame(tick);
    };
    viewportAnimationRef.current = requestAnimationFrame(tick);
  }, [presentationDimensions, renderVisual, updateSelectedState]);

  const setViewportTarget = useCallback((viewport: PresentationViewport, immediate = false) => {
    const dimensions = presentationDimensions();
    if (!dimensions) return;
    const next = clampPresentationViewport({
      ...viewport,
      panY: selectedRef.current?.kind === "document" ? 0 : viewport.panY
    }, dimensions);
    viewportTargetRef.current = next;
    setViewportUi(next);
    if (immediate || reducedMotionRef.current) {
      viewportCurrentRef.current = next;
      viewportVelocityRef.current = { x: 0, y: 0, scroll: 0 };
      renderVisual();
      updateSelectedState(next);
      return;
    }
    startViewportAnimation();
  }, [presentationDimensions, renderVisual, startViewportAnimation, updateSelectedState]);

  const setDocumentScrollTarget = useCallback((position: number, immediate = false) => {
    const material = selectedRef.current;
    if (material?.kind !== "document" || !material.documentManifest) return;
    const next = clampDocumentScroll(position, material.documentManifest.pageCount);
    documentScrollTargetRef.current = next;
    setDocumentPageUi(documentPageAt(next, material.documentManifest.pageCount));
    setDocumentScrollUi(next);
    preloadDocumentWindowRef.current(material, next);
    if (immediate || reducedMotionRef.current) {
      documentScrollCurrentRef.current = next;
      viewportVelocityRef.current.scroll = 0;
      renderVisual();
      updateSelectedState({ documentScroll: next, page: documentPageAt(next, material.documentManifest.pageCount) });
      return;
    }
    startViewportAnimation();
  }, [renderVisual, startViewportAnimation, updateSelectedState]);

  const startStaticFrameHeartbeat = useCallback((track: MediaStreamTrack | undefined) => {
    if (staticFrameTimerRef.current !== null) window.clearInterval(staticFrameTimerRef.current);
    const pushFrame = () => {
      renderVisual();
      requestCanvasFrame(track);
    };
    pushFrame();
    staticFrameTimerRef.current = window.setInterval(pushFrame, 750);
  }, [renderVisual]);

  const loadDocumentPage = useCallback(async (material: ClassroomMaterialRecord, runtime: RuntimeDocument, page: number) => {
    const manifest = material.documentManifest;
    if (!manifest) throw new Error("document_manifest_missing");
    page = Math.max(1, Math.min(manifest.pageCount, page));
    if (runtime.pages.has(page)) {
      runtime.pages.get(page)!.lastUsed = performance.now();
      return;
    }
    const existingLoad = runtime.loadingPages.get(page);
    if (existingLoad) return existingLoad;
    const entry = runtime.entries.get(manifest.pages[page - 1]);
    if (!entry || entry.directory) throw new Error("document_page_missing");
    const loading = (async () => {
      const blob = await entry.getData(new BlobWriter(manifest.mimeType));
      const image = await imageFromBlob(blob);
      if (documentRef.current !== runtime) {
        URL.revokeObjectURL(image.src);
        return;
      }
      runtime.pages.set(page, { image, blob, url: image.src, lastUsed: performance.now() });
      while (runtime.pages.size > DOCUMENT_CACHE_SIZE) {
        const center = documentScrollTargetRef.current + 1;
        const removable = [...runtime.pages.entries()]
          .filter(([candidate]) => Math.abs(candidate - center) > 2)
          .sort((left, right) => left[1].lastUsed - right[1].lastUsed)[0];
        if (!removable) break;
        URL.revokeObjectURL(removable[1].url);
        runtime.pages.delete(removable[0]);
      }
      setRenderRevision((value) => value + 1);
    })().finally(() => runtime.loadingPages.delete(page));
    runtime.loadingPages.set(page, loading);
    return loading;
  }, []);

  const preloadDocumentWindow = useCallback((material: ClassroomMaterialRecord, position: number) => {
    const runtime = documentRef.current;
    const manifest = material.documentManifest;
    if (!runtime || runtime.materialId !== material.id || !manifest) return;
    const center = Math.round(position) + 1;
    for (let page = Math.max(1, center - 2); page <= Math.min(manifest.pageCount, center + 2); page += 1) {
      void loadDocumentPage(material, runtime, page).catch(() => {});
    }
  }, [loadDocumentPage]);
  preloadDocumentWindowRef.current = preloadDocumentWindow;

  const prepareSelected = useCallback(async (material: ClassroomMaterialRecord) => {
    await disposeRuntime();
    const display = displayCanvasRef.current;
    const publisher = publishCanvasRef.current;
    const visual = material.kind === "document" || material.kind === "image";
    if (!publisher || (visual && !display)) throw new Error("presentation_surface_missing");
    const visualSize = visual && visualSurfaceRef.current
      ? presentationCanvasSize(visualSurfaceRef.current.clientWidth, visualSurfaceRef.current.clientHeight, DOCUMENT_WIDTH, DOCUMENT_HEIGHT)
      : null;
    const width = visualSize?.width ?? (visual ? DOCUMENT_WIDTH : VIDEO_WIDTH);
    const height = visualSize?.height ?? (visual ? DOCUMENT_HEIGHT : VIDEO_HEIGHT);
    if (display) {
      display.width = width;
      display.height = height;
    }
    publisher.width = width;
    publisher.height = height;
    if (material.kind === "document") {
      const reader = new ZipReader(new BlobReader(material.source));
      const entries = await reader.getEntries();
      if (selectedRef.current?.id !== material.id) {
        await reader.close().catch(() => {});
        return;
      }
      const runtime: RuntimeDocument = {
        materialId: material.id,
        reader,
        entries: new Map(entries.map((entry) => [entry.filename, entry])),
        pages: new Map(),
        loadingPages: new Map()
      };
      documentRef.current = runtime;
      const position = Number.isFinite(material.state.documentScroll)
        ? Math.max(0, Math.min((material.documentManifest?.pageCount ?? 1) - 1, material.state.documentScroll))
        : Math.max(0, material.state.page - 1);
      documentScrollCurrentRef.current = position;
      documentScrollTargetRef.current = position;
      setDocumentPageUi(Math.round(position) + 1);
      setDocumentScrollUi(position);
      await loadDocumentPage(material, runtime, Math.round(position) + 1);
      preloadDocumentWindow(material, position);
      renderVisual();
    } else if (material.kind === "image") {
      const image = await imageFromBlob(material.source);
      if (selectedRef.current?.id !== material.id) {
        URL.revokeObjectURL(image.src);
        return;
      }
      imageRef.current = image;
      imageMaterialIdRef.current = material.id;
      renderVisual();
    } else {
      const media = mediaRef.current;
      if (!media) throw new Error("media_element_missing");
      const url = URL.createObjectURL(material.source);
      objectUrlRef.current = url;
      media.src = url;
      media.playbackRate = material.state.playbackRate;
      media.volume = material.state.volume;
      await new Promise<void>((resolve, reject) => {
        media.onloadedmetadata = () => resolve();
        media.onerror = () => reject(new Error("media_decode_failed"));
      });
      media.currentTime = Math.min(material.state.currentTime, Number.isFinite(media.duration) ? media.duration : material.state.currentTime);
    }
    setRenderRevision((value) => value + 1);
  }, [disposeRuntime, loadDocumentPage, preloadDocumentWindow, renderVisual]);

  useEffect(() => {
    if (!selected || !canPresent || !visible) return;
    let cancelled = false;
    preparingRef.current = true;
    setIsPreparing(true);
    void prepareSelected(selected)
      .catch((error) => {
        console.error("Classroom media preparation failed", error);
        if (!cancelled) onError("לא ניתן לפתוח את חומר המדיה שנבחר.");
      })
      .finally(() => {
        preparingRef.current = false;
        if (!cancelled) setIsPreparing(false);
      });
    return () => { cancelled = true; };
  }, [canPresent, onError, prepareSelected, selected?.id, visible]);

  useEffect(() => {
    if (selected?.kind === "document" || (selected?.kind === "image" && imageRef.current)) renderVisual();
  }, [renderRevision, renderVisual, selected?.state.zoom, selected?.state.panX, selected?.state.panY]);

  const sendPresentationState = useCallback(async (action: "started" | "hidden" | "stopped") => {
    const material = selectedRef.current;
    const response = await classroomRequest("/rtc/classroom-presentation-state", {
      roomCode,
      action,
      presenterEpoch,
      presenterToken,
      ...(action === "started" && material ? {
        title: material.title,
        mediaKind: material.kind,
        presenterIdentity: room?.localParticipant.identity
      } : {})
    });
    if (!response.ok) throw new Error("presentation_state_rejected");
  }, [classroomRequest, presenterEpoch, presenterToken, room, roomCode]);

  const publish = useCallback(async () => {
    const material = selectedRef.current;
    if (!room || !material || !canPresent || preparingRef.current || isPublished || publishingRef.current) return;
    publishingRef.current = true;
    try {
    const publisher = publishCanvasRef.current;
    if (!publisher) return;
    if (publishedTracksRef.current.length > 0) {
      for (const track of publishedTracksRef.current) {
        await room.localParticipant.publishTrack(track, {
          ...(material.kind === "document" || material.kind === "image" ? DOCUMENT_PUBLISH_OPTIONS : VIDEO_PUBLISH_OPTIONS),
          source: track.kind === "audio" ? Track.Source.ScreenShareAudio : Track.Source.ScreenShare,
          name: track.kind === "audio" ? "classroom-presentation-audio" : "classroom-presentation-video"
        });
      }
      if (material.kind === "document" || material.kind === "image") {
        renderVisual();
        const videoTrack = publishedTracksRef.current.find((track) => track.kind === "video");
        await requestInitialCanvasFrames(videoTrack);
        startStaticFrameHeartbeat(videoTrack);
      }
      if (material.state.wasPlaying && mediaRef.current) await mediaRef.current.play().catch(() => {});
      await sendPresentationState("started");
      setIsPublished(true);
      return;
    }
    const stream = publisher.captureStream(material.kind === "video" ? 60 : 30);
    const tracks = [...stream.getVideoTracks()];
    if (material.kind === "document" || material.kind === "image") {
      renderVisual();
      requestCanvasFrame(tracks[0]);
    }
    if (material.kind === "video" || material.kind === "audio") {
      const media = mediaRef.current;
      if (!media) return;
      let audioGraph = audioGraphRef.current;
      if (!audioGraph || audioGraph.media !== media || audioGraph.context.state === "closed") {
        await audioGraph?.context.close().catch(() => {});
        const context = new AudioContext();
        const source = context.createMediaElementSource(media);
        const destination = context.createMediaStreamDestination();
        source.connect(destination);
        source.connect(context.destination);
        audioGraph = { media, context, source, destination };
        audioGraphRef.current = audioGraph;
      }
      await audioGraph.context.resume();
      tracks.push(...audioGraph.destination.stream.getAudioTracks());
      const draw = () => {
        const context = publisher.getContext("2d");
        if (!context) return;
        if (material.kind === "video") {
          const video = media as HTMLVideoElement;
          if (video.videoWidth && video.videoHeight) drawContained(context, video, video.videoWidth, video.videoHeight, defaultMaterialViewState());
        } else {
          context.fillStyle = "#0f172a";
          context.fillRect(0, 0, publisher.width, publisher.height);
          context.fillStyle = "#e2e8f0";
          context.font = "bold 48px sans-serif";
          context.textAlign = "center";
          context.fillText(material.title, publisher.width / 2, publisher.height / 2);
        }
        animationRef.current = requestAnimationFrame(draw);
      };
      draw();
    }
    try {
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track, {
          ...(material.kind === "document" || material.kind === "image" ? DOCUMENT_PUBLISH_OPTIONS : VIDEO_PUBLISH_OPTIONS),
          source: track.kind === "audio" ? Track.Source.ScreenShareAudio : Track.Source.ScreenShare,
          name: track.kind === "audio" ? "classroom-presentation-audio" : "classroom-presentation-video"
        });
      }
      if (material.kind === "document" || material.kind === "image") {
        renderVisual();
        const videoTrack = tracks.find((track) => track.kind === "video");
        await requestInitialCanvasFrames(videoTrack);
        startStaticFrameHeartbeat(videoTrack);
      }
      publishedTracksRef.current = tracks;
      if (material.state.wasPlaying && mediaRef.current) await mediaRef.current.play().catch(() => {});
      await sendPresentationState("started");
      setIsPublished(true);
    } catch (error) {
      for (const track of tracks) track.stop();
      await removePublishedTracks(true);
      throw error;
    }
    } finally {
      publishingRef.current = false;
    }
  }, [canPresent, isPublished, removePublishedTracks, renderVisual, room, sendPresentationState, startStaticFrameHeartbeat]);

  useEffect(() => {
    if (!canPresent || !selected) return;
    if (visible && !isPublished) {
      void publish().catch((error) => {
        console.error("Classroom presentation publish failed", error);
        onError("לא ניתן לפרסם את לוח המדיה.");
      });
    }
    if (!visible && isPublished) {
      if (mediaRef.current) {
        updateSelectedState({ wasPlaying: !mediaRef.current.paused, currentTime: mediaRef.current.currentTime });
        mediaRef.current.pause();
      }
      void removePublishedTracks(false).then(() => sendPresentationState("hidden").catch(() => {}));
    }
  }, [canPresent, isPublished, onError, publish, removePublishedTracks, selected, sendPresentationState, updateSelectedState, visible]);

  useEffect(() => () => { void disposeRuntime(true); }, [disposeRuntime]);

  useEffect(() => {
    if (canPresent) return;
    void disposeRuntime();
  }, [canPresent, disposeRuntime]);

  useEffect(() => {
    if (!laserMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLaserMode(false);
      laserRef.current = null;
      renderVisual();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [laserMode, renderVisual]);

  const convertDocument = useCallback(async (file: File, sourceFormat: DocumentSourceFormat) => {
    if (!presenterToken) throw new Error("presenter_token_missing");
    const ticketResponse = await classroomRequest("/rtc/classroom-document-conversion-ticket", {
      roomCode,
      presenterEpoch,
      presenterToken,
      fileName: file.name,
      sizeBytes: file.size,
      sourceFormat
    });
    if (!ticketResponse.ok) throw new Error("conversion_ticket_rejected");
    const { converterUrl, ticket } = await ticketResponse.json();
    const uploadResponse = await fetch(`${converterUrl}/v1/conversions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ticket}`, "Content-Type": "application/octet-stream" },
      body: file
    });
    if (!uploadResponse.ok) throw new Error("conversion_upload_failed");
    const job = await uploadResponse.json();
    try {
      for (let attempt = 0; attempt < 125; attempt += 1) {
        await sleep(1000);
        const statusResponse = await fetch(`${converterUrl}/v1/conversions/${job.id}`, { headers: { Authorization: `Bearer ${job.accessToken}` } });
        if (!statusResponse.ok) throw new Error("conversion_status_failed");
        const status = await statusResponse.json();
        if (status.status === "failed") throw new Error(status.error || "conversion_failed");
        if (status.status === "ready") break;
        if (attempt === 124) throw new Error("conversion_timeout");
      }
      const result = await fetch(`${converterUrl}/v1/conversions/${job.id}/result`, { headers: { Authorization: `Bearer ${job.accessToken}` } });
      if (!result.ok) throw new Error("conversion_download_failed");
      const zip = await result.blob();
      const reader = new ZipReader(new BlobReader(zip));
      const entries = await reader.getEntries();
      const manifestEntry = entries.find((entry) => entry.filename === "manifest.json");
      if (!manifestEntry || manifestEntry.directory) throw new Error("conversion_manifest_missing");
      const manifest = JSON.parse(await manifestEntry.getData(new TextWriter()));
      const firstPageEntry = entries.find((entry) => entry.filename === manifest.pages?.[0]);
      if (!firstPageEntry || firstPageEntry.directory) throw new Error("conversion_first_page_missing");
      const firstPage = await firstPageEntry.getData(new BlobWriter(manifest.mimeType));
      const thumbnail = await makeImageThumbnail(firstPage);
      await reader.close();
      return { zip, manifest, thumbnail };
    } finally {
      void fetch(`${converterUrl}/v1/conversions/${job.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${job.accessToken}` } });
    }
  }, [classroomRequest, presenterEpoch, presenterToken, roomCode]);

  const addFile = useCallback(async (file: File) => {
    const detected = materialKind(file);
    if (!detected) {
      const message = "ניתן להוסיף PDF, PPT, PPTX, תמונה, וידאו או שמע בלבד.";
      onUploadStatus({ state: "error", message });
      return onError(message);
    }
    if (detected.kind === "document" && file.size > 50 * 1024 * 1024) {
      const message = "PDF או מצגת יכולים להיות עד 50MB, כדי שההמרה תתבצע בבטחה.";
      onUploadStatus({ state: "error", message });
      return onError(message);
    }
    onUploadStatus({
      state: "preparing",
      message: detected.kind === "document" ? `מעלה וממיר את ${file.name}…` : `מכין את ${file.name} להצגה…`
    });
    setIsPreparing(true);
    try {
      let source: Blob = file;
      let thumbnail: Blob | undefined;
      let documentManifest: ClassroomMaterialRecord["documentManifest"];
      if (detected.kind === "document") {
        const converted = await convertDocument(file, detected.sourceFormat!);
        source = converted.zip;
        thumbnail = converted.thumbnail;
        documentManifest = converted.manifest;
      } else if (detected.kind === "image") {
        thumbnail = await makeImageThumbnail(file);
      } else if (detected.kind === "video") {
        thumbnail = await makeVideoThumbnail(file);
      }
      const id = crypto.randomUUID();
      const localOnly = !(await hasClassroomMediaStorageCapacity(source.size));
      const material: ClassroomMaterialRecord = {
        key: `${sessionId}:${id}`,
        sessionId,
        id,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
        kind: detected.kind,
        sourceFormat: detected.sourceFormat,
        source,
        thumbnail,
        documentManifest,
        state: defaultMaterialViewState(),
        createdAt: Date.now(),
        expiresAt: Date.now() + CLASSROOM_MEDIA_TTL_MS,
        localOnly
      };
      setMaterials((current) => [...current, material]);
      setSelectedId(id);
      if (localOnly) {
        setCacheWarning("החומר יישאר זמין בלשונית זו, אך אין מקום לשמור אותו לשחזור לאחר רענון.");
      } else {
        await saveClassroomMaterial(material).catch((error) => {
          console.error("Classroom media material could not be persisted", error);
          setMaterials((items) => items.map((item) => item.id === id ? { ...item, localOnly: true } : item));
          setCacheWarning("החומר יישאר זמין בלשונית זו, אך אין מקום לשמור אותו לשחזור לאחר רענון.");
        });
      }
      onUploadStatus({ state: "success", message: `${file.name} מוכן להצגה בלוח המדיה.` });
    } catch (error) {
      console.error("Classroom material import failed", error);
      const message = "לא ניתן להכין את הקובץ להצגה.";
      onUploadStatus({ state: "error", message });
      onError(message);
    } finally {
      setIsPreparing(false);
    }
  }, [convertDocument, onError, onUploadStatus, sessionId]);

  const removeSelected = useCallback(async () => {
    if (!selected) return;
    preparingRef.current = true;
    await disposeRuntime(true);
    const remaining = materials.filter((material) => material.id !== selected.id);
    setMaterials(remaining);
    const nextId = remaining[0]?.id ?? null;
    setSelectedId(nextId);
    await removeClassroomMaterial(sessionId, selected.id).catch(() => {});
    if (!nextId) onRequestHidden();
  }, [disposeRuntime, materials, onRequestHidden, selected, sessionId]);

  const clearAll = useCallback(async () => {
    preparingRef.current = true;
    await disposeRuntime(true);
    setMaterials([]);
    setSelectedId(null);
    await clearClassroomLibrary(sessionId).catch(() => {});
    onRequestHidden();
  }, [disposeRuntime, onRequestHidden, sessionId]);

  const changePage = (page: number) => {
    if (!selected?.documentManifest) return;
    const nextPage = Math.max(1, Math.min(selected.documentManifest.pageCount, page));
    viewportVelocityRef.current = { x: 0, y: 0, scroll: 0 };
    setDocumentScrollTarget(nextPage - 1);
  };

  const pointOnCanvas = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const renderedWidth = canvas.width * scale;
    const renderedHeight = canvas.height * scale;
    const left = rect.left + (rect.width - renderedWidth) / 2;
    const top = rect.top + (rect.height - renderedHeight) / 2;
    return {
      x: Math.max(0, Math.min(canvas.width, ((clientX - left) / renderedWidth) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((clientY - top) / renderedHeight) * canvas.height))
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const { x, y } = pointOnCanvas(canvas, event.clientX, event.clientY);
    if (laserMode) {
      laserRef.current = { x, y };
      renderVisual();
      return;
    }
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, { x, y });
    const pointers = [...activePointersRef.current.values()];
    if (pointers.length >= 2) {
      const [first, second] = pointers;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midpointX = (first.x + second.x) / 2;
      const midpointY = (first.y + second.y) / 2;
      const previous = pinchRef.current;
      if (previous && previous.distance > 0) {
        const base = viewportTargetRef.current;
        const isDocument = selected?.kind === "document";
        const panned = {
          ...base,
          panX: base.panX + midpointX - previous.midpointX,
          panY: isDocument ? 0 : base.panY + midpointY - previous.midpointY
        };
        const dimensions = presentationDimensions();
        if (dimensions) {
          const zoomed = zoomPresentationAt(
            panned,
            base.zoom * (distance / previous.distance),
            midpointX,
            midpointY,
            dimensions
          );
          if (isDocument) {
            const ratio = zoomed.zoom / base.zoom;
            const anchoredScroll = documentScrollTargetRef.current
              + ((midpointY - dimensions.canvasHeight / 2) * (ratio - 1)) / documentStride(documentRef.current, documentScrollTargetRef.current, dimensions.canvasWidth, dimensions.canvasHeight, zoomed.zoom)
              - (midpointY - previous.midpointY) / documentStride(documentRef.current, documentScrollTargetRef.current, dimensions.canvasWidth, dimensions.canvasHeight, zoomed.zoom);
            setDocumentScrollTarget(anchoredScroll);
            setViewportTarget({ ...zoomed, panY: 0 });
          } else {
            setViewportTarget(zoomed);
          }
        }
      }
      pinchRef.current = { distance, midpointX, midpointY };
      dragRef.current = null;
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const now = performance.now();
      const elapsed = Math.max(1, now - drag.at);
      const deltaX = x - drag.x;
      const deltaY = y - drag.y;
      const isDocument = selected?.kind === "document";
      setViewportTarget({
        ...viewportTargetRef.current,
        panX: viewportTargetRef.current.panX + deltaX,
        panY: isDocument ? 0 : viewportTargetRef.current.panY + deltaY
      });
      if (isDocument && selected.documentManifest) {
        setDocumentScrollTarget(scrollDocumentByPixels(
          documentScrollTargetRef.current,
          -deltaY,
          documentStride(documentRef.current, documentScrollTargetRef.current, canvas.width, canvas.height, viewportTargetRef.current.zoom),
          selected.documentManifest.pageCount
        ));
      }
      dragRef.current = {
        x,
        y,
        at: now,
        velocityX: drag.velocityX * 0.55 + (deltaX / elapsed) * 0.45,
        velocityY: drag.velocityY * 0.55 + (deltaY / elapsed) * 0.45
      };
    }
  };

  const endPointerInteraction = (event: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size === 0) {
      const drag = dragRef.current;
      if (drag) {
        const isDocument = selected?.kind === "document";
        viewportVelocityRef.current = {
          x: Math.max(-3, Math.min(3, drag.velocityX)),
          y: isDocument ? 0 : Math.max(-3, Math.min(3, drag.velocityY)),
          scroll: isDocument
            ? Math.max(-0.003, Math.min(0.003, -drag.velocityY / documentStride(
                documentRef.current,
                documentScrollTargetRef.current,
                displayCanvasRef.current?.width ?? DOCUMENT_WIDTH,
                displayCanvasRef.current?.height ?? DOCUMENT_HEIGHT,
                viewportTargetRef.current.zoom
              )))
            : 0
        };
        startViewportAnimation();
      }
      dragRef.current = null;
      pinchRef.current = null;
      return;
    }
    const remaining = [...activePointersRef.current.values()][0];
    dragRef.current = { x: remaining.x, y: remaining.y, at: performance.now(), velocityX: 0, velocityY: 0 };
    pinchRef.current = null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const dimensions = presentationDimensions();
    if (!dimensions) return;
    event.preventDefault();
    const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.currentTarget.clientHeight
        : 1;
    const deltaX = event.deltaX * multiplier;
    const deltaY = event.deltaY * multiplier;
    if (event.ctrlKey || event.metaKey) {
      const point = pointOnCanvas(event.currentTarget, event.clientX, event.clientY);
      const factor = Math.exp(-deltaY * 0.002);
      const before = viewportTargetRef.current;
      const zoomed = zoomPresentationAt(
        viewportTargetRef.current,
        viewportTargetRef.current.zoom * factor,
        point.x,
        point.y,
        dimensions
      );
      if (selected?.kind === "document") {
        const ratio = zoomed.zoom / before.zoom;
        setDocumentScrollTarget(documentScrollTargetRef.current
          + ((point.y - dimensions.canvasHeight / 2) * (ratio - 1)) / documentStride(documentRef.current, documentScrollTargetRef.current, dimensions.canvasWidth, dimensions.canvasHeight, zoomed.zoom));
        setViewportTarget({ ...zoomed, panY: 0 });
      } else {
        setViewportTarget(zoomed);
      }
      return;
    }

    const before = viewportTargetRef.current;
    if (selected?.kind === "document") {
      setViewportTarget({ ...before, panX: before.panX - deltaX, panY: 0 });
      setDocumentScrollTarget(scrollDocumentByPixels(
        documentScrollTargetRef.current,
        deltaY,
        documentStride(documentRef.current, documentScrollTargetRef.current, dimensions.canvasWidth, dimensions.canvasHeight, before.zoom),
        selected.documentManifest?.pageCount ?? 1
      ));
      return;
    }
    const next = clampPresentationViewport({
      ...before,
      panX: before.panX - deltaX,
      panY: before.panY - deltaY
    }, dimensions);
    setViewportTarget(next);
  };

  const zoomFromCenter = (factor: number) => {
    const dimensions = presentationDimensions();
    if (!dimensions) return;
    setViewportTarget(zoomPresentationAt(
      viewportTargetRef.current,
      viewportTargetRef.current.zoom * factor,
      dimensions.canvasWidth / 2,
      dimensions.canvasHeight / 2,
      dimensions
    ));
  };

  const fitHeight = () => {
    const dimensions = presentationDimensions();
    if (!dimensions) return;
    const material = selectedRef.current;
    if (material?.kind === "document" && material.documentManifest) {
      const currentPage = documentPageAt(documentScrollCurrentRef.current, material.documentManifest.pageCount);
      setDocumentScrollTarget(currentPage - 1);
    }
    setViewportTarget({ zoom: presentationFitHeightZoom(dimensions), panX: 0, panY: 0 });
  };

  const fitWidth = () => {
    const dimensions = presentationDimensions();
    if (!dimensions) return;
    setViewportTarget({ zoom: presentationFitWidthZoom(dimensions), panX: 0, panY: 0 });
  };

  const handlePresentationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!visual || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "+" || event.key === "=") zoomFromCenter(1.2);
    else if (event.key === "-") zoomFromCenter(1 / 1.2);
    else if (event.key === "0") fitHeight();
    else if (selected?.kind === "document" && (event.key === "PageDown" || (event.key === " " && !event.shiftKey))) changePage(documentPageUi + 1);
    else if (selected?.kind === "document" && (event.key === "PageUp" || (event.key === " " && event.shiftKey))) changePage(documentPageUi - 1);
    else return;
    event.preventDefault();
  };

  const sendCurrentPageToWhiteboard = async () => {
    if (!selected || !canSendToWhiteboard || isSendingToWhiteboard) return;
    const currentPage = selected.kind === "document" ? Math.round(documentScrollCurrentRef.current) + 1 : 1;
    setIsSendingToWhiteboard(true);
    try {
      const runtime = documentRef.current;
      if (selected.kind === "document" && runtime) await loadDocumentPage(selected, runtime, currentPage);
      const page = selected.kind === "image" ? selected.source : runtime?.pages.get(currentPage)?.blob;
      if (!page) {
        onError("העמוד הנוכחי עדיין אינו מוכן לשליחה ללוח השרטוט.");
        return;
      }
      await onSendPageToWhiteboard(page, selected.kind === "document" ? `${selected.title} — ${currentPage}` : selected.title);
    } finally {
      setIsSendingToWhiteboard(false);
    }
  };

  if (!canPresent) return null;

  const SelectedIcon = selected ? iconFor(selected.kind) : Presentation;
  const visual = selected?.kind === "document" || selected?.kind === "image";

  return <>
    <input ref={fileInputRef} type="file" accept="application/pdf,.ppt,.pptx,image/*,video/*,audio/*" className="hidden" onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void addFile(file);
    }} />
    {visible && <div ref={surfaceRef} className={`relative z-30 flex min-h-0 min-w-0 flex-col overflow-hidden bg-black ${showBoard ? "shrink-0" : "flex-1"}`} style={{ width }}>
      {selected ? <div className="relative z-20 flex flex-wrap items-center gap-1.5 border-b border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100" dir="rtl">
        <span className="ml-auto flex max-w-48 items-center gap-1 truncate font-bold"><SelectedIcon className="size-3.5" />{selected.title}</span>
        <button onClick={() => fileInputRef.current?.click()} className="rounded bg-slate-800 px-2 py-1"><Upload className="inline size-3.5" /> הוסף</button>
        <div className="relative">
          <button onClick={() => setMaterialsOpen((value) => !value)} className="rounded bg-slate-800 px-2 py-1"><FolderOpen className="inline size-3.5" /> חומרים ({materials.length})</button>
          {materialsOpen && <div className="absolute left-0 top-full z-50 mt-2 grid max-h-[min(28rem,calc(100vh-10rem))] w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
            {materials.map((material) => {
              return <button key={material.id} onClick={() => { setSelectedId(material.id); setMaterialsOpen(false); }} className={`overflow-hidden rounded-lg border text-right ${material.id === selectedId ? "border-fuchsia-400" : "border-slate-700"}`}>
                <MaterialThumbnail material={material} />
                <div className="truncate px-2 py-1 text-[11px]">{material.title}</div>
              </button>;
            })}
            <button onClick={() => void clearAll()} className="col-span-2 rounded bg-rose-950 px-2 py-1 text-rose-200"><Trash2 className="inline size-3.5" /> נקה את כל החומרים</button>
          </div>}
        </div>
        {selected.kind === "document" && <>
          <button onClick={() => changePage(documentPageUi - 1)} disabled={documentPageUi <= 1}><ChevronRight className="size-4" /></button>
          <input type="number" min={1} max={selected.documentManifest?.pageCount} value={documentPageUi} onChange={(event) => changePage(Number(event.target.value))} className="w-12 rounded bg-slate-800 px-1 py-1 text-center" />
          <span>/ {selected.documentManifest?.pageCount}</span>
          <button onClick={() => changePage(documentPageUi + 1)} disabled={documentPageUi >= (selected.documentManifest?.pageCount ?? 1)}><ChevronLeft className="size-4" /></button>
        </>}
        {visual && <>
          <button onClick={() => zoomFromCenter(1 / 1.2)} title="הקטן"><ZoomOut className="size-4" /></button>
          <button onClick={fitHeight} className="min-w-12 rounded bg-slate-800 px-1 py-1 tabular-nums" title="התאם לגובה">{Math.round(viewportUi.zoom * 100)}%</button>
          <button onClick={() => zoomFromCenter(1.2)} title="הגדל"><ZoomIn className="size-4" /></button>
          <button onClick={fitHeight} title="התאם לגובה">התאם גובה</button>
          <button onClick={fitWidth} title="התאם רוחב">התאם רוחב</button>
          <button onClick={fitHeight} title="איפוס"><RotateCcw className="size-4" /></button>
          <button onClick={() => { setLaserMode((value) => !value); laserRef.current = null; renderVisual(); }} className={laserMode ? "rounded bg-rose-600 px-2 py-1" : "rounded bg-slate-800 px-2 py-1"}>לייזר</button>
          {canSendToWhiteboard && <button onClick={() => void sendCurrentPageToWhiteboard()} disabled={isSendingToWhiteboard} className="rounded bg-indigo-700 px-2 py-1 text-indigo-50 disabled:cursor-wait disabled:opacity-60" title="שלח את העמוד המלא כתמונה ניתנת להזזה בלוח השרטוט"><Send className="inline size-3.5" /> {isSendingToWhiteboard ? "שולח…" : "שלח ללוח"}</button>}
        </>}
        <button onClick={() => document.fullscreenElement ? void document.exitFullscreen() : void surfaceRef.current?.requestFullscreen()} title="מסך מלא"><Maximize2 className="size-4" /></button>
        <button onClick={() => void removeSelected()} title="הסר חומר" className="text-rose-300"><Trash2 className="size-4" /></button>
      </div> : <div className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100" dir="rtl">
        <span className="flex items-center gap-1.5 font-bold"><Presentation className="size-4" />לוח מדיה</span>
        <button onClick={() => fileInputRef.current?.click()} disabled={isPreparing} className="rounded bg-slate-800 px-2 py-1 disabled:cursor-wait disabled:opacity-60"><Upload className="inline size-3.5" /> הוסף חומר</button>
      </div>}
      {selected ? <>
        {cacheWarning && <div className="bg-amber-950 px-3 py-1 text-xs text-amber-100">{cacheWarning}</div>}
        {selected.documentManifest?.warning && <div className="bg-amber-950 px-3 py-1 text-xs text-amber-100">ייתכן שחלק מהגופנים או התוכן העשיר הוחלפו בזמן ההמרה.</div>}
        <div ref={visualSurfaceRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black outline-none" tabIndex={visual ? 0 : -1} onKeyDown={handlePresentationKeyDown} aria-label={visual ? "אזור תצוגת מצגת. ניתן לגרור, לגלול ולהשתמש בקיצורי מקלדת." : undefined}>
        {visual && <canvas
          ref={displayCanvasRef}
          className={`h-full w-full touch-none ${laserMode ? "cursor-none" : viewportUi.zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
          onPointerDown={(event) => {
            const point = pointOnCanvas(event.currentTarget, event.clientX, event.clientY);
            if (laserMode) {
              laserRef.current = point;
              renderVisual();
              return;
            }
            activePointersRef.current.set(event.pointerId, point);
            viewportVelocityRef.current = { x: 0, y: 0, scroll: 0 };
            if (activePointersRef.current.size === 1) {
              dragRef.current = { ...point, at: performance.now(), velocityX: 0, velocityY: 0 };
            } else {
              const [first, second] = [...activePointersRef.current.values()];
              pinchRef.current = {
                distance: Math.hypot(second.x - first.x, second.y - first.y),
                midpointX: (first.x + second.x) / 2,
                midpointY: (first.y + second.y) / 2
              };
            }
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerInteraction}
          onPointerCancel={endPointerInteraction}
          onWheel={handleWheel}
          onDoubleClick={(event) => {
            const dimensions = presentationDimensions();
            if (!dimensions) return;
            const point = pointOnCanvas(event.currentTarget, event.clientX, event.clientY);
            const before = viewportTargetRef.current;
            const zoomed = zoomPresentationAt(
              viewportTargetRef.current,
              viewportTargetRef.current.zoom > 1.05 ? 1 : 2,
              point.x,
              point.y,
              dimensions
            );
            if (selected.kind === "document") {
              const ratio = zoomed.zoom / before.zoom;
              setDocumentScrollTarget(documentScrollTargetRef.current
                + ((point.y - dimensions.canvasHeight / 2) * (ratio - 1)) / documentStride(documentRef.current, documentScrollTargetRef.current, dimensions.canvasWidth, dimensions.canvasHeight, zoomed.zoom));
              setViewportTarget({ ...zoomed, panY: 0 });
            } else {
              setViewportTarget(zoomed);
            }
          }}
          onPointerLeave={() => { if (laserMode) { laserRef.current = null; renderVisual(); } }}
        />}
        {selected.kind === "document" && (selected.documentManifest?.pageCount ?? 0) > 1 && <div className="absolute inset-y-4 left-2 z-30 flex w-7 flex-col items-center rounded-full border border-white/10 bg-slate-950/70 py-2 shadow-xl backdrop-blur-sm" dir="ltr">
          <span className="mb-1 text-[9px] font-bold tabular-nums text-slate-300">{documentPageUi}</span>
          <input
            type="range"
            min={0}
            max={(selected.documentManifest?.pageCount ?? 1) - 1}
            step={0.001}
            value={documentScrollUi}
            onChange={(event) => setDocumentScrollTarget(Number(event.target.value), true)}
            className="presentation-page-navigator min-h-0 flex-1"
            style={{ writingMode: "vertical-lr", direction: "ltr" }}
            aria-label="גלילה רציפה בין עמודי המצגת"
          />
          <span className="mt-1 text-[9px] font-bold tabular-nums text-slate-500">{selected.documentManifest?.pageCount}</span>
        </div>}
        {selected.kind === "video" && <video key={selected.id} ref={(element) => { mediaRef.current = element; }} controls playsInline className="h-full w-full object-contain" onTimeUpdate={(event) => updateSelectedState({ currentTime: event.currentTarget.currentTime })} onPlay={() => updateSelectedState({ wasPlaying: true })} onPause={() => updateSelectedState({ wasPlaying: false })} onVolumeChange={(event) => updateSelectedState({ volume: event.currentTarget.volume })} onRateChange={(event) => updateSelectedState({ playbackRate: event.currentTarget.playbackRate })} />}
        {selected.kind === "audio" && <audio key={selected.id} ref={(element) => { mediaRef.current = element; }} controls className="w-full max-w-2xl" onTimeUpdate={(event) => updateSelectedState({ currentTime: event.currentTarget.currentTime })} onPlay={() => updateSelectedState({ wasPlaying: true })} onPause={() => updateSelectedState({ wasPlaying: false })} onVolumeChange={(event) => updateSelectedState({ volume: event.currentTarget.volume })} onRateChange={(event) => updateSelectedState({ playbackRate: event.currentTarget.playbackRate })} />}
        </div>
      </> : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center" dir="rtl">
        <Presentation className="size-12 text-fuchsia-300" />
        <div>
          <h2 className="text-base font-bold text-slate-100">לוח המדיה מוכן</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-400">עדיין לא נוסף חומר. בחרו קובץ כדי להכין אותו להצגה.</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isPreparing} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:cursor-wait disabled:opacity-60"><Upload className="ml-1 inline size-4" />הוספת חומר</button>
        {isPreparing && <div className="text-sm font-bold text-fuchsia-200" role="status">מכין את החומר להצגה…</div>}
      </div>}
    </div>}
    <canvas ref={publishCanvasRef} width={DOCUMENT_WIDTH} height={DOCUMENT_HEIGHT} className="hidden" aria-hidden="true" />
  </>;
});
