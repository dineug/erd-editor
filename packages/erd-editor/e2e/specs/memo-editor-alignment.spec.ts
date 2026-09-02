import type { CDPSession, Page } from '@playwright/test';

import { ErdEditorPage, type SceneSelector } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';

/**
 * Four device pixels to a css pixel, so the half pixel blink snaps a painted
 * baseline to is two rows of the captured image rather than a shade.
 */
const SCALE = 4;

test.use({ deviceScaleFactor: SCALE });

const MEMO_ID = 'note';

/** How far any body line may travel between the drawn body and the editor. */
const DRIFT_LIMIT_PX = 0.05;

/** How far a glyph may travel across, which no correction here moves it by. */
const COLUMN_LIMIT_PX = 0.25;

/** Margin around the drawn body, so a crop keeps every row a glyph reaches. */
const CROP_MARGIN = 3;

type Place = { key: string; x: number; y: number };

const PLACES: Place[] = [
  { key: 'a round placement', x: 400, y: 320 },
  { key: 'a placement off the whole pixel', x: 401.3, y: 321.7 },
];

type Body = { key: string; value: string; width: number; lines: number };

/** Ascenders and descenders both, so a line's ink says where its baseline is. */
const WORD = 'Hxpg';

const BODIES: Body[] = [
  { key: 'one line', value: WORD, width: 220, lines: 1 },
  {
    key: 'three lines',
    value: [WORD, WORD, WORD].join('\n'),
    width: 220,
    lines: 3,
  },
  {
    key: 'one long line the box folds',
    value: [WORD, WORD, WORD, WORD, WORD, WORD].join(' '),
    width: 130,
    lines: 2,
  },
];

const seed = (zoomLevel: number, place: Place, body: Body): ErdDocument =>
  createSchema({
    zoomLevel,
    memos: [
      {
        id: MEMO_ID,
        value: body.value,
        x: place.x,
        y: place.y,
        width: body.width,
        height: 130,
      },
    ],
  });

type Clip = { x: number; y: number; width: number; height: number };

type Band = [number, number];

type Profile = {
  /** Ink per row of the crop, over its whole width. */
  rows: number[];
  /** Ink per column, one list for every line the body folded into. */
  cols: number[][];
};

/**
 * The ink of one crop, measured in the page. A screenshot arrives as a png and
 * the suite carries no decoder, so the bytes go back to the browser that made
 * them and come out as one row profile and a column profile per line.
 */
async function profileOf(
  page: Page,
  clip: Clip,
  bands: Band[]
): Promise<Profile> {
  const shot = await page.screenshot({ clip, animations: 'disabled' });

  return page.evaluate(
    async ([data, lines]: [string, Band[]]) => {
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

      const rows: number[] = [];
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) sum += inkAt(x, y);
        rows.push(sum);
      }

      const cols = lines.map(([from, to]) => {
        const band: number[] = [];
        for (let x = 0; x < width; x++) {
          let sum = 0;
          for (let y = Math.max(0, from); y < Math.min(height, to); y++) {
            sum += inkAt(x, y);
          }
          band.push(sum);
        }
        return band;
      });

      return { rows, cols };
    },
    [shot.toString('base64'), bands] as [string, Band[]]
  );
}

/** The whole-sample shift that lines two ink profiles up best, in css pixels. */
function driftOf(before: number[], after: number[]): number {
  let best = { shift: 0, cost: Infinity };

  for (let shift = -SCALE * 3; shift <= SCALE * 3; shift++) {
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

const inkOf = (samples: number[]) =>
  samples.reduce((total, sample) => total + sample, 0);

/**
 * Blanks the projection's own copy of every scene string and hides the caret.
 * The mirror writes a konva text back out as real dom text, and both that copy
 * and a blinking caret would land in the crop on top of the pixels measured.
 */
async function quietenOverlay(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('erd-editor')?.shadowRoot;
    if (!root) throw new Error('erd-editor is not mounted');

    const style = document.createElement('style');
    style.textContent = [
      '.scene-mirror, .scene-mirror * { color: transparent !important; }',
      '.edit-overlay textarea { caret-color: transparent !important; }',
    ].join('\n');
    root.appendChild(style);
  });
}

/** The screen box the scene drew the memo body in, off the konva text node. */
const bodyBoxOf = (erd: ErdEditorPage) =>
  erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea']);

/** Opens the body editor by clicking the box the scene answers a click on. */
async function openEditor(erd: ErdEditorPage) {
  const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
  await erd.clickAt({
    x: hit.x + hit.width / 2,
    y: hit.y + hit.height / 2,
  });
  await expect(erd.memoEditor).toBeFocused();
}

async function closeEditor(erd: ErdEditorPage) {
  await erd.press('Escape');
  await expect(erd.memoEditor).toHaveCount(0);
}

/**
 * The leading the scene folded a body by, in px, read off the node that folded
 * it. The leading follows the font the browser resolved, so a number written
 * here would be this suite's own answer rather than the scene's.
 */
async function leadingOf(erd: ErdEditorPage): Promise<number> {
  const body: SceneSelector = [`#memo-${MEMO_ID}`, '.memo-textarea'];
  const lineHeight = await erd.sceneAttr(body, 'lineHeight');
  const fontSize = await erd.sceneAttr(body, 'fontSize');
  expect(
    typeof lineHeight === 'number' && typeof fontSize === 'number',
    'the scene folds by a leading it hands back'
  ).toBe(true);

  const leading = (lineHeight as number) * (fontSize as number);
  expect(leading, 'that leading is a positive length').toBeGreaterThan(0);

  return leading;
}

