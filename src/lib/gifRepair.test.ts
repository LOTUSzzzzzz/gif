import { describe, expect, it } from "vitest";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { parseGIF } from "gifuct-js";
import type { Frame } from "gifuct-js";
import { repairTransparentGif } from "./gifRepair";

function makeTransparentGif(): Uint8Array {
  const encoder = GIFEncoder();
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 8 * 8; i++) {
    rgba[i * 4 + 3] = 0;
  }
  const palette = quantize(rgba, 256, {
    format: "rgba4444",
    oneBitAlpha: true,
  });
  const index = applyPalette(rgba, palette, "rgba4444");
  const transparentIndex = palette.findIndex((c) => (c[3] ?? 255) < 128);
  encoder.writeFrame(index, 8, 8, {
    palette,
    delay: 50,
    transparent: transparentIndex >= 0,
    transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
  });
  encoder.finish();
  return encoder.bytes();
}

describe("repairTransparentGif", () => {
  it("sets the background index to the transparent index", () => {
    const gif = makeTransparentGif();
    const corrupted = gif.slice();
    corrupted[11] = 200;
    const repaired = repairTransparentGif(corrupted);
    const buffer = repaired.buffer.slice(
      repaired.byteOffset,
      repaired.byteOffset + repaired.byteLength,
    ) as ArrayBuffer;
    const parsed = parseGIF(buffer);
    const firstFrame = parsed.frames.find(
      (f): f is Frame => Boolean((f as Frame).image),
    );
    expect(firstFrame).toBeTruthy();
    expect(parsed.lsd.backgroundColorIndex).toBe(
      firstFrame!.gce.transparentColorIndex,
    );
    expect(parsed.lsd.backgroundColorIndex).not.toBe(200);
    expect(repaired.length).toBe(gif.length);
  });

  it("leaves non-transparent GIFs unchanged", () => {
    const encoder = GIFEncoder();
    const rgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 4 * 4; i++) {
      rgba[i * 4] = 200;
      rgba[i * 4 + 1] = 100;
      rgba[i * 4 + 2] = 50;
      rgba[i * 4 + 3] = 255;
    }
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    encoder.writeFrame(index, 4, 4, { palette, delay: 50 });
    encoder.finish();
    const gif = encoder.bytes();
    const repaired = repairTransparentGif(gif);
    expect(repaired).toEqual(gif);
  });
});
