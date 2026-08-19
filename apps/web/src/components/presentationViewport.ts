export interface PresentationViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface PresentationSurfaceDimensions {
  canvasWidth: number;
  canvasHeight: number;
  contentWidth: number;
  contentHeight: number;
  baseScale?: number;
}

export const MIN_PRESENTATION_ZOOM = 0.25;
export const MAX_PRESENTATION_ZOOM = 8;

export function presentationCanvasSize(
  containerWidth: number,
  containerHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  if (containerWidth <= 0 || containerHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: Math.max(1, Math.round(maxWidth)), height: Math.max(1, Math.round(maxHeight)) };
  }
  const scale = Math.min(maxWidth / containerWidth, maxHeight / containerHeight);
  return {
    width: Math.max(1, Math.round(containerWidth * scale)),
    height: Math.max(1, Math.round(containerHeight * scale))
  };
}

export function presentationPageStride(
  canvasWidth: number,
  canvasHeight: number,
  pageWidth: number,
  pageHeight: number,
  zoom: number,
  cellScale: number,
  gap: number
) {
  const scale = Math.min(
    (canvasWidth * cellScale) / pageWidth,
    (canvasHeight * cellScale) / pageHeight
  );
  return (pageHeight * scale + gap) * zoom;
}

export function clampPresentationZoom(zoom: number) {
  return Math.max(MIN_PRESENTATION_ZOOM, Math.min(MAX_PRESENTATION_ZOOM, zoom));
}

export function presentationPanBounds(dimensions: PresentationSurfaceDimensions, zoom: number) {
  const baseScale = dimensions.baseScale ?? Math.min(
    dimensions.canvasWidth / dimensions.contentWidth,
    dimensions.canvasHeight / dimensions.contentHeight
  );
  const width = dimensions.contentWidth * baseScale * zoom;
  const height = dimensions.contentHeight * baseScale * zoom;
  return {
    x: Math.max(0, (width - dimensions.canvasWidth) / 2),
    y: Math.max(0, (height - dimensions.canvasHeight) / 2)
  };
}

export function clampPresentationViewport(
  viewport: PresentationViewport,
  dimensions: PresentationSurfaceDimensions
): PresentationViewport {
  const zoom = clampPresentationZoom(viewport.zoom);
  const bounds = presentationPanBounds(dimensions, zoom);
  return {
    zoom,
    panX: Math.max(-bounds.x, Math.min(bounds.x, viewport.panX)),
    panY: Math.max(-bounds.y, Math.min(bounds.y, viewport.panY))
  };
}

export function zoomPresentationAt(
  viewport: PresentationViewport,
  nextZoom: number,
  anchorX: number,
  anchorY: number,
  dimensions: PresentationSurfaceDimensions
): PresentationViewport {
  const zoom = clampPresentationZoom(nextZoom);
  const centerX = dimensions.canvasWidth / 2;
  const centerY = dimensions.canvasHeight / 2;
  const ratio = zoom / viewport.zoom;
  return clampPresentationViewport({
    zoom,
    panX: anchorX - centerX - (anchorX - centerX - viewport.panX) * ratio,
    panY: anchorY - centerY - (anchorY - centerY - viewport.panY) * ratio
  }, dimensions);
}

export function presentationFitWidthZoom(dimensions: PresentationSurfaceDimensions) {
  const baseScale = dimensions.baseScale ?? Math.min(
    dimensions.canvasWidth / dimensions.contentWidth,
    dimensions.canvasHeight / dimensions.contentHeight
  );
  return clampPresentationZoom((dimensions.canvasWidth / dimensions.contentWidth) / baseScale);
}

export function presentationFitHeightZoom(dimensions: PresentationSurfaceDimensions) {
  const baseScale = dimensions.baseScale ?? Math.min(
    dimensions.canvasWidth / dimensions.contentWidth,
    dimensions.canvasHeight / dimensions.contentHeight
  );
  return clampPresentationZoom((dimensions.canvasHeight / dimensions.contentHeight) / baseScale);
}

export function clampDocumentScroll(position: number, pageCount: number) {
  return Math.max(0, Math.min(Math.max(0, pageCount - 1), position));
}

export function scrollDocumentByPixels(position: number, deltaPixels: number, stride: number, pageCount: number) {
  if (!Number.isFinite(stride) || stride <= 0) return clampDocumentScroll(position, pageCount);
  return clampDocumentScroll(position + deltaPixels / stride, pageCount);
}

export function documentPageAt(position: number, pageCount: number) {
  return Math.round(clampDocumentScroll(position, pageCount)) + 1;
}
