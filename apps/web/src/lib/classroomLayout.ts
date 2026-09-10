export type CameraRailOrientation = "top" | "side";

export const CAMERA_ASPECT_RATIO = 16 / 9;
export const DEFAULT_CAMERA_TILE_HEIGHT = 120;
export const MIN_CAMERA_TILE_HEIGHT = 96;
export const MAX_NO_BOARD_TILE_HEIGHT = 360;
export const CAMERA_GRID_GAP = 8;

const CAMERA_GRID_CHROME = 14;
const CAMERA_STAGE_SEPARATOR_SPACE = 36;
const MIN_BOARD_HEIGHT = 220;
const MIN_SIDE_STAGE_WIDTH = 480;
const MAX_VISIBLE_CAMERA_ROWS = 5;

export interface CameraGridLayout {
  visibleRows: number;
  tileHeight: number;
  tileWidth: number;
  gridSize: number;
  columns: number;
  capacity: number;
  overflow: boolean;
}

function outerGridHeight(tileHeight: number, rows: number): number {
  return CAMERA_GRID_CHROME + tileHeight * rows + CAMERA_GRID_GAP * (rows - 1);
}

function columnsFor(width: number, tileWidth: number): number {
  const innerWidth = Math.max(1, width - CAMERA_GRID_CHROME);
  return Math.max(1, Math.floor((innerWidth + CAMERA_GRID_GAP) / (tileWidth + CAMERA_GRID_GAP)));
}

function topLayout(width: number, gridSize: number, rows: number, participantCount: number): CameraGridLayout {
  const innerHeight = Math.max(MIN_CAMERA_TILE_HEIGHT, gridSize - CAMERA_GRID_CHROME);
  const requestedTileHeight = Math.max(
    MIN_CAMERA_TILE_HEIGHT,
    (innerHeight - CAMERA_GRID_GAP * (rows - 1)) / rows
  );
  const maximumWidthBoundHeight = Math.max(
    MIN_CAMERA_TILE_HEIGHT,
    (width - CAMERA_GRID_CHROME) / CAMERA_ASPECT_RATIO
  );
  const tileHeight = Math.min(requestedTileHeight, maximumWidthBoundHeight);
  const tileWidth = tileHeight * CAMERA_ASPECT_RATIO;
  const columns = columnsFor(width, tileWidth);
  const capacity = rows * columns;
  return {
    visibleRows: rows,
    tileHeight,
    tileWidth,
    gridSize: outerGridHeight(tileHeight, rows),
    columns,
    capacity,
    overflow: participantCount > capacity
  };
}

export function cameraRailBounds(available: number, orientation: CameraRailOrientation): { min: number; max: number } {
  if (orientation === "side") {
    const min = Math.ceil(MIN_CAMERA_TILE_HEIGHT * CAMERA_ASPECT_RATIO + CAMERA_GRID_CHROME);
    const max = Math.max(min, Math.min(520, Math.floor(available * 0.6), available - MIN_SIDE_STAGE_WIDTH - CAMERA_STAGE_SEPARATOR_SPACE));
    return { min, max };
  }

  const min = outerGridHeight(MIN_CAMERA_TILE_HEIGHT, 1);
  const fiveRows = outerGridHeight(MIN_CAMERA_TILE_HEIGHT, MAX_VISIBLE_CAMERA_ROWS);
  const max = Math.max(min, Math.min(fiveRows, Math.floor(available * 0.6), available - MIN_BOARD_HEIGHT - CAMERA_STAGE_SEPARATOR_SPACE));
  return { min, max };
}

export function clampCameraRailSize(size: number, available: number, orientation: CameraRailOrientation): number {
  const { min, max } = cameraRailBounds(available, orientation);
  return Math.min(max, Math.max(min, Math.round(size)));
}

