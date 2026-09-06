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

/** services/export-png/exportBox.ts — the margin the image leaves around the content. */
const EXPORT_MARGIN = 80;

/**
 * utils/calcMemo.ts — the frame a memo draws around the box its ui states, on
 * both sides. A memo is the only entity whose drawn size is in the seed rather
 * than measured from a font the runner happens to have.
 */
const MEMO_FRAME_WIDTH = 18;
const MEMO_FRAME_HEIGHT = 34;

/** The ui box every memo seeded here is given, so its drawn frame is known. */
const MEMO_BOX = { width: 100, height: 100 };

const memoWidth = MEMO_BOX.width + MEMO_FRAME_WIDTH;
const memoHeight = MEMO_BOX.height + MEMO_FRAME_HEIGHT;

/** The content span an image of exactly size on a side is drawn from. */
const spanFor = (size: number) => size - EXPORT_MARGIN * 2;

/**
 * Long enough for one export on the dev server. The shared worker never starts
 * there, so every export spends the ten second handshake before the main
 * thread draws the image itself.
 */
const EXPORT_TIMEOUT = 45_000;

/** Bare canvas clear of the memo at scene zero, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 400, y: 400 };

/**
 * A document whose drawn content spans exactly span scene units on each axis:
 * one memo at scene zero and one whose far corner lands on the span. The image
 * is that span plus the margin on every side, and nothing else states its size.
 */
function document(span: number): ErdDocument {
  return createSchema({
    databaseName: 'shop',
    memos: [
      { id: 'origin', value: 'origin', x: 0, y: 0, ...MEMO_BOX },
      {
        id: 'far',
        value: 'far',
        x: span - memoWidth,
        y: span - memoHeight,
        ...MEMO_BOX,
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
    await erd.seed(document(spanFor(2160)));

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await exportPng(erd);
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^shop-.*\.png$/);
    expect(pngSize(await file.path())).toEqual({ width: 2160, height: 2160 });
  });

  test('draws the png at the zoom the editor is showing it at', async ({
    erd,
  }) => {
    await erd.seed(document(spanFor(2160)));

    // The toolbar box, which names one zoom rather than a run of notches.
    const zoom = erd.toolbar.locator('input[title="zoom level"]');
    await zoom.click();
    await zoom.fill('50');
    await zoom.press('Enter');
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(0.5, 5);

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await exportPng(erd);
    const file = await download;

    // The image holds the whole document either way. What the zoom decides is
    // how many image pixels one scene unit was drawn with.
    expect(pngSize(await file.path())).toEqual({ width: 1080, height: 1080 });
  });

  test('says the png is being generated while it draws', async ({ erd }) => {
    await erd.seed(document(spanFor(OVER_LIMIT)));

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
    await erd.seed(document(spanFor(OVER_LIMIT)));
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
