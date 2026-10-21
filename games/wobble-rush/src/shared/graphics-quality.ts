/** Presentation-only budgets. They never alter physics, input or network timing. */
export type GraphicsQuality = "low" | "balanced" | "high"
export const GRAPHICS_QUALITY_KEY = "wobble:graphics-quality:v1"
export const GRAPHICS_QUALITY = {
  low: { pixelRatio: 1, maxPixels: 1280 * 720, shadowSize: 0 },
  balanced: { pixelRatio: 1.25, maxPixels: 1920 * 1080, shadowSize: 1024 },
  high: { pixelRatio: 2, maxPixels: 3840 * 2160, shadowSize: 2048 },
} as const
export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === "low" || value === "balanced" || value === "high"
}
export function graphicsPixelRatio(
  quality: GraphicsQuality,
  width: number,
  height: number,
  deviceRatio: number,
): number {
  const preset = GRAPHICS_QUALITY[quality]
  const pixels = Math.max(1, width) * Math.max(1, height)
  return Math.min(
    Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1,
    preset.pixelRatio,
    Math.sqrt(preset.maxPixels / pixels),
  )
}
