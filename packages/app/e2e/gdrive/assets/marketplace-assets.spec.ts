import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, test } from '@playwright/test';

import { PACKAGE_ROOT } from '../../support/gdrive/server';

type Asset = {
  file: string;
  kind: 'icon' | 'banner';
  /** The PNG's size in pixels, which google-workspace:check holds it to. */
  width: number;
  height: number;
  /** The device scale factor it is drawn at, 1 when absent. */
  scale?: number;
};

const ASSET_DIR = join(PACKAGE_ROOT, 'google-workspace');
/** The list google-workspace:check holds the files to. */
const ASSETS: Asset[] = JSON.parse(
  readFileSync(join(ASSET_DIR, 'assets.json'), 'utf8')
);
const ICON_URL = `data:image/svg+xml;base64,${readFileSync(
  join(PACKAGE_ROOT, 'public', 'erd-editor_icon.svg')
).toString('base64')}`;

function scaleOf(asset: Asset) {
  return asset.scale ?? 1;
}

function markupOf(asset: Asset) {
  if (asset.kind === 'icon') {
    return `<img src="${ICON_URL}" alt="" style="display:block;width:100%;height:100%;object-fit:contain">`;
  }
  return `<div style="display:flex;align-items:center;justify-content:center;gap:14px;height:100%;background:#fcfcfd;border:1px solid #d9d9e0;box-sizing:border-box">
    <img src="${ICON_URL}" alt="" style="height:76px">
    <span style="font:600 26px/1 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2024;letter-spacing:-0.3px">ERD Editor</span>
  </div>`;
}

/**
 * Paints the asset in a box of its size over its scale, on a page at that
 * scale, and saves just that box, so a 2x file is the SVG drawn at twice the
 * pixels rather than an enlarged 1x one.
 */
async function render(page: Page, asset: Asset) {
  const scale = scaleOf(asset);
  // At the page's origin, as the files uploaded to Google were drawn: a margin
  // moves the edges' anti-aliasing by a few values.
  await page.setContent(
    `<style>html,body{margin:0}</style><div id="asset" style="width:${asset.width / scale}px;height:${asset.height / scale}px">${markupOf(asset)}</div>`
  );
  await page.evaluate(() =>
    Promise.all(Array.from(document.images, image => image.decode()))
  );
  await page.locator('#asset').screenshot({
    path: join(ASSET_DIR, asset.file),
    omitBackground: true,
  });
}

test.describe('the Google Workspace Marketplace assets', () => {
  for (const scale of new Set(ASSETS.map(scaleOf))) {
    test.describe(`at ${scale}x`, () => {
      test.use({ deviceScaleFactor: scale });

      for (const asset of ASSETS.filter(each => scaleOf(each) === scale)) {
        test(`${asset.file}, the ${asset.kind}`, async ({ page }) => {
          await render(page, asset);
        });
      }
    });
  }
});
