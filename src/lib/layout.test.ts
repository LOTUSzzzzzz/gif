import { describe, expect, it } from "vitest";
import type { GridConfig } from "../types";
import { computeGridGeometry, computeOutputSize, containRect } from "./layout";

const baseConfig: GridConfig = {
  columns: 2,
  rows: 0,
  gap: 10,
  backgroundColor: "#ffffff",
  scale: 1,
  sampleIntervalMs: 50,
  ssimThreshold: 0.95,
};

describe("grid layout", () => {
  it("fits a 2x2 grid into the canvas", () => {
    const geometry = computeGridGeometry(4, baseConfig, 210, 210, {
      width: 100,
      height: 100,
    });
    expect(geometry.rows).toBe(2);
    expect(geometry.columns).toBe(2);
    expect(geometry.cellWidth).toBe(100);
    expect(geometry.cellHeight).toBe(100);
    expect(geometry.gridWidth).toBe(210);
    expect(geometry.gridHeight).toBe(210);
    expect(geometry.offsetX).toBe(0);
    expect(geometry.offsetY).toBe(0);
  });

  it("centers a grid smaller than the canvas", () => {
    const geometry = computeGridGeometry(2, baseConfig, 300, 300, {
      width: 100,
      height: 100,
    });
    expect(geometry.rows).toBe(1);
    expect(geometry.gridWidth).toBe(300);
    expect(geometry.offsetY).toBe(77);
  });

  it("derives output size from scale and columns", () => {
    const size = computeOutputSize(6, baseConfig, {
      width: 100,
      height: 100,
    });
    expect(size.rows).toBe(3);
    expect(size.width).toBe(210);
    expect(size.height).toBe(320);
  });

  it("arrays one gif into 2x2 and scales from the arrayed size", () => {
    const twoByTwo = {
      ...baseConfig,
      columns: 2,
      rows: 2,
      gap: 0,
      scale: 1,
    };
    const full = computeOutputSize(1, twoByTwo, {
      width: 120,
      height: 120,
    });
    expect(full.width).toBe(240);
    expect(full.height).toBe(240);

    const half = computeOutputSize(1, { ...twoByTwo, scale: 0.5 }, {
      width: 120,
      height: 120,
    });
    expect(half.width).toBe(120);
    expect(half.height).toBe(120);
  });

  it("adapts output and preview to imported gif size", () => {
    const single = {
      ...baseConfig,
      columns: 1,
      rows: 1,
      gap: 0,
      scale: 0.5,
    };
    const size = computeOutputSize(1, single, {
      width: 500,
      height: 250,
    });
    expect(size.width).toBe(250);
    expect(size.height).toBe(125);

    const geometry = computeGridGeometry(1, single, 800, 400, {
      width: 500,
      height: 250,
    });
    expect(geometry.cellWidth).toBe(800);
    expect(geometry.cellHeight).toBe(400);
  });

  it("honors a fixed row count with empty cells", () => {
    const fixed = { ...baseConfig, rows: 4 };
    const size = computeOutputSize(6, fixed);
    expect(size.rows).toBe(4);
    const geometry = computeGridGeometry(6, fixed, 1000, 1000);
    expect(geometry.rows).toBe(4);
  });

  it("computes contain rectangles without cropping", () => {
    const rect = containRect(400, 200, 100, 100);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(25);
  });
});
