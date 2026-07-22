/**
 * Utilities for downscaling and recompressing image files inside Excalidraw.
 */

export const MAX_IMAGE_DIMENSION = 640;
export const IMAGE_QUALITY = 0.5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024; // 10 KB - always compress to keep updates tiny!
export const MAX_IMAGES_PER_BOARD = 10;

export async function compressImage(
  dataUrl: string,
  maxDimension = MAX_IMAGE_DIMENSION,
  quality = IMAGE_QUALITY
): Promise<string> {
  // If not a data url or not an image, return as is
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Always compress to WebP format for minimal size
      const compressed = canvas.toDataURL("image/webp", quality);
      resolve(compressed);
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

/**
 * Returns the size in bytes of a base64 encoded dataURL string
 */
export function getBase64Size(dataUrl: string): number {
  const base64Str = dataUrl.split(",")[1];
  if (!base64Str) return 0;
  return Math.round((base64Str.length * 3) / 4);
}
