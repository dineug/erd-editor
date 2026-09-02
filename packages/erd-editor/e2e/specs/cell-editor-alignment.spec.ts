import type { Locator, Page } from '@playwright/test';

import { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema } from '../support/schema';

/**
 * Four device pixels to a css pixel, so half a pixel of drift is two rows of the
 * captured image rather than a change of shade nothing can name.
 */
const SCALE = 4;

test.use({ deviceScaleFactor: SCALE });

/** How far a glyph may travel between the drawn cell and the editor over it. */
const DRIFT_LIMIT_PX = 0.05;

/** Frames the open editor is caught in, so a blinking caret is off in one. */
const CARET_FRAMES = 5;

/** The share of the cell the glyphs are read off, which the caret is past. */
const TEXT_REACH = 0.8;

const TABLE_ID = 'cells';
const COLUMN_ID = 'cells_a';

/** Short enough that the caret sits outside the reach and no cell ellipsises. */
const CELL_TEXT = 'Hxp';

/**
 * Far enough in that every cell is on screen at 1.5 too, where the canvas box is
 * wider than the viewport and the scene starts negative. Round, so the scene
 * lands on whole pixels at every zoom the round-placement cases use.
 */
const ROUND_AT = { x: 400, y: 400 };

const seed = (zoomLevel: number, at = ROUND_AT) =>
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

type Profile = {
  /** Ink per row of the crop, over the glyphs and never over the caret. */
  rows: number[];
  /** Ink per column of the crop, over the rows above the underline. */
  cols: number[];
  /** The rows the underline runs through, being the ones it spans whole. */
  bandTop: number | null;
  bandBottom: number | null;
};

/**
 * The ink of one crop, measured in the page. A screenshot arrives as a png and
 * the suite carries no decoder, so the bytes go back to the browser that made
 * them and come out as two profiles and the rows the underline covers.
 */
async function profileOf(page: Page, clip: Clip): Promise<Profile> {
  const shot = await page.screenshot({ clip, animations: 'disabled' });

  return page.evaluate(
    async ([data, reachShare]: [string, number]) => {
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
      const red = (background >> 16) & 255;
      const green = (background >> 8) & 255;
      const blue = background & 255;

      const inkAt = (x: number, y: number) => {
        const at = (y * width + x) * 4;
        return (
          (Math.abs(pixels[at] - red) +
            Math.abs(pixels[at + 1] - green) +
            Math.abs(pixels[at + 2] - blue)) /
          765
        );
      };

      // The underline is the one thing running the whole cell, so it is read
      // across the crop; the glyphs are read off the left of it, which is short
      // of where the caret waits at the end of the value.
      const reach = Math.max(1, Math.round(height * reachShare));
      const rows: number[] = [];
      const band: number[] = [];
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let covered = 0;
        for (let x = 0; x < width; x++) {
          const ink = inkAt(x, y);
          if (x < reach) sum += ink;
          if (ink > 0.06) covered++;
        }
        rows.push(sum);
        if (covered > width * 0.95) band.push(y);
      }

      const glyphEnd = band.length ? band[0] - 1 : height - 1;
      const cols: number[] = [];
      for (let x = 0; x < reach; x++) {
        let sum = 0;
        for (let y = 0; y <= glyphEnd; y++) sum += inkAt(x, y);
        cols.push(sum);
      }

      return {
        rows,
        cols,
        bandTop: band.length ? band[0] : null,
        bandBottom: band.length ? band[band.length - 1] : null,
      };
    },
    [shot.toString('base64'), TEXT_REACH] as [string, number]
  );
}

/** The same crop caught several times, kept at its dimmest sample by sample. */
async function openProfileOf(page: Page, clip: Clip): Promise<Profile> {
  let merged: Profile | null = null;

  for (let frame = 0; frame < CARET_FRAMES; frame++) {
    const profile = await profileOf(page, clip);
    merged = merged
      ? {
          ...merged,
          rows: merged.rows.map((row, index) =>
            Math.min(row, profile.rows[index] ?? row)
          ),
          cols: merged.cols.map((col, index) =>
            Math.min(col, profile.cols[index] ?? col)
          ),
        }
      : profile;
    await page.waitForTimeout(120);
  }

  if (!merged) throw new Error('no frame was captured');
  return merged;
}

/** The rows above the underline, which are the ones a glyph can reach. */
const glyphRowsOf = (profile: Profile) =>
  profile.rows.slice(0, profile.bandTop ?? profile.rows.length);

