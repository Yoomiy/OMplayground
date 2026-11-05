let browserDigest: Promise<string | undefined> | undefined;

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Cheap, best-effort browser/device signature. No IP, name, cookies or storage.
 * Compute the canvas once per page, and scope the resulting hash to the room.
 */
export async function classroomGuestFingerprint(roomCode: string): Promise<string | undefined> {
  browserDigest ??= (async () => {
    let canvasSignature = "";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 280;
      canvas.height = 50;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#e78";
        context.fillRect(5, 3, 70, 32);
        context.font = "17px Arial";
        context.fillStyle = "#246";
        context.fillText("Playground שלום 0123456789", 8, 24);
        canvasSignature = canvas.toDataURL();
      }
    } catch { /* Browsers may restrict canvas access. Other signals still work. */ }
    return digest(JSON.stringify([
      navigator.platform, navigator.vendor,
      // Browser family/OS, without frequent browser version changes.
      navigator.userAgent.replace(/\d+(?:[._]\d+)*/g, ""),
      navigator.languages, navigator.hardwareConcurrency,
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      navigator.maxTouchPoints,
      [screen.width, screen.height].sort((a, b) => a - b), screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasSignature,
    ]));
  })().catch(() => undefined);
  const browser = await browserDigest;
  if (!browser) return undefined;
  return digest(JSON.stringify([roomCode, browser]))
    .then((hash) => `v1:${hash}`)
    .catch(() => undefined);
}
