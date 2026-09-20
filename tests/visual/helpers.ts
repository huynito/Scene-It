import type { Page } from "@playwright/test";

const THUMB_PLACEHOLDER = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#2a2a2a"/>
  <rect x="24" y="24" width="592" height="312" rx="18" fill="#3a3a3a" stroke="#5a5a5a" stroke-width="4"/>
  <circle cx="200" cy="162" r="52" fill="#8a8a8a"/>
  <rect x="280" y="118" width="176" height="24" rx="12" fill="#8a8a8a"/>
  <rect x="280" y="164" width="120" height="18" rx="9" fill="#6f6f6f"/>
</svg>
`.trim();

export async function stubSceneThumbs(page: Page) {
  await page.route(/\/scenes\/[^/]+\/thumb\.(jpg|png)$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: THUMB_PLACEHOLDER,
    });
  });
}

/**
 * Build a minimal valid PLY buffer (header + 1 vertex) that passes the app's
 * PLY parser without needing a real 180 MB scene file.
 */
function buildStubPly(): Buffer {
  const header = [
    "ply",
    "format binary_little_endian 1.0",
    "element vertex 1",
    "property float x",
    "property float y",
    "property float z",
    "end_header",
    "",
  ].join("\n");
  const headerBuf = Buffer.from(header, "ascii");
  const vertexBuf = Buffer.alloc(12); // 3 floats = 12 bytes, zeros
  return Buffer.concat([headerBuf, vertexBuf]);
}

export async function stubSceneAssets(page: Page) {
  await stubSceneThumbs(page);

  const plyBody = buildStubPly();
  await page.route(/\/scenes\/[^/]+\/scene\.ply/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: plyBody,
    });
  });

  await page.route(/\/scenes\/[^/]+\/depth\.glb$/, async (route) => {
    await route.fulfill({ status: 404 });
  });
}

export async function gotoWithTheme(page: Page, themeId: string) {
  await page.addInitScript((id) => {
    window.localStorage.setItem("gsv-ui-theme", id);
  }, themeId);
  await page.goto("/");
}
