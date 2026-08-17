import { describe, expect, it } from "vitest";
import { buildExportFileName, buildExportFileNameWithTimestamp } from "./format";

describe("buildExportFileName", () => {
  it("appends a second-precision timestamp to the custom name", () => {
    expect(buildExportFileName(" 我的动画 ")).toMatch(
      /^我的动画-\d{8}-\d{6}\.gif$/,
    );
  });

  it("falls back to the default name with a timestamp", () => {
    expect(buildExportFileName("   ")).toMatch(/^GIF-\d{8}-\d{6}\.gif$/);
  });

  it("uses the latest custom name with a fixed export timestamp", () => {
    expect(
      buildExportFileNameWithTimestamp("新名称", "20260815-204000"),
    ).toBe("新名称-20260815-204000.gif");
  });
});
