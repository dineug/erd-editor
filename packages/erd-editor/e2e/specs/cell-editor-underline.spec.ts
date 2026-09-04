import type { Locator, Page } from '@playwright/test';

import { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, MEMO_SIZE } from '../support/schema';

/** The one px konva strokes a memo box with, as constants/layout spells it. */
const MEMO_BORDER = 1;

/**
 * One device pixel to a css pixel, which is where the two rasterisers disagree.
 * A half pixel of underline lands on a whole device row at four, so a scale
 * that hides the fault is no place to guard against it.
 */
const SCALE = 1;

test.use({ deviceScaleFactor: SCALE });

/**
 * How far the underline may move or thicken between the drawn cell and the
 * editor over it, in device pixels. Two colours quantise to eight bits a shade
 * apart, which is the 0.013 the fault-free measurement carries.
 */
const BAND_LIMIT_PX = 0.06;

/**
 * How far a glyph may travel between the two states, in device pixels. Blink
 * lands a painted baseline on the device grid and a canvas paints between two,
 * so a css pixel down the page is the two rasterisers and not the editor.
 */
const GLYPH_LIMIT_PX = 1 * SCALE + 0.05;

/** Frames the open editor is caught in, so a blinking caret is off in one. */
const CARET_FRAMES = 3;

const TABLE_ID = 'cells';
const COLUMN_ID = 'cells_a';
const MEMO_ID = 'note';

/** Short enough that the caret sits left of the crop and no cell ellipsises. */
const CELL_TEXT = 'Hxp';

const seed = (zoomLevel: number, at: { x: number; y: number }) =>
  createSchema({
    zoomLevel,
    tables: [
      {
        id: TABLE_ID,
        name: CELL_TEXT,
        comment: CELL_TEXT,
        x: at.x,
        y: at.y,
        columns: [
          {
            id: COLUMN_ID,
            name: CELL_TEXT,
            dataType: CELL_TEXT,
            default: CELL_TEXT,
            comment: CELL_TEXT,
          },
        ],
      },
    ],
  });

type Clip = { x: number; y: number; width: number; height: number };

type Crop = {
  /** Ink per row of the crop, against the shade below. */
  rows: number[];
  /** The shade covering most of the crop, which is what it is painted on. */
  shade: number[];
};

/**
 * The ink of one crop, row by row, against the shade that covers most of it.
 * A screenshot arrives as a png and the suite carries no decoder, so the bytes
 * go back to the browser that made them.
 */
async function cropOf(page: Page, clip: Clip): Promise<Crop> {
  const shot = await page.screenshot({ clip, animations: 'disabled' });

  return page.evaluate(async (data: string) => {
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: 'image/png' })
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context for the captured crop');
    context.drawImage(bitmap, 0, 0);

    const { width, height } = bitmap;
    const { data: pixels } = context.getImageData(0, 0, width, height);

    const counts = new Map<number, number>();
    for (let index = 0; index < width * height; index++) {
      const at = index * 4;
      const key = (pixels[at] << 16) | (pixels[at + 1] << 8) | pixels[at + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let background = 0;
    let seen = -1;
    for (const [key, count] of counts) {
      if (count > seen) {
        seen = count;
        background = key;
      }
    }
    const shade = [
      (background >> 16) & 255,
      (background >> 8) & 255,
      background & 255,
    ];

    const rows: number[] = [];
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;
        sum +=
          Math.abs(pixels[at] - shade[0]) +
          Math.abs(pixels[at + 1] - shade[1]) +
          Math.abs(pixels[at + 2] - shade[2]);
      }
      rows.push(sum / width);
    }
    return { rows, shade };
  }, shot.toString('base64'));
}

type Band = { thickness: number; top: number; bottom: number };

/**
 * Where the underline runs and how thick it is, in device pixels. The two
 * states paint it in two colours, so the profile is divided by the ink one
 * whole row of that colour carries and a plain difference is never taken.
 */
