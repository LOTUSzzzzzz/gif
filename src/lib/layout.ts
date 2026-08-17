import type { GridConfig } from "../types";

export interface GridGeometry {
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  gridWidth: number;
  gridHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CellSize {
  width: number;
  height: number;
}

export function resolveRows(assetCount: number, config: GridConfig): number {
  const maxRows = 10;
  if (config.rows > 0) {
    return Math.max(1, Math.min(maxRows, Math.round(config.rows)));
  }
  return Math.max(
    1,
    Math.ceil(assetCount / Math.max(1, Math.min(10, config.columns))),
  );
}

export function computeGridGeometry(
  assetCount: number,
  config: GridConfig,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: CellSize = { width: 1, height: 1 },
): GridGeometry {
  const columns = Math.max(1, Math.min(10, config.columns));
  const rows = resolveRows(assetCount, config);
  const usableWidth = canvasWidth - config.gap * (columns - 1);
  const usableHeight = canvasHeight - config.gap * (rows - 1);
  const cellW = Math.max(1, cellSize.width);
  const cellH = Math.max(1, cellSize.height);
  const fit = Math.min(
    usableWidth / (columns * cellW),
    usableHeight / (rows * cellH),
  );
  const scale = Math.max(0.01, Number.isFinite(fit) ? fit : 1);
  const cellWidth = Math.max(1, Math.floor(cellW * scale));
  const cellHeight = Math.max(1, Math.floor(cellH * scale));
  const gridWidth = columns * cellWidth + config.gap * (columns - 1);
  const gridHeight = rows * cellHeight + config.gap * (rows - 1);
  return {
    rows,
    columns,
    cellWidth,
    cellHeight,
    gridWidth,
    gridHeight,
    offsetX: Math.floor((canvasWidth - gridWidth) / 2),
    offsetY: Math.floor((canvasHeight - gridHeight) / 2),
  };
}

export interface OutputSize {
  width: number;
  height: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

export function computeOutputSize(
  assetCount: number,
  config: GridConfig,
  cellSize: CellSize = { width: 1, height: 1 },
): OutputSize {
  const columns = Math.max(1, Math.min(10, config.columns));
  const rows = resolveRows(assetCount, config);
  const cellW = Math.max(1, cellSize.width);
  const cellH = Math.max(1, cellSize.height);
  const baseWidth = columns * cellW + config.gap * (columns - 1);
  const baseHeight = rows * cellH + config.gap * (rows - 1);
  const scale = Math.max(0.01, config.scale);
  const width = Math.max(1, Math.round(baseWidth * scale));
  const height = Math.max(1, Math.round(baseHeight * scale));
  return { width, height, rows, cellWidth: cellW, cellHeight: cellH };
}

export function containRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || destWidth <= 0 || destHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(destWidth / sourceWidth, destHeight / sourceHeight);
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  return {
    x: Math.floor((destWidth - width) / 2),
    y: Math.floor((destHeight - height) / 2),
    width,
    height,
  };
}
