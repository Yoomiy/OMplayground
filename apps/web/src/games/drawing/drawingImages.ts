/**
 * Utilities for downscaling and recompressing image files inside Excalidraw.
 */

export const MAX_IMAGE_DIMENSION = 1280;
export const MIN_IMAGE_DIMENSION = 256;
export const MAX_FILE_SIZE_BYTES = 256 * 1024;
export const MAX_IMAGES_PER_BOARD = 10;

export function isImageDataUrl(dataUrl: unknown): dataUrl is string {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/");
}

function dimensionsWithinLimit(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  if (width >= height) {
    return { width: maxDimension, height: Math.max(1, Math.round((height * maxDimension) / width)) };
  }
  return { width: Math.max(1, Math.round((width * maxDimension) / height)), height: maxDimension };
}

/**
 * Produces a board-safe image asset. Returning null means the browser could
 * not reduce the image enough to keep the shared Yjs document bounded.
 */
export async function prepareImageForBoard(dataUrl: string): Promise<string | null> {
  if (!isImageDataUrl(dataUrl)) return null;
  if (getBase64Size(dataUrl) <= MAX_FILE_SIZE_BYTES) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      let dimension = MAX_IMAGE_DIMENSION;
      while (dimension >= MIN_IMAGE_DIMENSION) {
        const { width, height } = dimensionsWithinLimit(img.width, img.height, dimension);
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of [0.82, 0.7, 0.58, 0.45, 0.35]) {
          const compressed = canvas.toDataURL("image/webp", quality);
          if (getBase64Size(compressed) <= MAX_FILE_SIZE_BYTES) {
            resolve(compressed);
            return;
          }
        }
        dimension = Math.floor(dimension * 0.7);
      }

      resolve(null);
    };
    img.onerror = () => {
      resolve(null);
    };
  });
}

// Kept as the existing public helper for non-classroom checkpoint callers.
export async function compressImage(dataUrl: string): Promise<string> {
  return (await prepareImageForBoard(dataUrl)) ?? dataUrl;
}

/**
 * Returns the size in bytes of a base64 encoded dataURL string
 */
export function getBase64Size(dataUrl: string): number {
  const base64Str = dataUrl.split(",")[1];
  if (!base64Str) return 0;
  return Math.round((base64Str.length * 3) / 4);
}
