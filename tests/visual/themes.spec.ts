import { test, expect } from "@playwright/test";
import { gotoWithTheme, stubSceneThumbs } from "./helpers";

const THEMES = [
  { id: "default", label: "default" },
  { id: "sc3ne_it", label: "cyberpunk" },
  { id: "winamp", label: "winamp" },
  { id: "win95", label: "win95" },
  { id: "xX_sCeNeIt_Xx", label: "aim" },
  { id: "sciin_it", label: "sciin_it" },
  { id: "scenit", label: "scenit" },
] as const;

test.describe("theme snapshots", () => {
  for (const theme of THEMES) {
    test(`matches ${theme.label} landing view`, async ({ page }) => {
      await stubSceneThumbs(page);
      await gotoWithTheme(page, theme.id);

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme.id);
      await expect(page.getByRole("heading", { name: "Scene It" })).toBeVisible();

      await expect(page.locator("body")).toHaveScreenshot(`theme-${theme.label}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }

  test("persists the selected theme across reload", async ({ page }) => {
    await stubSceneThumbs(page);
    await gotoWithTheme(page, "win95");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "win95");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "win95");

    await gotoWithTheme(page, "xX_sCeNeIt_Xx");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "xX_sCeNeIt_Xx");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "xX_sCeNeIt_Xx");
  });
});
