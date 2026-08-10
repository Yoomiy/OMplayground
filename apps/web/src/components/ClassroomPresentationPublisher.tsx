import { useCallback, useEffect, useRef, useState } from "react";
import { Track, type Room } from "livekit-client";
import { FileText, Image as ImageIcon, Music, Pause, Play, Presentation, Square, Video } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type MediaKind = "pdf" | "image" | "video" | "audio";

interface Props {
  room: Room | null;
  roomCode: string;
  canPresent: boolean;
  classroomRequest: (path: string, body: Record<string, unknown>) => Promise<Response>;
  onActiveChange: (active: boolean) => void;
  onError: (message: string) => void;
}

function mediaKind(file: File): MediaKind | null {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

function drawContain(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, zoom = 1) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / sourceWidth, height / sourceHeight) * zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function ClassroomPresentationPublisher({
  room,
  roomCode,
  canPresent,
  classroomRequest,
  onActiveChange,
  onError
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pdfRef = useRef<any>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [active, setActive] = useState(false);
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [paused, setPaused] = useState(false);

  const renderPdfPage = useCallback(async (nextPage: number) => {
    const document = pdfRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas) return;
    const pdfPage = await document.getPage(nextPage);
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const scale = Math.min(1280 / viewport.width, 720 / viewport.height);
    const finalViewport = pdfPage.getViewport({ scale: 1.5 * scale });
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#020617";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const offsetX = (canvas.width - finalViewport.width) / 2;
    const offsetY = (canvas.height - finalViewport.height) / 2;
    context.save();
    context.translate(offsetX, offsetY);
    await pdfPage.render({ canvasContext: context, viewport: finalViewport }).promise;
    context.restore();
    setPage(nextPage);
  }, []);

  const drawAudioFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const time = Date.now() / 300;
    context.fillStyle = "#818cf8";
    for (let x = 0; x < canvas.width; x += 18) {
      const bar = 60 + Math.abs(Math.sin(time + x / 100)) * 260;
      context.fillRect(x, (canvas.height - bar) / 2, 10, bar);
    }
    context.fillStyle = "#e2e8f0";
    context.font = "bold 36px sans-serif";
    context.textAlign = "center";
    context.fillText(title || "מצגת שמע", canvas.width / 2, 110);
  }, [title]);

  const stop = useCallback(async (notify = true) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = "";
    }
    for (const track of publishedTracksRef.current) {
      try { await room?.localParticipant.unpublishTrack(track, true); } catch {}
      track.stop();
    }
    publishedTracksRef.current = [];
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    pdfRef.current = null;
    imageRef.current = null;
    setActive(false);
    setKind(null);
    setPaused(false);
    setPageCount(0);
    onActiveChange(false);
    if (notify && roomCode) {
      const response = await classroomRequest("/rtc/classroom-presentation-state", { roomCode, action: "stopped" });
      if (!response.ok) onError("המצגת נעצרה מקומית, אך לא ניתן לעדכן את המשתתפים.");
    }
  }, [classroomRequest, onActiveChange, onError, room, roomCode]);

  useEffect(() => () => { void stop(false); }, [stop]);

  const start = useCallback(async (file: File) => {
    if (!room) return;
    const nextKind = mediaKind(file);
    if (!nextKind) {
      onError("ניתן להציג PDF, תמונה, וידאו או קובץ שמע בלבד.");
      return;
    }
    await stop(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.width = 1280;
      canvas.height = 720;
      const nextTitle = file.name.replace(/\.[^.]+$/, "").slice(0, 100);
      setTitle(nextTitle);
      setKind(nextKind);
      objectUrlRef.current = URL.createObjectURL(file);

      if (nextKind === "pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        pdfRef.current = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        setPageCount(pdfRef.current.numPages);
        await renderPdfPage(1);
      } else if (nextKind === "image") {
        const image = new Image();
        image.src = objectUrlRef.current;
        await image.decode();
        imageRef.current = image;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas_not_available");
        drawContain(context, image, image.naturalWidth, image.naturalHeight);
      } else {
        const video = document.createElement("video");
        video.src = objectUrlRef.current;
        video.preload = "auto";
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("media_decode_failed"));
        });
        videoRef.current = video;
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);
        await audioContext.resume();
        audioContextRef.current = audioContext;
        const drawFrame = () => {
          const context = canvas.getContext("2d");
          if (!context) return;
          if (nextKind === "video" && video.videoWidth && video.videoHeight) {
            drawContain(context, video, video.videoWidth, video.videoHeight);
          } else {
            drawAudioFrame();
          }
          animationRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();
        await video.play();
        const stream = canvas.captureStream(24);
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        const tracks = stream.getTracks();
        const videoTrack = tracks.find((track) => track.kind === "video");
        if (!videoTrack) throw new Error("presentation_video_track_missing");
        await room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          name: "classroom-presentation-video",
          stream: "classroom-presentation"
        });
        const audioTrack = tracks.find((track) => track.kind === "audio");
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.ScreenShareAudio,
            name: "classroom-presentation-audio",
            stream: "classroom-presentation"
          });
        }
        publishedTracksRef.current = tracks;
      }

      if (nextKind === "pdf" || nextKind === "image") {
        const videoTrack = canvas.captureStream(24).getVideoTracks()[0];
        if (!videoTrack) throw new Error("presentation_video_track_missing");
        await room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          name: "classroom-presentation-video",
          stream: "classroom-presentation"
        });
        publishedTracksRef.current = [videoTrack];
      }

      const response = await classroomRequest("/rtc/classroom-presentation-state", {
        roomCode,
        action: "started",
        title: nextTitle,
        mediaKind: nextKind,
        presenterIdentity: room.localParticipant.identity
      });
      if (!response.ok) throw new Error("presentation_state_rejected");
      setActive(true);
      onActiveChange(true);
    } catch (error) {
      console.error("Classroom presentation start failed", error);
      await stop(false);
      onError("לא ניתן להתחיל את המצגת. נסה קובץ אחר או השתמש בשיתוף מסך.");
    }
  }, [classroomRequest, drawAudioFrame, onActiveChange, onError, renderPdfPage, room, roomCode, stop]);

  const changePage = useCallback((delta: number) => {
    const next = Math.max(1, Math.min(pageCount, page + delta));
    if (next !== page) void renderPdfPage(next).catch(() => onError("לא ניתן להציג את עמוד ה-PDF המבוקש."));
  }, [onError, page, pageCount, renderPdfPage]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => onError("לא ניתן להמשיך את ניגון המדיה."));
    } else {
      video.pause();
      setPaused(true);
    }
  }, [onError]);

  if (!canPresent) return <canvas ref={canvasRef} className="hidden" aria-hidden="true" />;

  const Icon = kind === "pdf" ? FileText : kind === "image" ? ImageIcon : kind === "audio" ? Music : Video;
  return (
    <div className="flex items-center gap-1.5">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <input ref={inputRef} type="file" accept="application/pdf,image/*,video/*,audio/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void start(file);
      }} />
      {!active ? (
        <button onClick={() => inputRef.current?.click()} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-fuchsia-500 flex items-center gap-1.5">
          <Presentation className="size-3.5" /> הצג מדיה
        </button>
      ) : (
        <div className="flex items-center gap-1 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-1 text-xs font-bold text-fuchsia-100">
          <span className="hidden max-w-28 truncate sm:inline flex items-center gap-1"><Icon className="size-3.5" />{title}</span>
          {(kind === "video" || kind === "audio") && <button onClick={togglePlayback} className="rounded-lg p-1 hover:bg-fuchsia-500/20" title={paused ? "המשך" : "השהה"}>{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>}
          {kind === "pdf" && <><button onClick={() => changePage(-1)} disabled={page <= 1} className="rounded-lg px-1.5 py-1 hover:bg-fuchsia-500/20 disabled:opacity-40">הקודם</button><span>{page}/{pageCount}</span><button onClick={() => changePage(1)} disabled={page >= pageCount} className="rounded-lg px-1.5 py-1 hover:bg-fuchsia-500/20 disabled:opacity-40">הבא</button></>}
          <button onClick={() => void stop()} className="rounded-lg bg-rose-600 px-2 py-1 text-white hover:bg-rose-500 flex items-center gap-1"><Square className="size-3" /> עצור</button>
        </div>
      )}
    </div>
  );
}
