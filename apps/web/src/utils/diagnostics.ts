// Hold original before any patching — used inside this file to avoid self-buffering (#9)
const _origWarn = console.warn;

export function getHardwareSpecs() {
  const cpuCores = navigator.hardwareConcurrency || "Unknown";

  // deviceMemory: Chrome / Edge / Opera only
  const deviceMemory = (navigator as any).deviceMemory
    ? `${(navigator as any).deviceMemory} GB`
    : "Unknown";

  // GPU via WebGL debug extension
  let gpu = "Unknown";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    }
  } catch (e) {
    _origWarn("diagnostics: failed to get GPU info", e); // uses original — won't re-buffer
  }

  return { cpuCores, deviceMemory, gpu };
}

export function getBrowserSpecs() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pathname: window.location.pathname,
  };
}

interface LogEntry {
  level: string;
  msg: string;
  time: string;
  count: number;
  addedAt: number;
}

const _LOG_BUFFER: LogEntry[] = [];
const MAX_LOGS = 100;
const COOLDOWN_MS = 3000; // 3 seconds cooldown for identical messages

const _recentLogs = new Map<string, LogEntry>();

const _orig = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

function _buffer(level: string, args: unknown[]) {
  const msg = args
    .map((a) => {
      if (typeof a === "object") {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    })
    .join(" ");

  const key = `${level}:${msg}`;
  const now = Date.now();
  const existing = _recentLogs.get(key);

  if (existing && (now - existing.addedAt) < COOLDOWN_MS) {
    existing.count++;
    existing.time = new Date(now).toISOString(); // Update timestamp to latest occurrence
    return;
  }

  // Create a new entry
  const newEntry: LogEntry = {
    level,
    msg,
    time: new Date(now).toISOString(),
    count: 1,
    addedAt: now,
  };

  _LOG_BUFFER.push(newEntry);
  _recentLogs.set(key, newEntry);

  if (_LOG_BUFFER.length > MAX_LOGS) {
    const oldest = _LOG_BUFFER.shift();
    if (oldest) {
      const oldestKey = `${oldest.level}:${oldest.msg}`;
      // Clean up map entry only if it is still pointing to the same shifted object reference
      if (_recentLogs.get(oldestKey) === oldest) {
        _recentLogs.delete(oldestKey);
      }
    }
  }
}

console.log   = (...args) => { _buffer("info",  args); _orig.log.apply(console,   args); };
console.warn  = (...args) => { _buffer("warn",  args); _orig.warn.apply(console,  args); };
console.error = (...args) => { _buffer("error", args); _orig.error.apply(console, args); };

export function getBufferedLogs() {
  // Return snapshot copy without the internal `addedAt` timestamp
  return _LOG_BUFFER.map(({ level, msg, time, count }) => ({ level, msg, time, count }));
}

function resizeCanvasIfNeeded(sourceCanvas: HTMLCanvasElement, maxDim = 1280): HTMLCanvasElement {
  const { width, height } = sourceCanvas;
  if (width <= maxDim && height <= maxDim) {
    return sourceCanvas;
  }

  const canvas = document.createElement("canvas");
  const scale = Math.min(maxDim / width, maxDim / height);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

export function captureGameScreenshot(): string | null {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) return null;
  try {
    const resized = resizeCanvasIfNeeded(canvas, 1280);
    // JPEG at 50% quality — typically 15–40 KB
    return resized.toDataURL("image/jpeg", 0.5);
  } catch {
    // SecurityError if canvas is cross-origin tainted (unlikely in this app)
    return null;
  }
}

export async function captureFullViewportScreenshot(): Promise<string | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" } as any,
      audio: false,
      preferCurrentTab: true,          // Pre-select and highlight the current game tab
      selfBrowserSurface: "include",   // Explicitly include current tab in the prompt options
    } as any);

    const video = document.createElement("video");
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(() => resolve()).catch(reject);
      };
      video.onerror = reject;
    });

    const maxDim = 1280;
    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement("canvas");
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Stop all tracks to release the stream
    stream.getTracks().forEach((track) => track.stop());

    // JPEG at 50% quality — typically 20–50 KB
    return canvas.toDataURL("image/jpeg", 0.5);
  } catch (e) {
    _origWarn("diagnostics: failed to capture full viewport screenshot", e);
    return null;
  }
}
