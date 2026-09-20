import { test, expect } from "@playwright/test";
import { gotoWithTheme, stubSceneThumbs } from "./helpers";

test.describe("landing screen", () => {
  test("matches the default landing view", async ({ page }) => {
    await stubSceneThumbs(page);
    await gotoWithTheme(page, "default");

    await expect(page.getByRole("heading", { name: "Scene It" })).toBeVisible();
    await expect(page.getByText("Choose a scene to explore")).toBeVisible();
    await expect(page.getByText("or load your own")).toBeVisible();

    await expect(page.locator("body")).toHaveScreenshot("landing-default.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("keeps the upload area and scene cards stable", async ({ page }) => {
    await stubSceneThumbs(page);
    await gotoWithTheme(page, "default");

    await expect(page.getByText("Scene A")).toBeVisible();
    await expect(page.getByText("Scene B")).toBeVisible();
    await expect(page.getByText("point_cloud.ply from training output")).toBeVisible();

    await expect(page.locator("body")).toHaveScreenshot("landing-structure.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