function bandOf(crop: Crop, color: number[]): Band {
  const pure =
    Math.abs(color[0] - crop.shade[0]) +
    Math.abs(color[1] - crop.shade[1]) +
    Math.abs(color[2] - crop.shade[2]);
  const coverage = crop.rows.map(row => (pure ? row / pure : 0));
  const thickness = coverage.reduce((total, part) => total + part, 0);
  let weighted = 0;
  coverage.forEach((part, index) => (weighted += part * (index + 0.5)));
  const centre = thickness ? weighted / thickness : 0;

  return {
    thickness,
    top: centre - thickness / 2,
    bottom: centre + thickness / 2,
  };
}

/** A theme colour as an rgb triple, which is what a captured pixel is. */
async function colorOf(erd: ErdEditorPage, token: string): Promise<number[]> {
  const rgb = await erd.themeColor(token);
  return (rgb.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

/**
 * Blanks the projection's own copy of every scene string. The mirror writes a
 * konva Text back out as real dom text so a locator can read it, and that copy
 * would land in the crop on top of the pixels the canvas painted.
 */
async function hideProjectedText(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('erd-editor')?.shadowRoot;
    if (!root) throw new Error('erd-editor is not mounted');

    const style = document.createElement('style');
    style.textContent =
      '.scene-mirror, .scene-mirror * { color: transparent !important; }';
    root.appendChild(style);
  });
}

/** The box the scene drew a cell's text in, off the projected text node. */
async function textBoxOf(cell: Locator) {
  const box = await cell.locator('.edit-input').boundingBox();
  if (!box) throw new Error('the cell draws no text to measure against');

  return box;
}

/** The rule the scene paints under a focused cell, which the band crop opens on. */
async function ruleBoxOf(cell: Locator) {
  const box = await cell.locator('[data-focus-border-bottom]').boundingBox();
  if (!box) throw new Error('the cell draws no rule to measure against');

  return box;
}

type CellCase = {
  key: string;
  cell: (erd: ErdEditorPage) => Locator;
};

const CELL_CASES: CellCase[] = [
  {
    key: 'tableName',
    cell: erd => erd.cell(erd.tableEl(TABLE_ID), 'tableName'),
  },
  {
    key: 'tableComment',
    cell: erd => erd.cell(erd.tableEl(TABLE_ID), 'tableComment'),
  },
  {
    key: 'columnName',
    cell: erd => erd.cell(erd.columnEl(COLUMN_ID), 'columnName'),
  },
  {
    key: 'columnDataType',
    cell: erd => erd.cell(erd.columnEl(COLUMN_ID), 'columnDataType'),
  },
  {
    key: 'columnDefault',
    cell: erd => erd.cell(erd.columnEl(COLUMN_ID), 'columnDefault'),
  },
  {
    key: 'columnComment',
    cell: erd => erd.cell(erd.columnEl(COLUMN_ID), 'columnComment'),
  },
];

/**
 * The crop the underline is read in: the right of the cell, past the glyphs and
 * the caret, ending on the row the rule ends in. Eight rows, so the shade
 * behind it still covers most of the crop at the widest zoom.
 */
const bandClipOf = (
  box: { x: number; width: number },
  rule: { y: number; height: number }
): Clip => ({
  x: Math.floor(box.x + box.width * 0.6),
  y: Math.ceil(rule.y + rule.height) - 8,
  width: Math.max(6, Math.round(box.width * 0.3)),
  height: 8,
});