export function resolveBoardCameraLayout(args: {
  availableWidth: number;
  availableHeight: number;
  participantCount: number;
  requestedHeight?: number | null;
}): CameraGridLayout {
  const { availableWidth, availableHeight, participantCount, requestedHeight } = args;
  const bounds = cameraRailBounds(availableHeight, "top");

  if (requestedHeight == null) {
    const oneRow = topLayout(
      availableWidth,
      Math.min(bounds.max, outerGridHeight(DEFAULT_CAMERA_TILE_HEIGHT, 1)),
      1,
      participantCount
    );
    const twoRowHeight = outerGridHeight(MIN_CAMERA_TILE_HEIGHT, 2);
    if (participantCount > oneRow.capacity && twoRowHeight <= bounds.max) {
      return topLayout(availableWidth, twoRowHeight, 2, participantCount);
    }
    return oneRow;
  }

  const gridSize = clampCameraRailSize(requestedHeight, availableHeight, "top");
  const innerHeight = gridSize - CAMERA_GRID_CHROME;
  const supportedRows = Math.max(1, Math.min(
    MAX_VISIBLE_CAMERA_ROWS,
    Math.floor((innerHeight + CAMERA_GRID_GAP) / (MIN_CAMERA_TILE_HEIGHT + CAMERA_GRID_GAP))
  ));

  for (let rows = 1; rows <= supportedRows; rows += 1) {
    const candidate = topLayout(availableWidth, gridSize, rows, participantCount);
    if (candidate.capacity >= participantCount) return candidate;
  }
  return topLayout(availableWidth, gridSize, supportedRows, participantCount);
}

export function resolveSideCameraLayout(args: {
  availableWidth: number;
  participantCount: number;
  requestedWidth?: number | null;
}): CameraGridLayout {
  const { availableWidth, participantCount, requestedWidth } = args;
  const defaultWidth = DEFAULT_CAMERA_TILE_HEIGHT * CAMERA_ASPECT_RATIO + CAMERA_GRID_CHROME;
  const gridSize = clampCameraRailSize(requestedWidth ?? defaultWidth, availableWidth, "side");
  const tileWidth = Math.max(MIN_CAMERA_TILE_HEIGHT * CAMERA_ASPECT_RATIO, gridSize - CAMERA_GRID_CHROME);
  const tileHeight = tileWidth / CAMERA_ASPECT_RATIO;
  return {
    visibleRows: 1,
    tileHeight,
    tileWidth,
    gridSize: tileWidth + CAMERA_GRID_CHROME,
    columns: 1,
    capacity: 1,
    overflow: participantCount > 1
  };
}

export function clampNoBoardTileHeight(height: number, viewportHeight: number, viewportWidth = Number.POSITIVE_INFINITY): number {
  const widthBoundHeight = (viewportWidth - CAMERA_GRID_CHROME) / CAMERA_ASPECT_RATIO;
  const max = Math.max(MIN_CAMERA_TILE_HEIGHT, Math.min(
    MAX_NO_BOARD_TILE_HEIGHT,
    Math.floor(viewportHeight * 0.8),
    Math.floor(widthBoundHeight)
  ));
  return Math.min(max, Math.max(MIN_CAMERA_TILE_HEIGHT, Math.round(height)));
}

export function resolveNoBoardCameraLayout(args: {
  availableWidth: number;
  availableHeight: number;
  participantCount: number;
  requestedTileHeight: number;
}): CameraGridLayout {
  const { availableWidth, availableHeight, participantCount, requestedTileHeight } = args;
  const tileHeight = clampNoBoardTileHeight(requestedTileHeight, availableHeight, availableWidth);
  const tileWidth = tileHeight * CAMERA_ASPECT_RATIO;
  const columns = columnsFor(availableWidth, tileWidth);
  const visibleRows = Math.max(1, Math.floor(
    (Math.max(1, availableHeight - CAMERA_GRID_CHROME) + CAMERA_GRID_GAP) /
    (tileHeight + CAMERA_GRID_GAP)
  ));
  const capacity = visibleRows * columns;
  return {
    visibleRows,
    tileHeight,
    tileWidth,
    gridSize: availableHeight,
    columns,
    capacity,
    overflow: participantCount > capacity
  };
}