/** The whole-sample shift that lines two ink profiles up best, in css pixels. */
function driftOf(before: number[], after: number[]): number {
  let best = { shift: 0, cost: Infinity };

  for (let shift = -SCALE * 2; shift <= SCALE * 2; shift++) {
    let cost = 0;
    for (let index = 0; index < before.length; index++) {
      cost += Math.abs(before[index] - (after[index + shift] ?? 0));
    }
    if (cost < best.cost) best = { shift, cost };
  }

  return best.shift / SCALE;
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
async function textBoxOf(cell: Locator): Promise<Clip> {
  const box = await cell.locator('.edit-input').boundingBox();
  if (!box) throw new Error('the cell draws no text to measure against');

  return { x: box.x, y: box.y, width: box.width, height: box.height };
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

/** A table and a zoom whose product puts the cell off the whole pixel. */
const OFF_PIXEL = { x: 401, y: 401, zoomLevel: 1.25 };

/**
 * The offset the editor gives its input back is one number for every cell, so a
 * placement that lands between two pixels is where a per-position correction
 * would show up as drift the round placements above can never produce.
 */
test('the glyphs hold at a placement that lands off the whole pixel', async ({
  erd,
}) => {
  await erd.seed(seed(OFF_PIXEL.zoomLevel, OFF_PIXEL));
  await hideProjectedText(erd.page);

  for (const { key, cell } of CELL_CASES) {
    const target = cell(erd);
    await erd.focusCell(target);
    const clip = await textBoxOf(target);
    expect(
      Math.abs(clip.y % 1),
      `${key} sits off the whole pixel`
    ).toBeGreaterThan(0.05);
    const drawn = await profileOf(erd.page, clip);

    await erd.press('Enter');
    await expect(erd.editInput()).toBeFocused();
    const edited = await openProfileOf(erd.page, clip);
    await erd.press('Enter');
    await expect(erd.editInput()).toHaveCount(0);

    // Read only the rows both states agree are above the underline: the two
    // paint that line in different colours, and the row it half covers falls
    // on either side of the coverage the band is found by.
    const cut = Math.min(
      drawn.bandTop ?? drawn.rows.length,
      edited.bandTop ?? edited.rows.length
    );
    const rowsBefore = drawn.rows.slice(0, cut);
    const rowsAfter = edited.rows.slice(0, cut);

    expect(driftOf(rowsBefore, rowsAfter), `${key} vertical drift`).toBe(0);
    expect(
      Math.abs(centroidOf(rowsAfter) - centroidOf(rowsBefore)) / SCALE,
      `${key} sub pixel vertical drift`
    ).toBeLessThan(DRIFT_LIMIT_PX);
    expect(driftOf(drawn.cols, edited.cols), `${key} horizontal drift`).toBe(0);
    expect(
      Math.abs(centroidOf(edited.cols) - centroidOf(drawn.cols)) / SCALE,
      `${key} sub pixel horizontal drift`
    ).toBeLessThan(DRIFT_LIMIT_PX);
  }
});

/** The zoom at and below which the scene swaps the whole table for a name. */
const HIGH_LEVEL_ZOOM = 0.7;

/** Just above the swap, so a few notches of wheel zoom cross it. */
const NEAR_SWAP_ZOOM = 0.75;

/**
 * Below the swap the scene draws no cells, so an editor has no text to land on.
 * The zoom is crossed with one already open, which is the only way into that
 * state, and it has to close rather than sit on a cell that was never drawn.
 */
test('the zoom crossing the swap closes the editor it would strand', async ({
  erd,
}) => {
  await erd.seed(seed(NEAR_SWAP_ZOOM));
  await erd.focusCell(erd.cell(erd.tableEl(TABLE_ID), 'tableName'));
  await erd.press('Enter');
  await expect(erd.editInput()).toBeFocused();
  await expect(erd.canvas.locator('.high-level-table')).toHaveCount(0);

  const modKey = await erd.pointerModKey();
  for (let notch = 0; notch < 4; notch++) {
    await erd.wheel(120, { modifiers: [modKey] });
  }
  await expect
    .poll(async () => (await erd.settings()).zoomLevel)
    .toBeLessThanOrEqual(HIGH_LEVEL_ZOOM);

  await expect(erd.canvas.locator('.high-level-table')).toHaveCount(1);
  await expect(erd.canvas.locator('.column-row')).toHaveCount(0);
  await expect(erd.editInput()).toHaveCount(0);
});

/**
 * The editor is dom over a canvas, so nothing short of a measurement says the
 * two agree. Each case reads one crop twice, once with the scene drawing the
 * text and once with the input over it, and asks for the same pixels back.
 */
test.describe('the cell editor lands on the text it replaces', () => {
  for (const zoomLevel of [0.8, 1, 1.5]) {
    test(`every cell keeps its glyphs and its underline at zoom ${zoomLevel}`, async ({
      erd,
    }) => {
      await erd.seed(seed(zoomLevel));
      await hideProjectedText(erd.page);

      for (const { key, cell } of CELL_CASES) {
        const target = cell(erd);
        await erd.focusCell(target);
        const clip = await textBoxOf(target);
        const drawn = await profileOf(erd.page, clip);

        await erd.press('Enter');
        await expect(erd.editInput()).toBeFocused();
        const edited = await openProfileOf(erd.page, clip);
        await erd.press('Enter');
        await expect(erd.editInput()).toHaveCount(0);

        expect(drawn.bandTop, `${key} draws an underline`).not.toBeNull();
        expect(
          drawn.rows.reduce((total, row) => total + row, 0),
          `${key} draws glyphs`
        ).toBeGreaterThan(1);

        expect(edited.bandTop, `${key} underline top`).toBe(drawn.bandTop);
        expect(edited.bandBottom, `${key} underline bottom`).toBe(
          drawn.bandBottom
        );

        const rowsBefore = glyphRowsOf(drawn);
        const rowsAfter = glyphRowsOf(edited);
        expect(driftOf(rowsBefore, rowsAfter), `${key} vertical drift`).toBe(0);
        expect(
          Math.abs(centroidOf(rowsAfter) - centroidOf(rowsBefore)) / SCALE,
          `${key} sub pixel vertical drift`
        ).toBeLessThan(DRIFT_LIMIT_PX);

        expect(
          driftOf(drawn.cols, edited.cols),
          `${key} horizontal drift`
        ).toBe(0);
        expect(
          Math.abs(centroidOf(edited.cols) - centroidOf(drawn.cols)) / SCALE,
          `${key} sub pixel horizontal drift`
        ).toBeLessThan(DRIFT_LIMIT_PX);
      }
    });
  }
});
