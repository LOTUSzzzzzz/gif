import * as gifencNamespace from "gifenc";

const gifenc = (
  (gifencNamespace as unknown as { default?: typeof gifencNamespace }).default ??
  gifencNamespace
) as unknown as typeof gifencNamespace;

const { GIFEncoder, quantize, applyPalette } = gifenc;

export interface FixtureGifOptions {
  width: number;
  height: number;
  frameCount: number;
  delayMs: number;
  seed: number;
}

export function makeFixtureGif(options: FixtureGifOptions): Uint8Array {
  const { width, height, frameCount, delayMs, seed } = options;
  const encoder = GIFEncoder();
  for (let frame = 0; frame < frameCount; frame++) {
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const phase = (x + y + frame * 9) % 256;
        rgba[i] = (phase * 3 + seed * 13) % 256;
        rgba[i + 1] = (x * 7 + seed * 5) % 256;
        rgba[i + 2] = (y * 11 + seed * 3) % 256;
        rgba[i + 3] = 255;
      }
    }
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    encoder.writeFrame(index, width, height, { palette, delay: delayMs });
  }
  encoder.finish();
  return encoder.bytes();
}
