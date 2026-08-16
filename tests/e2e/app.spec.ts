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
  await expect(page.locator("#ssimThreshold")).toHaveValue("0.95");
  await expect(page.getByText("数值越大精度越高")).toBeVisible();
  await expect(
    page.locator(".topbar .topbar-note").last(),
  ).toHaveText("网站禁止商用，由蓝莲花制作");
  const bodyBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundImage,
  );
  expect(bodyBackground).toContain("website-bg");
  const stageBackground = await page.evaluate(() => {
    const stage = document.querySelector(".stage");
    return stage ? getComputedStyle(stage).backgroundColor : "";
  });
  expect(stageBackground).toBe("rgba(0, 0, 0, 0)");

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
  const speedInput = page.locator("#speed");
  await expect(speedInput).toHaveValue("1");
  await speedInput.fill("2");
  await speedInput.blur();
  await expect(
    page.locator(".asset-card .asset-rotation").first(),
  ).toContainText("2倍");
  await page.getByRole("button", { name: "作用所有GIF" }).click();
  await expect(
    page.locator(".asset-card .asset-rotation").nth(1),
  ).toContainText("2倍");
  await speedInput.fill("3");
  await speedInput.blur();
  await expect(
    page.locator(".asset-card .asset-rotation").nth(1),
  ).toContainText("3倍");
  const selectedBackground = await page.evaluate(() => {
    const card = document.querySelector(".asset-card.selected");
    return card ? getComputedStyle(card).backgroundColor : "";
  });
  expect(selectedBackground).toBe("rgb(219, 234, 254)");
  const sidebar = page.locator(".sidebar-scroll");
  const exportBefore = await page.locator(".export-btn").boundingBox();
  await sidebar.evaluate((el) => {
    el.scrollTop = 500;
  });
  const exportAfter = await page.locator(".export-btn").boundingBox();
  expect(Math.abs(exportAfter!.y - exportBefore!.y)).toBeLessThan(2);
  await sidebar.evaluate((el) => {
    el.scrollTop = 0;
  });
  const exportButtonBox = await page.locator(".export-btn").boundingBox();
  const exportHintBox = await page.locator(".export-hint").boundingBox();
  expect(exportHintBox!.y).toBeGreaterThanOrEqual(
    exportButtonBox!.y + exportButtonBox!.height - 1,
  );
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
