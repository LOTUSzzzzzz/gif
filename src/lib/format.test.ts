import { describe, expect, it } from "vitest";
import { buildExportFileName } from "./format";

describe("buildExportFileName", () => {
  it("appends a second-precision timestamp to the custom name", () => {
    expect(buildExportFileName(" 我的动画 ")).toMatch(
      /^我的动画_\d{8}-\d{6}\.gif$/,
    );
  });

  it("falls back to the default name with a timestamp", () => {
    expect(buildExportFileName("   ")).toMatch(/^gif-grid_\d{8}-\d{6}\.gif$/);
  });
});
