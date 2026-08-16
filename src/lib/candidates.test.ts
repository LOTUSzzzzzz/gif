import { describe, expect, it } from "vitest";
import type { CandidateResult } from "../types";
import { CANDIDATES, selectBestCandidate } from "./candidates";

function result(
  lossy: number,
  colors: number,
  sizeBytes: number,
  ssimValue: number,
): CandidateResult {
  return {
    spec: { lossy, colors },
    sizeBytes,
    ssim: ssimValue,
    accepted: true,
  };
}

describe("candidate selection", () => {
  it("picks the smallest accepted candidate", () => {
    const results = [
      result(0, 256, 1000, 0.99),
      result(60, 256, 700, 0.96),
      result(150, 64, 400, 0.93),
    ];
    const chosen = selectBestCandidate(results, 0.95);
    expect(chosen).toEqual({ lossy: 60, colors: 256 });
  });

  it("falls back to the smallest candidate when none pass", () => {
    const results = [
      result(0, 256, 1000, 0.94),
      result(200, 64, 350, 0.9),
    ];
    const chosen = selectBestCandidate(results, 0.95);
    expect(chosen).toEqual({ lossy: 200, colors: 64 });
  });

  it("returns the baseline spec for empty results", () => {
    expect(selectBestCandidate([], 0.95)).toEqual({ lossy: 0, colors: 256 });
  });

  it("has ten fixed candidates", () => {
    expect(CANDIDATES).toHaveLength(10);
    expect(CANDIDATES[0]).toEqual({ lossy: 0, colors: 256 });
    expect(CANDIDATES[CANDIDATES.length - 1]).toEqual({
      lossy: 200,
      colors: 16,
    });
  });
});
