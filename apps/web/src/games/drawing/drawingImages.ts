/**
 * Utilities for downscaling and recompressing image files inside Excalidraw.
 */

export const MAX_IMAGE_DIMENSION = 1280;
export const IMAGE_QUALITY = 0.7;
export const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
export const MAX_IMAGES_PER_BOARD = 10;

export async function compressImage(
  dataUrl: string,
  maxDimension = MAX_IMAGE_DIMENSION,
  quality = IMAGE_QUALITY
): Promise<string> {
  // If not a data url or not an image, return as is
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
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
      
      const originalType = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
      // Convert to webp if original is png/webp, otherwise jpeg
      const outputType =
        originalType.includes("png") || originalType.includes("webp")
          ? "image/webp"
          : "image/jpeg";

      const compressed = canvas.toDataURL(outputType, quality);
      resolve(compressed);
    };
    img.onerror = (err) => {
      reject(err);
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
