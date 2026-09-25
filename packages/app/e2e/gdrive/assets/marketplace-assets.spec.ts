import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { daysAgo } from '../../support/backup';
import {
  installFakeGoogle,
  resetOAuthServer,
} from '../../support/gdrive/fakeGoogle';
import { GdrivePage } from '../../support/gdrive/GdrivePage';
import { PACKAGE_ROOT } from '../../support/gdrive/server';

type Asset = {
  file: string;
  kind: 'icon' | 'banner' | 'screenshot';
  width: number;
  height: number;
};

const ASSET_DIR = join(PACKAGE_ROOT, 'google-workspace');
/** The list google-workspace:check holds the files to. */
const ASSETS: Asset[] = JSON.parse(
  readFileSync(join(ASSET_DIR, 'assets.json'), 'utf8')
);
const ICON_URL = `data:image/svg+xml;base64,${readFileSync(
  join(PACKAGE_ROOT, 'public', 'erd-editor_icon.svg')
).toString('base64')}`;
/** Noon on one day in the renderer's own zone, so the date groups read alike on every render. */
const RENDERED_AT = new Date(2026, 8, 25, 12);

function assetsOf(kind: Asset['kind']) {
  return ASSETS.filter(asset => asset.kind === kind);
}

/** Paints markup in a box of the asset's size and saves just that box. */
async function render(page: Page, asset: Asset, markup: string) {
  await page.setContent(
    `<div id="asset" style="width:${asset.width}px;height:${asset.height}px">${markup}</div>`
  );
  await page.evaluate(() =>
    Promise.all(Array.from(document.images, image => image.decode()))
  );
  await page.locator('#asset').screenshot({
    path: join(ASSET_DIR, asset.file),
    omitBackground: true,
  });
}

/** Screenshots the page until two shots in a row match, and returns the last. */
async function stillScreenshot(page: Page): Promise<Buffer> {
  const shots: Buffer[] = [];
  await expect
    .poll(
      async () => {
        shots.unshift(await page.screenshot());
        shots.length = Math.min(shots.length, 2);
        return shots.length === 2 && shots[0].equals(shots[1]);
      },
      { intervals: [250] }
    )
    .toBe(true);
  return shots[0];
}

test.describe('the Google Workspace Marketplace assets', () => {
  for (const asset of assetsOf('icon')) {
    test(`${asset.file}, the icon on a transparent square`, async ({
      page,
    }) => {
      await render(
        page,
        asset,
        `<img src="${ICON_URL}" alt="" style="display:block;width:100%;height:100%;object-fit:contain">`
      );
    });
  }

  for (const asset of assetsOf('banner')) {
    test(`${asset.file}, the card banner`, async ({ page }) => {
      await render(
        page,
        asset,
        `<div style="display:flex;align-items:center;justify-content:center;gap:14px;height:100%;background:#fcfcfd;border:1px solid #d9d9e0;box-sizing:border-box">
          <img src="${ICON_URL}" alt="" style="height:76px">
          <span style="font:600 26px/1 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2024;letter-spacing:-0.3px">erd-editor</span>
        </div>`
      );
    });
  }

  for (const asset of assetsOf('screenshot')) {
    test(`${asset.file}, a Drive file open in /gdrive`, async ({ context }) => {
      await resetOAuthServer();
      // Time runs from there, so timers fire; the file the import creates takes
      // the real time, which reads as Today however far ahead it is.
      await context.clock.install({ time: RENDERED_AT });
      const google = await installFakeGoogle(context);
      const others = [
        { name: 'orders.erd', days: 1 },
        { name: 'blog.vuerd', days: 2 },
        { name: 'inventory.erd.json', days: 5 },
        { name: 'analytics.erd', days: 18 },
        { name: 'payments.vuerd.json', days: 40 },
      ];
      others.forEach(({ name, days }, index) =>
        google.add({
          id: `file-${index}`,
          name,
          modifiedTime: daysAgo(days, RENDERED_AT),
        })
      );

      const app = await GdrivePage.open(context);
      await app.page.setViewportSize({
        width: asset.width,
        height: asset.height,
      });
      await app.signIn();

      // Imported the way a person would bring a schema over, laid out by the
      // editor's own import.
      await app.sidebar().getByRole('button', { name: 'Import' }).click();
      const chooser = app.page.waitForEvent('filechooser');
      await app.page.getByRole('menuitem', { name: 'Import files' }).click();
      await (
        await chooser
      ).setFiles(join(PACKAGE_ROOT, 'src', 'assets', 'bookstore.dbml'));
      await app.waitForEditor();
      await expect.poll(async () => (await app.tableIds()).length).toBe(9);
      await app.expectSaveState('saved');

      const notice = app.page
        .getByRole('status')
        .filter({ hasText: 'Imported 1 file to Google Drive' });
      await notice.getByRole('button', { name: 'Dismiss' }).click();
      await expect(notice).toHaveCount(0);
      // Out to most of the schema while the columns still show (a smaller zoom
      // draws table names alone); a zoom is view state, never saved.
      const zoomOut = app.page.locator(
        'erd-editor .floating-toolbar [title^="Zoom out"]'
      );
      const zoomLevel = app.page.locator('erd-editor .zoom-level');
      while (Number.parseInt(await zoomLevel.innerText(), 10) > 72) {
        const before = await zoomLevel.innerText();
        await zoomOut.click();
        await expect(zoomLevel).not.toHaveText(before);
      }
      // A zoom keeps the middle still, so the schema is panned back into view,
      // clear of the minimap.
      await app.page.mouse.move(asset.width / 2, asset.height / 2);
      await app.page.mouse.wheel(156, -36);
      await app.page.mouse.move(asset.width - 1, asset.height - 1);

      // The editor settles its connectors a frame or two after the load.
      writeFileSync(
        join(ASSET_DIR, asset.file),
        await stillScreenshot(app.page)
      );
    });
  }
});
