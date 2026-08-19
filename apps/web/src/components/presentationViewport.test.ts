import { describe, expect, it } from "vitest";
import {
  clampDocumentScroll,
  clampPresentationViewport,
  documentPageAt,
  presentationFitHeightZoom,
  presentationFitWidthZoom,
  presentationPanBounds,
  scrollDocumentByPixels,
  zoomPresentationAt
} from "./presentationViewport";

const dimensions = {
  canvasWidth: 1600,
  canvasHeight: 900,
  contentWidth: 800,
  contentHeight: 1200
};

describe("presentation viewport", () => {
  it("clamps zoom and pan to the visible content bounds", () => {
    expect(clampPresentationViewport({ zoom: 20, panX: 20_000, panY: -20_000 }, dimensions)).toEqual({
      zoom: 8,
      panX: 1600,
      panY: -3150
    });
  });

  it("keeps the pointed-at content location stable while zooming", () => {
    const result = zoomPresentationAt(
      { zoom: 1, panX: 0, panY: 0 },
      2,
      1200,
      450,
      { canvasWidth: 1600, canvasHeight: 900, contentWidth: 1600, contentHeight: 900 }
    );
    expect(result.zoom).toBe(2);
    expect(result.panX).toBe(-400);
    expect(result.panY).toBe(0);
  });

  it("computes fit-width zoom relative to fit-page", () => {
    expect(presentationFitWidthZoom(dimensions)).toBeCloseTo(8 / 3);
    expect(presentationFitHeightZoom(dimensions)).toBe(1);
    expect(presentationPanBounds(dimensions, 1)).toEqual({ x: 0, y: 0 });
  });

  it("supports an explicit base scale for a document-strip cell", () => {
    const strip = { canvasWidth: 1600, canvasHeight: 900, contentWidth: 1440, contentHeight: 810, baseScale: 1 };
    expect(presentationPanBounds(strip, 1)).toEqual({ x: 0, y: 0 });
    expect(presentationFitWidthZoom(strip)).toBeCloseTo(10 / 9);
    expect(presentationFitHeightZoom(strip)).toBeCloseTo(10 / 9);
  });

  it("scrolls continuously through pages without threshold jumps", () => {
    expect(scrollDocumentByPixels(2, 333, 1332, 10)).toBeCloseTo(2.25);
    expect(documentPageAt(2.49, 10)).toBe(3);
    expect(documentPageAt(2.51, 10)).toBe(4);
    expect(clampDocumentScroll(-2, 10)).toBe(0);
    expect(clampDocumentScroll(20, 10)).toBe(9);
  });
});
