import { readFileSync } from 'node:fs';

import type { Locator } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The dialog every image export goes through: what it opens on, what its
// options do to the file the browser receives, and the clipboard beside it.

/** services/export-png/exportBox.ts — the margin the image leaves around the content. */
const EXPORT_MARGIN = 80;

/** utils/calcMemo.ts — the frame a memo draws around the box its ui states. */
const MEMO_FRAME_WIDTH = 18;
const MEMO_FRAME_HEIGHT = 34;

const MEMO_BOX = { width: 100, height: 100 };

/** The content span every document here is seeded with, so the image box is SPAN plus the margin. */
const SPAN = 920;

const BOX = SPAN + EXPORT_MARGIN * 2;

/** The scale the dialog opens at. */
const DEFAULT_SCALE = 2;

/** Long enough for one export, the shared worker's first start included. */
const EXPORT_TIMEOUT = 15_000;

/** A box that fits a canvas at 1x and, at the 2x default, asks for more than one holds. */
const WIDE_BOX = 10_000;

/** The side of the largest square raster every current engine holds. */
const CANVAS_SQUARE = 16_384;

/**
 * Long enough for an export at the canvas ceiling, which the shared worker
 * rasterises and encodes in seconds on a laptop and a few times that on a runner.
 */
const CEILING_EXPORT_TIMEOUT = 30_000;

/** Bare canvas clear of the memo at scene zero, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 400, y: 400 };

/** Bare canvas clear of the Find and Replace panel, which stands 396 px in from the canvas edge. */
const CLEAR_OF_PANEL = { x: 700, y: 400 };

/** One memo at scene zero and one whose far corner lands on the span. */
function document(span = SPAN, zoomLevel = 1): ErdDocument {
  return createSchema({
    databaseName: 'shop',
    zoomLevel,
    memos: [
      { id: 'origin', value: 'origin', x: 0, y: 0, ...MEMO_BOX },
      {
        id: 'far',
        value: 'far',
        x: span - (MEMO_BOX.width + MEMO_FRAME_WIDTH),
        y: span - (MEMO_BOX.height + MEMO_FRAME_HEIGHT),
        ...MEMO_BOX,
      },
    ],
  });
}

const dialogOf = (erd: ErdEditorPage) =>
  erd.host.getByRole('dialog', { name: 'Export image' });

const button = (dialog: Locator, name: string) =>
  dialog.getByRole('button', { name, exact: true });