/**
 * The crop over the drawn body and the row bands its folded lines fall in. The
 * scene gives a text node one line box per line, so the count comes off the box
 * it drew rather than off a second copy of the line breaker.
 */
async function frameOf(erd: ErdEditorPage, zoomLevel: number) {
  const box = await bodyBoxOf(erd);
  const advance = (await leadingOf(erd)) * zoomLevel;
  const lines = Math.round(box.height / advance);

  const clip = {
    x: box.x - CROP_MARGIN,
    y: box.y - CROP_MARGIN,
    width: box.width + CROP_MARGIN * 2,
    height: box.height + CROP_MARGIN * 2,
  };

  const bands: Band[] = [];
  for (let line = 0; line < lines; line++) {
    bands.push([
      Math.round((CROP_MARGIN + line * advance) * SCALE),
      Math.round((CROP_MARGIN + (line + 1) * advance) * SCALE),
    ]);
  }

  return { clip, bands, lines };
}

/**
 * The editor is dom over a canvas, so nothing short of a measurement says the
 * two agree. Each case reads one crop twice, once with the scene drawing the
 * body and once with the textarea over it, and asks for the same pixels back.
 */
test.describe('the memo body editor lands on the body it replaces', () => {
  for (const zoomLevel of [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5]) {
    for (const place of PLACES) {
      test(`every body keeps its glyphs at zoom ${zoomLevel} on ${place.key}`, async ({
        erd,
      }) => {
        await quietenOverlay(erd.page);

        for (const body of BODIES) {
          const label = `${body.key} at ${place.key}`;
          await erd.seed(seed(zoomLevel, place, body));

          const { clip, bands, lines } = await frameOf(erd, zoomLevel);
          expect(lines, `${label} folds into lines`).toBe(body.lines);

          const drawn = await profileOf(erd.page, clip, bands);
          expect(inkOf(drawn.rows), `${label} draws glyphs`).toBeGreaterThan(1);

          await openEditor(erd);
          const edited = await profileOf(erd.page, clip, bands);
          await closeEditor(erd);
          await erd.hoverAway();

          bands.forEach(([from, to], line) => {
            const rowsBefore = drawn.rows.slice(from, to);
            const rowsAfter = edited.rows.slice(from, to);
            expect(
              driftOf(rowsBefore, rowsAfter),
              `${label} line ${line} vertical drift`
            ).toBe(0);
            expect(
              Math.abs(centroidOf(rowsAfter) - centroidOf(rowsBefore)) / SCALE,
              `${label} line ${line} sub pixel vertical drift`
            ).toBeLessThan(DRIFT_LIMIT_PX);

            expect(
              driftOf(drawn.cols[line], edited.cols[line]),
              `${label} line ${line} horizontal drift`
            ).toBe(0);
            expect(
              Math.abs(
                centroidOf(edited.cols[line]) - centroidOf(drawn.cols[line])
              ) / SCALE,
              `${label} line ${line} sub pixel horizontal drift`
            ).toBeLessThan(COLUMN_LIMIT_PX);
          });
        }
      });
    }
  }
});

/** The syllable an ime hands over one jamo at a time while it is composing. */
const COMPOSING = '한';

/**
 * A composition is text the editor holds but has not committed, drawn with a
 * decoration of its own. The glyphs already laid out are not part of it, and a
 * body that reflows around one would move the line the caret is not on.
 */
test('a body composed through an ime holds the glyphs already laid out', async ({
  erd,
}) => {
  await quietenOverlay(erd.page);
  await erd.seed(seed(1, PLACES[0], BODIES[0]));

  const box = await bodyBoxOf(erd);
  // Short of where the composition lands, which is past the end of the value.
  const clip = {
    x: box.x - CROP_MARGIN,
    y: box.y - CROP_MARGIN,
    width: box.width + CROP_MARGIN - 1,
    height: box.height + CROP_MARGIN * 2,
  };
  const bands: Band[] = [[0, Math.round(clip.height * SCALE)]];

  const drawn = await profileOf(erd.page, clip, bands);

  await openEditor(erd);
  const session: CDPSession = await erd.page.context().newCDPSession(erd.page);
  await session.send('Input.imeSetComposition', {
    text: COMPOSING,
    selectionStart: 0,
    selectionEnd: COMPOSING.length,
  });
  await expect(erd.memoEditor).toHaveValue(`${BODIES[0].value}${COMPOSING}`);

  const composing = await profileOf(erd.page, clip, bands);
  await closeEditor(erd);

  expect(driftOf(drawn.rows, composing.rows), 'vertical drift').toBe(0);
  expect(
    Math.abs(centroidOf(composing.rows) - centroidOf(drawn.rows)) / SCALE,
    'sub pixel vertical drift'
  ).toBeLessThan(DRIFT_LIMIT_PX);
  expect(driftOf(drawn.cols[0], composing.cols[0]), 'horizontal drift').toBe(0);
  expect(
    Math.abs(centroidOf(composing.cols[0]) - centroidOf(drawn.cols[0])) / SCALE,
    'sub pixel horizontal drift'
  ).toBeLessThan(COLUMN_LIMIT_PX);
});
