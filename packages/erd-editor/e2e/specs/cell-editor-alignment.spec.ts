import type { Locator, Page } from '@playwright/test';

import { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema } from '../support/schema';

/**
 * Two device pixels to a css pixel, which is what a retina display gives. Four
 * lands the whole fixture on the device grid, and a scale that cancels the
 * rounding by construction is no place to guard against it.
 */
const SCALE = 2;

test.use({ deviceScaleFactor: SCALE });

/** How far a glyph may travel between the two states, in device pixels. */
const DRIFT_LIMIT_PX = 0.05;

/**
 * How much of one profile the other cannot account for once it is shifted and
 * scaled onto it. The two states paint the same glyphs a shade apart, so the
 * ink totals differ by a little and the shapes by nothing.
 */
const RESIDUAL_LIMIT = 0.01;

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

/** One profile read at a sample that need not be a whole one. */
function sampleAt(samples: number[], at: number): number {
  const low = Math.floor(at);
  const share = at - low;
  const before = low < 0 || low >= samples.length ? 0 : samples[low];
  const after = low + 1 < 0 || low + 1 >= samples.length ? 0 : samples[low + 1];

  return before * (1 - share) + after * share;
}

type Alignment = {
  /** How far the second profile sits below the first, in device pixels. */
  shift: number;
  /** What share of the second profile the fit leaves unexplained. */
  residual: number;
};

/**
 * Where one ink profile sits against another, to a fraction of a sample. The
 * fit takes the best scale at every shift, so a state that paints the same
 * glyphs a shade brighter reads as no movement rather than as a little.
 */
function alignmentOf(before: number[], after: number[]): Alignment {
  let best: Alignment = { shift: 0, residual: Infinity };

  for (let shift = -2 * SCALE; shift <= 2 * SCALE; shift += 0.005) {
    let product = 0;
    let square = 0;
    for (let index = 0; index < after.length; index++) {
      const sample = sampleAt(before, index - shift);
      product += sample * after[index];
      square += sample * sample;
    }
    if (!square) continue;

    const scale = product / square;
    let left = 0;
    let energy = 0;
    for (let index = 0; index < after.length; index++) {
      const gap = after[index] - scale * sampleAt(before, index - shift);
      left += gap * gap;
      energy += after[index] * after[index];
    }

    const residual = energy ? left / energy : left;
    if (residual < best.residual) best = { shift, residual };
  }

  return best;
}

/**
 * Asserts that two profiles carry the same ink in the same place. Both states
 * are read off one crop, so a glyph that moved shows up as a shift and a glyph
 * that changed shape shows up as residual the shift cannot take away.
 */
function expectNoDrift(before: number[], after: number[], what: string) {
  const { shift, residual } = alignmentOf(before, after);

  expect(Math.abs(shift), `${what} drift`).toBeLessThan(DRIFT_LIMIT_PX);
  expect(residual, `${what} shape`).toBeLessThan(RESIDUAL_LIMIT);
}

/** The rows both states agree are above the underline, which glyphs reach. */
function glyphRowsOf(profile: Profile, cut: number) {
  return profile.rows.slice(0, cut);
}

/** The last row a glyph can reach, being the one the underline starts on. */
const cutOf = (drawn: Profile, edited: Profile) =>
  Math.min(
    drawn.bandTop ?? drawn.rows.length,
    edited.bandTop ?? edited.rows.length
  );

/**
 * Blanks the projection's own copy of every scene string and hides the caret.
 * The mirror writes a konva Text back out as real dom text, and both that copy
 * and a blinking caret would land in the crop over the pixels canvas painted.
 */
async function hideProjectedText(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('erd-editor')?.shadowRoot;
    if (!root) throw new Error('erd-editor is not mounted');

    const style = document.createElement('style');
    style.textContent = [
      '.scene-mirror, .scene-mirror * { color: transparent !important; }',
      '.edit-overlay input.edit-input { caret-color: transparent !important; }',
    ].join('\n');
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
    const edited = await profileOf(erd.page, clip);
    await erd.press('Enter');
    await expect(erd.editInput()).toHaveCount(0);

    // Read only the rows both states agree are above the underline: the two
    // paint that line in different colours, and the row it half covers falls
    // on either side of the coverage the band is found by.
    const cut = cutOf(drawn, edited);

    expectNoDrift(
      glyphRowsOf(drawn, cut),
      glyphRowsOf(edited, cut),
      `${key} vertical`
    );
    expectNoDrift(drawn.cols, edited.cols, `${key} horizontal`);
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
        const edited = await profileOf(erd.page, clip);
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

        const cut = cutOf(drawn, edited);
        expectNoDrift(
          glyphRowsOf(drawn, cut),
          glyphRowsOf(edited, cut),
          `${key} vertical`
        );
        expectNoDrift(drawn.cols, edited.cols, `${key} horizontal`);
      }
    });
  }
});
