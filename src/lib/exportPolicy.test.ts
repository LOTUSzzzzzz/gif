import { describe, expect, it } from "vitest";
import {
  effectiveSampleIntervalMs,
  effectiveSsimThreshold,
  gridCellCount,
  MAX_EXPORT_SIDE,
} from "./exportPolicy";

describe("export policy", () => {
  it("resolves grid cell count with auto rows", () => {
    expect(gridCellCount(4, 2, 0)).toBe(4);
    expect(gridCellCount(10, 10, 10)).toBe(100);
    expect(gridCellCount(10, 50, 50)).toBe(100);
  });

  it("exposes the 1024 cap", () => {
    expect(MAX_EXPORT_SIDE).toBe(1024);
  });

  it("raises the sample interval for large grids", () => {
    expect(effectiveSampleIntervalMs(50, 4)).toBe(50);
    expect(effectiveSampleIntervalMs(20, 100)).toBe(100);
    expect(effectiveSampleIntervalMs(100, 100)).toBe(100);
  });

  it("lowers the ssim cap for large grids", () => {
    expect(effectiveSsimThreshold(0.95, 4)).toBe(0.95);
    expect(effectiveSsimThreshold(1, 100)).toBe(0.9);
  });
});
