import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { decompressFrames, parseGIF } from "gifuct-js";
import type { ParsedFrame, ParsedGif } from "gifuct-js";
import { makeTransparentFixtureGif } from "../helpers/fixtures";

function decode(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  return { gif, frames };
}

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

test("transparent 2x2 export has no baked-in ghost frames", async ({
  page,
}) => {
  await page.goto("/");

  const fixtures = [0, 1, 2, 3].map((seed) => ({
    name: `transparent-${seed}.gif`,
    mimeType: "image/gif",
    buffer: Buffer.from(
      makeTransparentFixtureGif({
        width: 40,
        height: 40,
        frameCount: 8,
        delayMs: 100,
        seed,
      }),
    ),
  }));

  await page.setInputFiles('input[type="file"]', fixtures);
  await expect(page.locator(".asset-card")).toHaveCount(4);
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
  const bytes = readFileSync(filePath!);
  expect(bytes.subarray(0, 6).toString("ascii")).toMatch(/^GIF8/);

  const { gif, frames } = decode(bytes);
  expect(frames.length).toBeGreaterThan(1);
  for (const frame of frames) {
    expect([1, 2]).toContain(frame.disposalType);
  }

  const first = frames[0];
  expect(first.transparentIndex).toBe(gif.lsd.backgroundColorIndex);
  const hasPartialFrame = frames.some(
    (frame) =>
      frame.dims.width < gif.lsd.width || frame.dims.height < gif.lsd.height,
  );
  expect(hasPartialFrame).toBe(true);

  const composed = composeFrames(gif, frames);
  const opaquePositions = (mask: Uint8Array): Set<number> => {
    const positions = new Set<number>();
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) positions.add(i);
    }
    return positions;
  };
  const firstPositions = opaquePositions(composed[0]);
  const lastPositions = opaquePositions(composed[composed.length - 1]);
  let retained = 0;
  for (const position of firstPositions) {
    if (lastPositions.has(position)) retained++;
  }
  expect(retained / firstPositions.size).toBeLessThan(0.5);

  const panelText = await page.locator(".export-panel").innerText();
  expect(panelText).toContain("下载 GIF");
});
