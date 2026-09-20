import { test, expect } from "@playwright/test";
import { gotoWithTheme, stubSceneAssets } from "./helpers";

const THEMES = [
  { id: "default", label: "default" },
  { id: "winamp", label: "winamp" },
  { id: "win95", label: "win95" },
  { id: "xX_sCeNeIt_Xx", label: "aim" },
  { id: "sciin_it", label: "sciin_it" },
  { id: "scenit", label: "scenit" },
] as const;

test.describe("editor chrome snapshots", () => {
  for (const theme of THEMES) {
    test(`matches ${theme.label} editor chrome`, async ({ page }) => {
      await stubSceneAssets(page);
      await gotoWithTheme(page, theme.id);

      await page.getByText("Living Room").click();

      await expect(
        page.getByText("Anchors").first(),
      ).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(1000);

      await expect(page.locator("body")).toHaveScreenshot(
        `editor-${theme.label}.png`,
        { fullPage: true, animations: "disabled" },
      );
    });
  }
});
