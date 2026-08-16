import { expect, test } from "@playwright/test";
import { makeTransparentFixtureGif } from "../helpers/fixtures";

test("cancel stops a large-grid export immediately", async ({ page }) => {
  await page.goto("/");

  const fixtures = [0, 1, 2, 3].map((seed) => ({
    name: `cancel-${seed}.gif`,
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
  await page.fill("#columns", "50");
  await page.fill("#rows", "50");

  await page.locator(".export-btn").click();
  const cancel = page.locator(".export-panel .ghost-btn");
  await expect(cancel).toBeVisible({ timeout: 30_000 });
  await cancel.click();

  await expect(cancel).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".export-idle")).toBeVisible({ timeout: 30_000 });
});
