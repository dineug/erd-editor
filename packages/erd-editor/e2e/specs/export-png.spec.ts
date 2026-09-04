import { readFileSync } from 'node:fs';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';

// Nothing in this suite had ever driven an export. What it holds down is the
// file the browser really receives, and the order of the messages around it:
// the editor says it is drawing, then takes that away before saying what it cost.

/**
 * Past what a browser canvas holds, so the export has to scale the image down
 * and say so. 16384 is the ceiling every current engine stops at.
 */
const OVER_LIMIT = 20_000;

const CLAMPED = 16_384;

/**
 * Long enough for one export on the dev server. The shared worker never starts
 * there, so every export spends the ten second handshake before the main
 * thread draws the image itself.
 */
const EXPORT_TIMEOUT = 45_000;

/** Bare canvas below both seeded tables, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 300, y: 400 };

function document(size: number): ErdDocument {
  return createSchema({
    databaseName: 'shop',
    width: size,
    height: size,
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 120,
        y: 120,
        columns: [
          { id: 'users_id', name: 'id', dataType: 'int', keys: 1 },
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 700,
        y: 120,
        columns: [{ id: 'posts_id', name: 'id', dataType: 'int', keys: 1 }],
      },
    ],
  });
}

/** The size a png declares in its header, which is the image the file holds. */
function pngSize(path: string) {
  const header = readFileSync(path).subarray(0, 24);
  expect(header.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

async function exportPng(erd: ErdEditorPage) {
  // Named rather than swept for: the menu opens downward from the click, and
  // an empty point low on a tall canvas puts Export below the viewport.
  await erd.openContextMenuAt(MENU_ORIGIN.x, MENU_ORIGIN.y);

  await erd.contextMenu.getByText('Export', { exact: true }).hover();
  const png = erd.contextMenu.getByText('png', { exact: true });
  await expect(png).toBeVisible();
  await png.click();
}

/**
 * Every distinct set of toasts the shadow root held, in order. Two messages
 * that replace one another and two that pile up end in the same place, so the
 * sequence has to be recorded while it happens rather than read off the end.
 */
async function recordToasts(erd: ErdEditorPage) {
  await erd.page.evaluate(() => {
    const root = window.document.querySelector('erd-editor')!.shadowRoot!;
    const seen: string[][] = [];
    Reflect.set(window, '__toastTimeline', seen);

    new MutationObserver(() => {
      const texts = [...root.querySelectorAll('.toast-container')].map(node =>
        (node.textContent ?? '').trim()
      );
      const last = seen.at(-1);
      if (JSON.stringify(last) !== JSON.stringify(texts)) seen.push(texts);
    }).observe(root, { childList: true, subtree: true, characterData: true });
  });
}

const toastTimeline = (erd: ErdEditorPage) =>
  erd.page.evaluate(() => Reflect.get(window, '__toastTimeline') as string[][]);

const generating = (erd: ErdEditorPage) =>
  erd.host.locator('.toast-container', { hasText: 'Exporting PNG…' });

const reduced = (erd: ErdEditorPage) =>
  erd.host.locator('.toast-container', {
    hasText: 'Exported at a reduced resolution',
  });

test.describe('exporting the document as a png', () => {
  test.slow();

  test('hands the browser a png of the whole canvas', async ({ erd }) => {
    await erd.seed(document(2000));

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await exportPng(erd);
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^shop-.*\.png$/);
    expect(pngSize(await file.path())).toEqual({ width: 2000, height: 2000 });
  });

  test('says the png is being generated while it draws', async ({ erd }) => {
    await erd.seed(document(OVER_LIMIT));

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await exportPng(erd);

    await expect(generating(erd)).toBeVisible();
    await expect(reduced(erd)).toHaveCount(0);

    await download;
  });

  test('replaces that message with the reduced resolution, never stacking the two', async ({
    erd,
  }) => {
    await erd.seed(document(OVER_LIMIT));
    await recordToasts(erd);

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await exportPng(erd);
    const file = await download;

    await expect(reduced(erd)).toBeVisible();
    await expect(reduced(erd)).toContainText(
      `The document is ${OVER_LIMIT}x${OVER_LIMIT}, past what a browser canvas can hold, so the PNG is ${CLAMPED}x${CLAMPED}`
    );
    await expect(generating(erd)).toHaveCount(0);

    // Two states, never three: a stacked pair would record a third snapshot
    // holding both messages at once.
    const shown = (await toastTimeline(erd)).filter(toasts => toasts.length);
    expect(shown).toHaveLength(2);
    expect(shown[0]).toEqual(['Exporting PNG…']);
    expect(shown[1]).toHaveLength(1);
    expect(shown[1][0]).toContain('Exported at a reduced resolution');
    expect(shown[1][0]).toContain(
      `The document is ${OVER_LIMIT}x${OVER_LIMIT}, past what a browser canvas can hold, so the PNG is ${CLAMPED}x${CLAMPED}`
    );

    expect(pngSize(await file.path())).toEqual({
      width: CLAMPED,
      height: CLAMPED,
    });
  });
});
