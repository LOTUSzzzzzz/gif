import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { makeFixtureGif } from "../helpers/fixtures";

function parseBytes(text: string): number {
  const match = text.match(/([\d.]+)\s*(B|KB|MB)/);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "KB") return value * 1024;
  if (unit === "MB") return value * 1024 * 1024;
  return value;
}

test("uploads GIFs, previews the grid, and exports a compressed GIF", async ({
  page,
}) => {
  await page.goto("/");

  const fixtures = [0, 1, 2, 3].map((seed) => ({
    name: `grid-${seed}.gif`,
    mimeType: "image/gif",
    buffer: Buffer.from(
      makeFixtureGif({
        width: 32,
        height: 32,
        frameCount: 3,
        delayMs: 100,
        seed,
      }),
    ),
  }));

  await page.setInputFiles('input[type="file"]', fixtures);
  await expect(page.locator(".asset-card")).toHaveCount(4);
  await expect(page.locator(".asset-card .asset-meta").first()).toContainText(
    "帧",
  );

  await expect
    .poll(
      () =>
        page.locator("canvas").evaluate((canvas) => {
          const element = canvas as HTMLCanvasElement;
          const ctx = element.getContext("2d");
          if (!ctx) return 0;
          const data = ctx.getImageData(0, 0, element.width, element.height).data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
              return 1;
            }
          }
          return 0;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "开始智能导出" }).click();
  const downloadLink = page.locator(".export-head a");
  await expect(downloadLink).toBeVisible({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const bytes = readFileSync(filePath!);
  expect(bytes.subarray(0, 6).toString("ascii")).toMatch(/^GIF8/);
  expect(bytes.length).toBeGreaterThan(0);

  const panelText = await page.locator(".export-panel").innerText();
  const beforeMatch = panelText.match(/压缩前\n([\d.]+ (?:B|KB|MB))/);
  const afterMatch = panelText.match(/压缩后\n([\d.]+ (?:B|KB|MB))/);
  expect(beforeMatch).toBeTruthy();
  expect(afterMatch).toBeTruthy();
  expect(parseBytes(afterMatch![1])).toBeLessThanOrEqual(
    parseBytes(beforeMatch![1]),
  );
});
