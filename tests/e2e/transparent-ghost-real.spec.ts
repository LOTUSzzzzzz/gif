import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { decompressFrames, parseGIF } from "gifuct-js";
import type { ParsedFrame, ParsedGif } from "gifuct-js";

const dir = process.env.GIF_REAL_DIR ?? "";

function composeFrames(
  gif: ParsedGif,
  frames: ParsedFrame[],
): Uint8Array[] {
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  const composed: Uint8Array[] = [];
  let mask = new Uint8Array(width * height);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (i > 0 && frames[i - 1].disposalType === 2) {
      const prev = frames[i - 1];
      const cleared = mask.slice();
      for (let y = prev.dims.top; y < prev.dims.top + prev.dims.height; y++) {
        for (
          let x = prev.dims.left;
          x < prev.dims.left + prev.dims.width;
          x++
        ) {
          cleared[y * width + x] = 0;
        }
      }
      mask = cleared;
    }
    const current = mask.slice();
    const transparentIndex = frame.transparentIndex;
    for (let y = 0; y < frame.dims.height; y++) {
      for (let x = 0; x < frame.dims.width; x++) {
        if (frame.pixels[y * frame.dims.width + x] !== transparentIndex) {
          current[(frame.dims.top + y) * width + (frame.dims.left + x)] = 1;
        }
      }
    }
    composed.push(current);
    mask = current;
  }
  return composed;
}

test("real zip transparent 2x2 export has no ghost accumulation", async ({
  page,
}) => {
  test.skip(!dir, "GIF_REAL_DIR is not set");

  const files = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".gif"))
    .map((name) => ({
      name,
      mimeType: "image/gif",
      buffer: readFileSync(path.join(dir, name)),
    }));
  expect(files.length).toBeGreaterThan(0);

  await page.goto("/");
  await page.setInputFiles('input[type="file"]', files);
  await expect(page.locator(".asset-card")).toHaveCount(files.length);
  await page.fill("#columns", "2");
  await page.fill("#rows", "2");
  await expect(page.locator("#transparentBg")).toBeChecked();

  await page.locator(".export-btn").click();
  const downloadLink = page.locator(".export-head a");
  await expect(downloadLink).toBeVisible({ timeout: 180_000 });

  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const bytes = readFileSync(filePath!);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  expect(frames.length).toBeGreaterThan(1);
  expect(gif.lsd.backgroundColorIndex).toBe(frames[0].transparentIndex);

  const counts = composeFrames(gif, frames).map((mask) => {
    let opaque = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) opaque++;
    }
    return opaque;
  });
  const decreases = counts.filter(
    (count, i) => i > 0 && count < counts[i - 1],
  );
  expect(decreases.length).toBeGreaterThan(0);
});
