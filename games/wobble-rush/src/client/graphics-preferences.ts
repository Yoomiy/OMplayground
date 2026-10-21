import {
  GRAPHICS_QUALITY_KEY,
  type GraphicsQuality,
  isGraphicsQuality,
} from "../shared/graphics-quality"
export function loadGraphicsQuality(): GraphicsQuality {
  try {
    const value = localStorage.getItem(GRAPHICS_QUALITY_KEY)
    return isGraphicsQuality(value) ? value : "balanced"
  } catch {
    return "balanced"
  }
}
export function saveGraphicsQuality(quality: GraphicsQuality): void {
  try {
    localStorage.setItem(GRAPHICS_QUALITY_KEY, quality)
  } catch {
    /* Storage restrictions must not prevent changing graphics. */
  }
}
