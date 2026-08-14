import { describe, expect, it } from "vitest";
import { averageSsim, ssim, toLuma } from "./ssim";

describe("ssim", () => {
  it("returns 1 for identical images", () => {
    const a = new Uint8Array([10, 20, 30, 40]);
    expect(ssim(a, a)).toBe(1);
  });

  it("returns a value below 1 for different images", () => {
    const a = new Uint8Array(64).fill(50);
    const b = new Uint8Array(64).fill(200);
    const score = ssim(a, b);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0);
  });

  it("averages multiple frame comparisons", () => {
    const a = [new Uint8Array([5, 5, 5, 5]), new Uint8Array([1, 2, 3, 4])];
    expect(averageSsim(a, a)).toBe(1);
    const b = [new Uint8Array([5, 5, 5, 5]), new Uint8Array([250, 250, 250, 250])];
    expect(averageSsim(a, b)).toBeLessThan(1);
  });

  it("converts RGBA to grayscale", () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const luma = toLuma(rgba);
    expect(luma).toHaveLength(2);
    expect(luma[1]).toBeGreaterThan(luma[0]);
  });
});
