import { describe, expect, it } from "vitest";
import {
  buildCumulative,
  computeExportTimeline,
  frameIndexAt,
  gcd,
  lcm,
  sampleIndexes,
} from "./timeline";

describe("timeline helpers", () => {
  it("computes gcd and lcm", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(1, 2500)).toBe(2500);
    expect(lcm(0, 800)).toBe(800);
  });

  it("caps the combined duration and derives frame count", () => {
    const timeline = computeExportTimeline([1000, 2000], 20000, 50);
    expect(timeline.durationMs).toBe(2000);
    expect(timeline.frameCount).toBe(40);

    const capped = computeExportTimeline([7000, 11000], 20000, 50);
    expect(capped.durationMs).toBe(20000);
    expect(capped.frameCount).toBe(400);
  });

  it("handles static inputs as a single frame", () => {
    const timeline = computeExportTimeline([0, 0], 20000, 50);
    expect(timeline.frameCount).toBe(1);
    expect(timeline.durationMs).toBe(50);
  });

  it("maps a timestamp to the correct frame with wrapping", () => {
    const cumulative = buildCumulative([100, 150, 150]);
    expect(cumulative).toEqual([100, 250, 400]);
    expect(frameIndexAt(cumulative, 400, 0)).toBe(0);
    expect(frameIndexAt(cumulative, 400, 99)).toBe(0);
    expect(frameIndexAt(cumulative, 400, 100)).toBe(1);
    expect(frameIndexAt(cumulative, 400, 399)).toBe(2);
    expect(frameIndexAt(cumulative, 400, 401)).toBe(0);
  });

  it("samples evenly across the timeline", () => {
    expect(sampleIndexes(4, 10)).toEqual([0, 1, 2, 3]);
    expect(sampleIndexes(40, 10)).toHaveLength(10);
    expect(sampleIndexes(40, 10)[0]).toBe(0);
    expect(sampleIndexes(40, 10)[9]).toBe(39);
  });
});