/** The crop the glyphs are read in, stopping short of the underline. */
const glyphClipOf = (box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Clip => ({
  x: Math.floor(box.x),
  y: Math.floor(box.y - 2),
  width: Math.max(6, Math.round(box.width * 0.45)),
  height: Math.floor(box.height) - 1,
});

/** The same crop caught several times, kept at its dimmest row by row. */
async function dimmestRows(page: Page, clip: Clip): Promise<number[]> {
  let merged: number[] | null = null;

  for (let frame = 0; frame < CARET_FRAMES; frame++) {
    const { rows } = await cropOf(page, clip);
    merged = merged
      ? merged.map((row, index) => Math.min(row, rows[index] ?? row))
      : rows;
    await page.waitForTimeout(120);
  }

  if (!merged) throw new Error('no frame was captured');
  return merged;
}

/** Where the weight of a profile sits, which moves with a sub-pixel shift. */
function centroidOf(samples: number[]): number {
  let weighted = 0;
  let total = 0;

  samples.forEach((sample, index) => {
    weighted += sample * index;
    total += sample;
  });

  return total ? weighted / total : 0;
}

/**
 * The underline is one line, so one painter draws it. A css gradient stop is
 * resolved at the device pixel centre and a konva rect edge is antialiased, so
 * the same 1.5px came out of the dom anywhere from 0.9 to 2.5 device pixels.
 */
test.describe('the cell editor keeps the underline the scene drew', () => {
  for (const zoomLevel of [0.75, 0.9, 1, 1.1, 1.25, 1.5]) {
    for (const place of [
      { tag: 'on the whole pixel', at: { x: 400, y: 400 } },
      { tag: 'off the whole pixel', at: { x: 401, y: 401 } },
    ]) {
      test(`at zoom ${zoomLevel}, ${place.tag}`, async ({ erd }) => {
        await erd.seed(seed(zoomLevel, place.at));
        await hideProjectedText(erd.page);

        const focusColor = await colorOf(erd, '--focus');
        const editColor = await colorOf(erd, '--input-active');

        for (const { key, cell } of CELL_CASES) {
          const target = cell(erd);
          await erd.focusCell(target);
          const box = await textBoxOf(target);
          const bandClip = bandClipOf(box, await ruleBoxOf(target));
          const glyphClip = glyphClipOf(box);

          const drawnCrop = await cropOf(erd.page, bandClip);
          const drawnGlyph = await dimmestRows(erd.page, glyphClip);

          await erd.press('Enter');
          await expect(erd.editInput()).toBeFocused();
          const editedCrop = await cropOf(erd.page, bandClip);
          const editedGlyph = await dimmestRows(erd.page, glyphClip);
          await erd.press('Enter');
          await expect(erd.editInput()).toHaveCount(0);

          const drawn = bandOf(drawnCrop, focusColor);
          const edited = bandOf(editedCrop, editColor);

          expect(drawn.thickness, `${key} draws an underline`).toBeGreaterThan(
            0.5
          );
          expect(
            Math.abs(edited.thickness - drawn.thickness),
            `${key} underline thickness`
          ).toBeLessThan(BAND_LIMIT_PX);
          expect(
            Math.abs(edited.top - drawn.top),
            `${key} underline top`
          ).toBeLessThan(BAND_LIMIT_PX);
          expect(
            Math.abs(edited.bottom - drawn.bottom),
            `${key} underline bottom`
          ).toBeLessThan(BAND_LIMIT_PX);

          expect(
            Math.abs(centroidOf(editedGlyph) - centroidOf(drawnGlyph)),
            `${key} glyph drift`
          ).toBeLessThan(GLYPH_LIMIT_PX);
        }
      });
    }
  }
});

/**
 * The memo body has no second painter to disagree with: its box is a konva
 * stroke the scene keeps drawing, and the textarea over it declares no border,
 * no outline and no background of its own.
 */
test('the memo body editor paints no line of its own', async ({ erd }) => {
  await erd.seed(
    createSchema({
      memos: [{ id: MEMO_ID, value: 'note', x: 400, y: 400, width: MEMO_SIZE }],
    })
  );

  const body = [`#memo-${MEMO_ID}`, '.memo-body'] as const;
  const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
  await erd.clickAt({ x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 });
  await expect(erd.memoEditor).toBeFocused();

  // A cell used to blank its own rect and let the overlay repaint it; the memo
  // box never leaves the scene, so there is only ever one line on this box.
  expect(await erd.sceneAttr(body, 'stroke')).toBe(
    await erd.themeToken('--memo-select')
  );
  expect(await erd.sceneAttr(body, 'strokeWidth')).toBe(MEMO_BORDER);
  expect(
    await erd.memoEditor.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        border: style.borderBottomWidth,
        outline: style.outlineStyle,
        image: style.backgroundImage,
      };
    })
  ).toEqual({ border: '0px', outline: 'none', image: 'none' });
});
