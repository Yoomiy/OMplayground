import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";

interface Props {
  videoTrack?: any;
  audioTrack?: any;
  title: string | null;
  presenterName: string | null;
}

export function ClassroomPresentationReceiver({ videoTrack, audioTrack, title, presenterName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [hasLiveFrame, setHasLiveFrame] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    setHasLiveFrame(false);
    if (!video || !videoTrack) return;
    videoTrack.attach(video);
    let cancelled = false;
    let frameRequest: number | null = null;
    let receivedFrames = 0;
    const onFrame = () => {
      if (cancelled) return;
      receivedFrames += 1;
      if (receivedFrames >= 2) {
        setHasLiveFrame(true);
        return;
      }
      frameRequest = video.requestVideoFrameCallback(onFrame);
    };
    const onLoadedData = () => {
      if (!("requestVideoFrameCallback" in video)) setHasLiveFrame(true);
    };
    video.addEventListener("loadeddata", onLoadedData);
    if ("requestVideoFrameCallback" in video) frameRequest = video.requestVideoFrameCallback(onFrame);
    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoadedData);
      if (frameRequest !== null && "cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(frameRequest);
      try { videoTrack.detach(video); } catch {}
    };
  }, [videoTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioTrack) return;
    audioTrack.attach(audio);
    return () => { try { audioTrack.detach(audio); } catch {} };
  }, [audioTrack]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!videoTrack || !hasLiveFrame || !video || !canvas || !video.videoWidth || !video.videoHeight) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setHasSnapshot(true);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasLiveFrame, videoTrack]);

  return <div className="relative flex h-full w-full items-center justify-center bg-black">
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-bold text-indigo-300">
      <Monitor className="size-3.5 text-indigo-400" />
      {title ? `מצגת: ${title}` : presenterName ? `מצגת מאת: ${presenterName}` : "מצגת"}
    </div>
    <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-contain ${!videoTrack && hasSnapshot ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
    <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-contain ${videoTrack && hasLiveFrame ? "opacity-100" : "opacity-0"}`} />
    {videoTrack && !hasLiveFrame && <div className="text-center text-sm font-bold text-slate-400">ממתין לשידור המצגת…</div>}
    {!videoTrack && hasSnapshot && <div className="absolute bottom-3 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-amber-200">המגיש מתחבר מחדש…</div>}
    {!videoTrack && !hasSnapshot && <div className="text-center text-sm font-bold text-slate-400">{title ? "ממתין לשידור המצגת…" : "לוח המדיה פתוח — המגיש עדיין לא הוסיף חומר."}</div>}
    <audio ref={audioRef} autoPlay />
  </div>;
}
