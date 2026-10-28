import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_TILE_HEIGHT,
  MIN_CAMERA_TILE_HEIGHT,
  boardCameraRailBounds,
  cameraRailBounds,
  clampNoBoardTileHeight,
  resolveBoardCameraLayout,
  resolveNoBoardCameraLayout
} from "./classroomLayout";

describe("classroom camera layout", () => {
  it("starts with one comfortable row when participants fit", () => {
    const layout = resolveBoardCameraLayout({ availableWidth: 1000, availableHeight: 700, participantCount: 4 });
    expect(layout.visibleRows).toBe(1);
    expect(layout.tileHeight).toBe(DEFAULT_CAMERA_TILE_HEIGHT);
    expect(layout.capacity).toBeGreaterThanOrEqual(4);
  });

  it("grows the default area to two minimum-height rows when needed", () => {
    const layout = resolveBoardCameraLayout({ availableWidth: 1000, availableHeight: 700, participantCount: 6 });
    expect(layout.visibleRows).toBe(2);
    expect(layout.tileHeight).toBe(MIN_CAMERA_TILE_HEIGHT);
    expect(layout.gridSize).toBe(214);
    expect(layout.columns).toBe(3);
  });

  it("keeps one row when a short viewport cannot safely fit two", () => {
    const layout = resolveBoardCameraLayout({ availableWidth: 1000, availableHeight: 400, participantCount: 12 });
    expect(layout.visibleRows).toBe(1);
    expect(layout.overflow).toBe(true);
  });

  it("derives complete equal rows from a manually resized area", () => {
    const layout = resolveBoardCameraLayout({
      availableWidth: 1000,
      availableHeight: 900,
      participantCount: 10,
      requestedHeight: 435
    });
    expect(layout.visibleRows).toBe(3);
    expect(layout.tileHeight).toBeCloseTo(135);
    expect(layout.gridSize).toBeCloseTo(435);
  });

  it("caps manual camera space while preserving the board floor", () => {
    expect(cameraRailBounds(600, "top").max).toBe(344);
  });

  it("limits a sparse board rail to the full-width size of one useful row", () => {
    const bounds = boardCameraRailBounds({
      availableWidth: 1000,
      availableHeight: 900,
      participantCount: 2
    });
    const layout = resolveBoardCameraLayout({
      availableWidth: 1000,
      availableHeight: 900,
      participantCount: 2,
      requestedHeight: 500
    });
    expect(bounds.max).toBeCloseTo(289.0625);
    expect(layout.visibleRows).toBe(1);
    expect(layout.tileHeight).toBeCloseTo(275.0625);
    expect(layout.gridSize).toBeCloseTo(289.0625);
    expect(layout.columns).toBe(2);
  });

  it("allows another complete row when the participants can use it", () => {
    const bounds = boardCameraRailBounds({
      availableWidth: 1000,
      availableHeight: 900,
      participantCount: 4
    });
    const layout = resolveBoardCameraLayout({
      availableWidth: 1000,
      availableHeight: 900,
      participantCount: 4,
      requestedHeight: 500
    });
    expect(bounds.max).toBe(540);
    expect(layout.visibleRows).toBe(2);
    expect(layout.tileHeight).toBe(239);
    expect(layout.gridSize).toBe(500);
    expect(layout.columns).toBe(2);
    expect(boardCameraRailBounds({
      availableWidth: 1000,
      availableHeight: 1200,
      participantCount: 1
    }).max).toBeCloseTo(568.625);
  });

  it("clamps no-board resizing and uses vertical grid capacity", () => {
    expect(clampNoBoardTileHeight(40, 600)).toBe(MIN_CAMERA_TILE_HEIGHT);
    expect(clampNoBoardTileHeight(900, 400)).toBe(320);
    expect(clampNoBoardTileHeight(360, 500, 400)).toBe(217);
    const layout = resolveNoBoardCameraLayout({
      availableWidth: 1000,
      availableHeight: 500,
      participantCount: 20,
      requestedTileHeight: 120
    });
    expect(layout.tileHeight).toBe(120);
    expect(layout.columns).toBe(4);
    expect(layout.overflow).toBe(true);
  });
});
