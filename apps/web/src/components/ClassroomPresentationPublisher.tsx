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
  onRequestHidden: () => void;
  onError: (message: string) => void;
  showBoard: boolean;
  presentationPercent: number;
}

export interface ClassroomPresentationPublisherHandle {
  openMaterialPicker: () => void;
}

interface RuntimeDocument {
  reader: ZipReader<Blob>;
  entries: Map<string, Entry>;
  pageUrl: string | null;
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
  onRequestHidden,
  onError,
  showBoard,
  presentationPercent
}: Props, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const publishCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const documentRef = useRef<RuntimeDocument | null>(null);
  const animationRef = useRef<number | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioGraphRef = useRef<{
    media: HTMLMediaElement;
    context: AudioContext;
    source: MediaElementAudioSourceNode;
    destination: MediaStreamAudioDestinationNode;
  } | null>(null);
  const laserRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
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

  useImperativeHandle(ref, () => ({
    openMaterialPicker: () => {
      if (!isPreparing) fileInputRef.current?.click();
    }
  }), [isPreparing]);

  const selected = useMemo(() => materials.find((material) => material.id === selectedId) ?? null, [materials, selectedId]);
  const selectedRef = useRef<ClassroomMaterialRecord | null>(null);
  selectedRef.current = selected;
  const width = showBoard ? `${presentationPercent}%` : "100%";

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
    await removePublishedTracks(true);
    const media = mediaRef.current;
    media?.pause();
    media?.removeAttribute("src");
    media?.load();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (imageRef.current?.src.startsWith("blob:")) URL.revokeObjectURL(imageRef.current.src);
    imageRef.current = null;
    if (documentRef.current?.pageUrl) URL.revokeObjectURL(documentRef.current.pageUrl);
    await documentRef.current?.reader.close().catch(() => {});
    documentRef.current = null;
    const audioGraph = audioGraphRef.current;
    if (audioGraph && (retireMediaElement || !mediaRef.current || audioGraph.media !== mediaRef.current)) {
      await audioGraph.context.close().catch(() => {});
      audioGraphRef.current = null;
    }
    laserRef.current = null;
  }, [removePublishedTracks]);

  const renderVisual = useCallback(() => {
    const canvas = displayCanvasRef.current;
    const context = canvas?.getContext("2d");
    const material = selectedRef.current;
    if (!canvas || !context || !material) return;
    const image = imageRef.current;
    if (image) drawContained(context, image, image.naturalWidth, image.naturalHeight, material.state);
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

  const loadDocumentPage = useCallback(async (material: ClassroomMaterialRecord, runtime: RuntimeDocument) => {
    const manifest = material.documentManifest;
    if (!manifest) throw new Error("document_manifest_missing");
    const page = Math.max(1, Math.min(manifest.pageCount, material.state.page));
    const entry = runtime.entries.get(manifest.pages[page - 1]);
    if (!entry || entry.directory) throw new Error("document_page_missing");
    const blob = await entry.getData(new BlobWriter(manifest.mimeType));
    if (runtime.pageUrl) URL.revokeObjectURL(runtime.pageUrl);
    const image = await imageFromBlob(blob);
    runtime.pageUrl = image.src;
    if (imageRef.current?.src.startsWith("blob:")) URL.revokeObjectURL(imageRef.current.src);
    imageRef.current = image;
    await nextFrame();
    renderVisual();
  }, [renderVisual]);

  const prepareSelected = useCallback(async (material: ClassroomMaterialRecord) => {
    await disposeRuntime();
    const display = displayCanvasRef.current;
    const publisher = publishCanvasRef.current;
    const visual = material.kind === "document" || material.kind === "image";
    if (!publisher || (visual && !display)) throw new Error("presentation_surface_missing");
    const width = visual ? DOCUMENT_WIDTH : VIDEO_WIDTH;
    const height = visual ? DOCUMENT_HEIGHT : VIDEO_HEIGHT;
    if (display) {
      display.width = width;
      display.height = height;
    }
    publisher.width = width;
    publisher.height = height;
    if (material.kind === "document") {
      const reader = new ZipReader(new BlobReader(material.source));
      const entries = await reader.getEntries();
      const runtime = { reader, entries: new Map(entries.map((entry) => [entry.filename, entry])), pageUrl: null };
      documentRef.current = runtime;
      await loadDocumentPage(material, runtime);
    } else if (material.kind === "image") {
      imageRef.current = await imageFromBlob(material.source);
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
  }, [disposeRuntime, loadDocumentPage, renderVisual]);

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
    if (!selected || selected.kind !== "document" || !documentRef.current || !canPresent) return;
    void loadDocumentPage(selected, documentRef.current).catch(() => onError("לא ניתן להציג את העמוד שנבחר."));
  }, [canPresent, loadDocumentPage, onError, selected?.state.page]);

  useEffect(() => {
    if ((selected?.kind === "document" || selected?.kind === "image") && imageRef.current) renderVisual();
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
    if (!room || !material || !canPresent || isPreparing || preparingRef.current || isPublished || publishingRef.current) return;
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
  }, [canPresent, isPreparing, isPublished, removePublishedTracks, renderVisual, room, sendPresentationState]);

  useEffect(() => {
    if (!canPresent || !selected) return;
    if (visible && !isPublished && !isPreparing) {
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
  }, [canPresent, isPreparing, isPublished, onError, publish, removePublishedTracks, selected, sendPresentationState, updateSelectedState, visible]);

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
    updateSelectedState({ page: Math.max(1, Math.min(selected.documentManifest.pageCount, page)), panX: 0, panY: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    if (laserMode) {
      laserRef.current = { x, y };
      renderVisual();
    } else if (panStartRef.current) {
      updateSelectedState({
        panX: panStartRef.current.panX + x - panStartRef.current.x,
        panY: panStartRef.current.panY + y - panStartRef.current.y
      });
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
          <button onClick={() => changePage(selected.state.page - 1)} disabled={selected.state.page <= 1}><ChevronRight className="size-4" /></button>
          <input type="number" min={1} max={selected.documentManifest?.pageCount} value={selected.state.page} onChange={(event) => changePage(Number(event.target.value))} className="w-12 rounded bg-slate-800 px-1 py-1 text-center" />
          <span>/ {selected.documentManifest?.pageCount}</span>
          <button onClick={() => changePage(selected.state.page + 1)} disabled={selected.state.page >= (selected.documentManifest?.pageCount ?? 1)}><ChevronLeft className="size-4" /></button>
        </>}
        {visual && <>
          <button onClick={() => updateSelectedState({ zoom: Math.max(0.25, selected.state.zoom - 0.15) })} title="הקטן"><ZoomOut className="size-4" /></button>
          <button onClick={() => updateSelectedState({ zoom: Math.min(8, selected.state.zoom + 0.15) })} title="הגדל"><ZoomIn className="size-4" /></button>
          <button onClick={() => updateSelectedState({ zoom: 1, panX: 0, panY: 0 })} title="התאם עמוד">התאם עמוד</button>
          <button onClick={() => {
            const image = imageRef.current;
            if (!image) return;
            const baseScale = Math.min(DOCUMENT_WIDTH / image.naturalWidth, DOCUMENT_HEIGHT / image.naturalHeight);
            updateSelectedState({ zoom: (DOCUMENT_WIDTH / image.naturalWidth) / baseScale, panX: 0, panY: 0 });
          }} title="התאם רוחב">התאם רוחב</button>
          <button onClick={() => updateSelectedState({ zoom: 1, panX: 0, panY: 0 })} title="איפוס"><RotateCcw className="size-4" /></button>
          <button onClick={() => { setLaserMode((value) => !value); laserRef.current = null; renderVisual(); }} className={laserMode ? "rounded bg-rose-600 px-2 py-1" : "rounded bg-slate-800 px-2 py-1"}>לייזר</button>
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
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        {visual && <canvas
          ref={displayCanvasRef}
          className={`h-full w-full object-contain ${laserMode ? "cursor-crosshair" : selected.state.zoom > 1 ? "cursor-grab" : ""}`}
          onPointerDown={(event) => {
            if (laserMode) return;
            const rect = event.currentTarget.getBoundingClientRect();
            panStartRef.current = {
              x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
              y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
              panX: selected.state.panX,
              panY: selected.state.panY
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { panStartRef.current = null; }}
          onPointerLeave={() => { if (laserMode) { laserRef.current = null; renderVisual(); } }}
        />}
        {selected.kind === "video" && <video key={selected.id} ref={(element) => { mediaRef.current = element; }} controls playsInline className="h-full w-full object-contain" onTimeUpdate={(event) => updateSelectedState({ currentTime: event.currentTarget.currentTime })} onPlay={() => updateSelectedState({ wasPlaying: true })} onPause={() => updateSelectedState({ wasPlaying: false })} onVolumeChange={(event) => updateSelectedState({ volume: event.currentTarget.volume })} onRateChange={(event) => updateSelectedState({ playbackRate: event.currentTarget.playbackRate })} />}
        {selected.kind === "audio" && <audio key={selected.id} ref={(element) => { mediaRef.current = element; }} controls className="w-full max-w-2xl" onTimeUpdate={(event) => updateSelectedState({ currentTime: event.currentTarget.currentTime })} onPlay={() => updateSelectedState({ wasPlaying: true })} onPause={() => updateSelectedState({ wasPlaying: false })} onVolumeChange={(event) => updateSelectedState({ volume: event.currentTarget.volume })} onRateChange={(event) => updateSelectedState({ playbackRate: event.currentTarget.playbackRate })} />}
        {isPreparing && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm font-bold">מכין חומר להצגה...</div>}
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