async function openFromMenu(erd: ErdEditorPage, at = MENU_ORIGIN) {
  await erd.openContextMenuAt(at.x, at.y);
  await erd.contextMenu.getByText('Export', { exact: true }).hover();
  const image = erd.contextMenu.getByText('Image', { exact: true });
  await expect(image).toBeVisible();
  await image.click();

  const dialog = dialogOf(erd);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The size a png declares in its header. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The alpha of two pixels of a png, decoded by the browser that wrote it. */
async function alphaAt(
  erd: ErdEditorPage,
  bytes: Buffer,
  points: Array<{ x: number; y: number }>
) {
  return erd.page.evaluate(
    async ({ base64, points }) => {
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = window.document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      return points.map(({ x, y }) => context.getImageData(x, y, 1, 1).data[3]);
    },
    { base64: bytes.toString('base64'), points }
  );
}

/** The alpha of two pixels of an svg, as the browser that wrote it renders the file. */
async function svgAlphaAt(
  erd: ErdEditorPage,
  text: string,
  points: Array<{ x: number; y: number }>
) {
  return erd.page.evaluate(
    async ({ base64, points }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${base64}`;
      await image.decode();
      const canvas = window.document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return points.map(({ x, y }) => context.getImageData(x, y, 1, 1).data[3]);
    },
    { base64: Buffer.from(text).toString('base64'), points }
  );
}

/** The size and the viewBox an svg declares on its root. */
function svgRoot(text: string) {
  const root = /^<svg\b[^>]*>/.exec(text)?.[0] ?? '';
  const read = (name: string) =>
    new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1] ?? null;

  return {
    width: read('width'),
    height: read('height'),
    viewBox: read('viewBox'),
  };
}

async function downloadSvg(erd: ErdEditorPage, dialog: Locator) {
  const download = erd.page.waitForEvent('download', {
    timeout: EXPORT_TIMEOUT,
  });
  await button(dialog, 'SVG').click();
  const file = await download;
  return {
    name: file.suggestedFilename(),
    text: readFileSync(await file.path(), 'utf8'),
  };
}

async function downloadPng(
  erd: ErdEditorPage,
  dialog: Locator,
  timeout = EXPORT_TIMEOUT
) {
  const download = erd.page.waitForEvent('download', { timeout });
  await button(dialog, 'PNG').click();
  const file = await download;
  return {
    name: file.suggestedFilename(),
    bytes: readFileSync(await file.path()),
  };
}

test.describe('the export image dialog', () => {
  test.slow();

  test('opens from the canvas menu on its defaults, the PNG button focused, and Escape hands the keyboard back', async ({
    erd,
  }) => {
    await erd.seed(document());

    const dialog = await openFromMenu(erd);

    await expect(button(dialog, 'PNG')).toBeFocused();
    await expect(
      dialog.getByRole('switch', { name: 'Background' })
    ).toHaveAttribute('aria-checked', 'true');
    // The fixture runs dark, and dark mode starts at what the editor shows.
    await expect(
      dialog.getByRole('switch', { name: 'Dark mode' })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(button(dialog, '2x')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(dialog, 'SVG')).toBeVisible();
    await expect(dialog.locator('.export-image-preview img')).toBeVisible();
    await expect(dialog.locator('.export-image-size')).toHaveText(
      `PNG ${BOX * DEFAULT_SCALE} × ${BOX * DEFAULT_SCALE} px`
    );

    await erd.press(Shortcut.stop);

    await expect(dialog).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
  });

  test('opens from the palette, as Image under Export', async ({ erd }) => {
    await erd.seed(document());
    await erd.focusCanvas();
    const quickSearch = erd.host.locator('.quick-search');

    await erd.press(Shortcut.search);
    await quickSearch.getByText('Export', { exact: true }).click();
    await quickSearch.getByText('Image', { exact: true }).click();

    await expect(dialogOf(erd)).toBeVisible();
    await expect(quickSearch).toHaveCount(0);
    await expect(button(dialogOf(erd), 'PNG')).toBeFocused();
  });

  test('writes a png at the zoom times the scale, two by default, and stays open', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);

    const twice = await downloadPng(erd, dialog);

    expect(twice.name).toMatch(/^shop-.*\.png$/);
    expect(pngSize(twice.bytes)).toEqual({
      width: BOX * DEFAULT_SCALE,
      height: BOX * DEFAULT_SCALE,
    });
    await expect(dialog).toBeVisible();

    await button(dialog, '3x').click();
    await expect(dialog.locator('.export-image-size')).toHaveText(
      `PNG ${BOX * 3} × ${BOX * 3} px`
    );
    const thrice = await downloadPng(erd, dialog);

    expect(pngSize(thrice.bytes)).toEqual({ width: BOX * 3, height: BOX * 3 });
  });

  test('reports a cut the 2x default makes in the pixels the dialog warned of', async ({
    erd,
  }) => {
    await erd.seed(document(WIDE_BOX - EXPORT_MARGIN * 2));
    const dialog = await openFromMenu(erd);
    const size = dialog.locator('.export-image-size');
    const warning = dialog.locator('.export-image-reduced');
    const asked = `${WIDE_BOX * DEFAULT_SCALE} × ${WIDE_BOX * DEFAULT_SCALE} px`;
    const written = `${CANVAS_SQUARE} × ${CANVAS_SQUARE} px`;

    // At 1x the same box fits a canvas: what outruns one is the scale.
    await button(dialog, '1x').click();
    await expect(size).toHaveText(`PNG ${WIDE_BOX} × ${WIDE_BOX} px`);
    await expect(warning).toHaveCount(0);

    await button(dialog, '2x').click();
    await expect(size).toHaveText(`PNG ${written}`);
    await expect(warning).toHaveText(
      `Reduced from ${asked}, past what a browser canvas can hold`
    );
    const file = await downloadPng(erd, dialog, CEILING_EXPORT_TIMEOUT);

    expect(pngSize(file.bytes)).toEqual({
      width: CANVAS_SQUARE,
      height: CANVAS_SQUARE,
    });
    await expect(
      erd.host.locator('.toast-container', {
        hasText: 'Exported at a reduced resolution',
      })
    ).toContainText(
      `Reduced from ${asked} to ${written}, past what a browser canvas can hold`
    );
  });

  test('leaves the canvas out of the png with the background off', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    await button(dialog, '1x').click();
    // A corner of the margin, and the middle of the memo at scene zero.
    const points = [
      { x: 4, y: 4 },
      { x: EXPORT_MARGIN + 50, y: EXPORT_MARGIN + 60 },
    ];

    const filled = await downloadPng(erd, dialog);
    expect(await alphaAt(erd, filled.bytes, points)).toEqual([255, 255]);

    const background = dialog.getByRole('switch', { name: 'Background' });
    await background.click();
    await expect(background).toHaveAttribute('aria-checked', 'false');
    const bare = await downloadPng(erd, dialog);

    expect(await alphaAt(erd, bare.bytes, points)).toEqual([0, 255]);
  });

  test('writes an svg at the zoom, the scale left to the png, and stays open', async ({
    erd,
  }) => {
    const zoomLevel = 0.8;
    await erd.seed(document(SPAN, zoomLevel));
    const dialog = await openFromMenu(erd);

    await button(dialog, '3x').click();
    const file = await downloadSvg(erd, dialog);

    expect(file.name).toMatch(/^shop-.*\.svg$/);
    expect(svgRoot(file.text)).toEqual({
      width: String(BOX * zoomLevel),
      height: String(BOX * zoomLevel),
      viewBox: `${-EXPORT_MARGIN} ${-EXPORT_MARGIN} ${BOX} ${BOX}`,
    });
    // The memos are written as text a viewer can select, never as pixels.
    expect(file.text).toContain('>origin</text>');
    expect(file.text).toContain('>far</text>');
    await expect(dialog).toBeVisible();
  });

  test('leaves the canvas out of the svg with the background off', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    // A corner of the margin, and the middle of the memo at scene zero.
    const points = [
      { x: 4, y: 4 },
      { x: EXPORT_MARGIN + 50, y: EXPORT_MARGIN + 60 },
    ];

    const filled = await downloadSvg(erd, dialog);
    expect(await svgAlphaAt(erd, filled.text, points)).toEqual([255, 255]);

    const background = dialog.getByRole('switch', { name: 'Background' });
    await background.click();
    await expect(background).toHaveAttribute('aria-checked', 'false');
    const bare = await downloadSvg(erd, dialog);

    expect(await svgAlphaAt(erd, bare.text, points)).toEqual([0, 255]);
  });

  test('puts the png on the clipboard and says so', async ({ erd }) => {
    await erd.page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await erd.seed(document());
    const dialog = await openFromMenu(erd);

    await button(dialog, 'Copy to clipboard').click();

    await expect(
      erd.host.locator('.toast-container', {
        hasText: 'Copied the image to the clipboard',
      })
    ).toBeVisible({ timeout: EXPORT_TIMEOUT });
    const copied = await erd.page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      const blob = await item.getType('image/png');
      const bitmap = await createImageBitmap(blob);
      return { types: item.types, width: bitmap.width, height: bitmap.height };
    });

    expect(copied).toEqual({
      types: ['image/png'],
      width: BOX * DEFAULT_SCALE,
      height: BOX * DEFAULT_SCALE,
    });
    await expect(dialog).toBeVisible();
  });

  test('keeps Tab inside the box, turning round at either end', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    const copy = button(dialog, 'Copy to clipboard');
    const background = dialog.getByRole('switch', { name: 'Background' });

    await copy.focus();
    await erd.press('Tab');
    await expect(background).toBeFocused();

    await erd.press('Shift+Tab');
    await expect(copy).toBeFocused();
  });

  test('gives way to Find and Replace on its chord, the panel open beneath it already', async ({
    erd,
  }) => {
    await erd.seed(document());
    const panel = erd.host.locator('.find-replace');
    await erd.focusCanvas(CLEAR_OF_PANEL);
    await erd.press(Shortcut.findReplace);
    await expect(panel).toBeVisible();

    const dialog = await openFromMenu(erd, CLEAR_OF_PANEL);
    await expect(button(dialog, 'PNG')).toBeFocused();
    await expect(panel).toHaveCount(0);

    await erd.press(Shortcut.findReplace);

    await expect(dialog).toHaveCount(0);
    await expect(panel.locator('.find-input')).toBeFocused();
  });

  test('closes on a press on the dim, never on a text selection let go over it', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    const size = dialog.locator('.export-image-size');
    await expect(size).toHaveText(
      `${BOX * DEFAULT_SCALE} × ${BOX * DEFAULT_SCALE} px`
    );
    const text = (await size.boundingBox())!;
    const box = (await dialog.boundingBox())!;
    const dim = { x: box.x / 2, y: box.y + box.height / 2 };

    await erd.page.mouse.move(text.x + 2, text.y + text.height / 2);
    await erd.page.mouse.down();
    await erd.page.mouse.move(dim.x, dim.y, { steps: 5 });
    await erd.page.mouse.up();

    await expect(dialog).toBeVisible();

    await erd.page.mouse.click(dim.x, dim.y);

    await expect(dialog).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
  });

  test('scrolls in a short editor, so the buttons at its foot stay in reach', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    const copy = button(dialog, 'Copy to clipboard');

    // Narrow enough to stack the preview above the options, and too short for both.
    await erd.page.setViewportSize({ width: 600, height: 480 });
    await expect(dialog.locator('.export-image.stacked')).toBeVisible();
    await expect(copy).not.toBeInViewport();

    await dialog.hover();
    await erd.page.mouse.wheel(0, 600);

    await expect(copy).toBeInViewport();
  });

  test('keeps the canvas shortcuts off while it is open, and a button takes Space', async ({
    erd,
  }) => {
    await erd.seed(document());
    const dialog = await openFromMenu(erd);
    await expect(button(dialog, 'PNG')).toBeFocused();

    await erd.press(Shortcut.addTable);
    await erd.press(Shortcut.addMemo);

    // Space is the hand tool's key, and the PNG button still takes it.
    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });
    await erd.press('Space');
    await download;

    expect(await erd.tableIds()).toEqual([]);
    expect(await erd.memoIds()).toEqual(['origin', 'far']);
  });
});
