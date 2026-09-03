import type { CDPSession, Page } from '@playwright/test';

import {
  ErdEditorPage,
  type Point,
  type SceneSelector,
} from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';

/**
 * The display this whole file runs on. Blink resolves line-height normal from
 * font metrics snapped to the device grid, so the leading is 14 here and 15 on
 * a plain one, and every display a person is likely on is this one or finer.
 */
const DISPLAY_SCALE = 2;

/**
 * A whole browser started on that display, which is the only way to it. A
 * context deviceScaleFactor moves what a screenshot is captured at and nothing
 * else, so a suite that emulates one alone lays out on the grid ci already ran.
 */
test.use({
  launchOptions: { args: [`--force-device-scale-factor=${DISPLAY_SCALE}`] },
});

/**
 * The device grids a crop is read on. Two is what this display captures at, and
 * four splits the half pixel blink snaps a painted baseline to into two rows of
 * the image rather than one shade of it.
 */
const SCALES = [2, 4];

const MEMO_ID = 'note';

/** How far any body line may travel between the drawn body and the editor. */
const DRIFT_LIMIT_PX = 0.05;

/** How far a glyph may travel across, which no correction here moves it by. */
const COLUMN_LIMIT_PX = 0.25;

/** Margin around the drawn body, so a crop keeps every row a glyph reaches. */
const CROP_MARGIN = 3;

/** Every zoom the editor offers between its two ends, which each block walks. */
const ZOOM_LEVELS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];

type Place = { key: string; x: number; y: number };

const PLACES: Place[] = [
  { key: 'a round placement', x: 400, y: 320 },
  { key: 'a placement off the whole pixel', x: 401.3, y: 321.7 },
];

type Body = { key: string; value: string; width: number; lines: number };

/** Ascenders and descenders both, so a line's ink says where its baseline is. */
const WORD = 'Hxpg';

/** The syllable an ime hands over one jamo at a time while it is composing. */
const COMPOSING = '한';

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
function driftOf(before: number[], after: number[], scale: number): number {
  let best = { shift: 0, cost: Infinity };

  for (let shift = -scale * 3; shift <= scale * 3; shift++) {
    let cost = 0;
    for (let index = 0; index < before.length; index++) {
      cost += Math.abs(before[index] - (after[index + shift] ?? 0));
    }
    if (cost < best.cost) best = { shift, cost };
  }

  return best.shift / scale;
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
async function frameOf(erd: ErdEditorPage, zoomLevel: number, scale: number) {
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
      Math.round((CROP_MARGIN + line * advance) * scale),
      Math.round((CROP_MARGIN + (line + 1) * advance) * scale),
    ]);
  }

  return { clip, bands, lines };
}

/** How many lines the probe below lays out, so one box's rounding is divided away. */
const LEADING_PROBE_LINES = 10;

/** A body long enough that every box below clips it rather than showing it whole. */
const TALL_BODY = Array.from({ length: 24 }, () => WORD).join('\n');

/**
 * The whole device pixel the editor over a body longer than its box may sit
 * from it, either way. That textarea is a scroll container, and blink snaps a
 * scroller's contents to the device grid; a body that fits does not move.
 */
const SNAP_DRIFT_PX = 1;

/** What that snap moves the weight of a row band by, rounding included. */
const SNAP_ROW_PX = 1.1;

/** And of a column band, which the edge of the crop takes more weight over. */
const SNAP_COLUMN_PX = 1.3;

/** The box every overflow case below runs in, which its body is taller than. */
const LONG_BOX = { width: 220, height: 130 };

/** A body of numbered lines, so every line the author wrote reads apart. */
const NUMBERED_BODY = Array.from(
  { length: 24 },
  (_, line) => `${WORD}${line}`
).join('\n');

/** A body carrying no break of its own, so every line below is one the box folded. */
const FLOWING_BODY = Array.from(
  { length: 14 },
  () => 'the quick brown fox jumps over the lazy dog'
).join(' ');

type LongBody = {
  key: string;
  value: string;
  /** Whether the author's own breaks are what the body folds at. */
  authored: boolean;
};

const LONG_BODIES: LongBody[] = [
  { key: 'a body of numbered lines', value: NUMBERED_BODY, authored: true },
  { key: 'a body the box folds', value: FLOWING_BODY, authored: false },
];

type Reach = {
  key: string;
  /** Which of the lines the box shows the pointer lands on. */
  line: (shown: number) => number;
  /** How far across the body, in its own pixels rather than the screen's. */
  x: number;
};

const REACHES: Reach[] = [
  { key: 'the first line', line: () => 0, x: 4 },
  { key: 'a line in the middle', line: shown => Math.floor(shown / 2), x: 40 },
  { key: 'the last line the box shows', line: shown => shown - 1, x: 200 },
];

const longSeed = (
  value: string,
  zoomLevel: number,
  place: Place
): ErdDocument =>
  createSchema({
    zoomLevel,
    memos: [
      {
        id: MEMO_ID,
        value,
        x: place.x,
        y: place.y,
        ...LONG_BOX,
      },
    ],
  });

/** The lines the scene folded the body into, read off the node that drew them. */
async function drawnLinesOf(erd: ErdEditorPage): Promise<string[]> {
  const text = await erd.sceneAttr(
    [`#memo-${MEMO_ID}`, '.memo-textarea'],
    'text'
  );
  expect(typeof text, 'the scene draws a body to read the fold off').toBe(
    'string'
  );

  return (text as string).split('\n');
}

/**
 * Where each drawn line starts in the value the memo holds. A fold keeps every
 * character, so one line's own length is the whole step to the next, and a
 * break the author typed is the single character past it.
 */
function startsOf(value: string, lines: string[]): number[] {
  const starts: number[] = [];
  let at = 0;

  for (const line of lines) {
    starts.push(at);
    at += line.length;
    if (value[at] === '\n') at += 1;
  }

  return starts;
}

/**
 * The advance a real textarea of the memo's own face lays out, measured in the
 * page. The body was a textarea before the scene was a canvas, and it left the
 * leading to line-height normal, which is a number only the browser knows.
 */
async function textareaLeadingOf(erd: ErdEditorPage): Promise<number> {
  const body: SceneSelector = [`#memo-${MEMO_ID}`, '.memo-textarea'];
  const family = await erd.sceneAttr(body, 'fontFamily');
  const size = await erd.sceneAttr(body, 'fontSize');
  const weight = await erd.sceneAttr(body, 'fontStyle');
  const font = `${weight} ${size}px ${family}`;

  return erd.page.evaluate(
    ([shorthand, lines]: [string, number]) => {
      const area = document.createElement('textarea');
      area.style.cssText = `position:absolute;top:-10000px;left:0;width:220px;margin:0;padding:0;border:0;overflow:hidden;resize:none;box-sizing:border-box;font:${shorthand};white-space:pre-wrap`;
      area.value = Array.from({ length: lines }, () => 'Hxpg').join('\n');
      document.body.append(area);
      const advance = area.scrollHeight / lines;
      area.remove();

      return advance;
    },
    [font, LEADING_PROBE_LINES] as [string, number]
  );
}

/** The ascent and descent konva centres a drawn line by, read as konva reads them. */
async function canvasFontSumOf(erd: ErdEditorPage): Promise<number> {
  const body: SceneSelector = [`#memo-${MEMO_ID}`, '.memo-textarea'];
  const family = await erd.sceneAttr(body, 'fontFamily');
  const size = await erd.sceneAttr(body, 'fontSize');
  const weight = await erd.sceneAttr(body, 'fontStyle');
  const font = `${weight} ${size}px ${family}`;

  return erd.page.evaluate((shorthand: string) => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('no 2d context to measure the face with');
    context.font = shorthand;
    const metrics = context.measureText('M');

    return metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
  }, font);
}

for (const scale of SCALES) {
  test.describe(`read on ${scale} device pixels to a css pixel`, () => {
    test.use({ deviceScaleFactor: scale });

    /**
     * The editor is dom over a canvas, so nothing short of a measurement says
     * the two agree. Each case reads one crop twice, once with the scene
     * drawing the body and once with the textarea over it, for the same pixels.
     */
    test.describe('the memo body editor lands on the body it replaces', () => {
      for (const zoomLevel of ZOOM_LEVELS) {
        for (const place of PLACES) {
          test(`every body keeps its glyphs at zoom ${zoomLevel} on ${place.key}`, async ({
            erd,
          }) => {
            await quietenOverlay(erd.page);

            for (const body of BODIES) {
              const label = `${body.key} at ${place.key}`;
              await erd.seed(seed(zoomLevel, place, body));

              const { clip, bands, lines } = await frameOf(
                erd,
                zoomLevel,
                scale
              );
              expect(lines, `${label} folds into lines`).toBe(body.lines);

              const drawn = await profileOf(erd.page, clip, bands);
              expect(
                inkOf(drawn.rows),
                `${label} draws glyphs`
              ).toBeGreaterThan(1);

              await openEditor(erd);
              const edited = await profileOf(erd.page, clip, bands);
              await closeEditor(erd);
              await erd.hoverAway();

              bands.forEach(([from, to], line) => {
                const rowsBefore = drawn.rows.slice(from, to);
                const rowsAfter = edited.rows.slice(from, to);
                expect(
                  driftOf(rowsBefore, rowsAfter, scale),
                  `${label} line ${line} vertical drift`
                ).toBe(0);
                expect(
                  Math.abs(centroidOf(rowsAfter) - centroidOf(rowsBefore)) /
                    scale,
                  `${label} line ${line} sub pixel vertical drift`
                ).toBeLessThan(DRIFT_LIMIT_PX);

                expect(
                  driftOf(drawn.cols[line], edited.cols[line], scale),
                  `${label} line ${line} horizontal drift`
                ).toBe(0);
                expect(
                  Math.abs(
                    centroidOf(edited.cols[line]) - centroidOf(drawn.cols[line])
                  ) / scale,
                  `${label} line ${line} sub pixel horizontal drift`
                ).toBeLessThan(COLUMN_LIMIT_PX);
              });
            }
          });
        }
      }
    });

    /**
     * The scene folds a memo body by a leading of its own, and a browser
     * resolves line-height normal to a different number on each display. A
     * constant would be this suite's own answer, so the textarea is asked.
     */
    test('the scene folds a memo body by the leading a textarea of that face takes', async ({
      erd,
    }) => {
      await erd.seed(seed(1, PLACES[0], BODIES[0]));

      expect(await leadingOf(erd)).toBe(await textareaLeadingOf(erd));
    });

    /**
     * What the guard above is worth here. The canvas pair is the number the
     * leading was once taken from, and only on a display where the two part
     * can any assertion tell a leading read off the font from one laid out.
     */
    test('the canvas pair for that face parts from it on this display', async ({
      erd,
    }) => {
      await erd.seed(seed(1, PLACES[0], BODIES[0]));

      expect(await canvasFontSumOf(erd)).not.toBe(await textareaLeadingOf(erd));
    });

    /**
     * A memo clips its body to its own box, so the leading decides how many
     * lines a reader sees. The count is against the textarea's own leading,
     * because one line fewer per box was the visible half of the canvas pair.
     */
    test('a clipped memo body shows the lines its own leading fits in the box', async ({
      erd,
    }) => {
      await quietenOverlay(erd.page);

      for (const height of [130, 160, 260]) {
        await erd.seed(
          createSchema({
            zoomLevel: 1,
            memos: [
              {
                id: MEMO_ID,
                value: TALL_BODY,
                x: PLACES[0].x,
                y: PLACES[0].y,
                width: 220,
                height,
              },
            ],
          })
        );

        const leading = await textareaLeadingOf(erd);
        const box = await erd.sceneBox([
          `#memo-${MEMO_ID}`,
          '.memo-textarea-hit',
        ]);
        const { rows } = await profileOf(erd.page, box, []);

        let bands = 0;
        let inside = false;
        rows.forEach(row => {
          const ink = row > 0.5;
          if (ink && !inside) bands += 1;
          inside = ink;
        });

        expect(bands, `a ${height}px memo shows its lines`).toBe(
          Math.ceil(height / leading)
        );
      }
    });

    /**
     * A composition is text the editor holds but has not committed, drawn with
     * a decoration of its own. The glyphs already laid out are not part of it,
     * and a body that reflowed around one would move a line the caret is off.
     */
    test('a body composed through an ime holds the glyphs already laid out', async ({
      erd,
    }) => {
      await quietenOverlay(erd.page);
      await erd.seed(seed(1, PLACES[0], BODIES[0]));

      const box = await bodyBoxOf(erd);
      // Short of where the composition lands, which is past the end of the
      // value.
      const clip = {
        x: box.x - CROP_MARGIN,
        y: box.y - CROP_MARGIN,
        width: box.width + CROP_MARGIN - 1,
        height: box.height + CROP_MARGIN * 2,
      };
      const bands: Band[] = [[0, Math.round(clip.height * scale)]];

      const drawn = await profileOf(erd.page, clip, bands);

      await openEditor(erd);
      const session: CDPSession = await erd.page
        .context()
        .newCDPSession(erd.page);
      await session.send('Input.imeSetComposition', {
        text: COMPOSING,
        selectionStart: 0,
        selectionEnd: COMPOSING.length,
      });
      await expect(erd.memoEditor).toHaveValue(
        `${BODIES[0].value}${COMPOSING}`
      );

      const composing = await profileOf(erd.page, clip, bands);
      // Escape cancels a composition rather than the editor, so the browser has
      // to be done with this one before the editor will answer the key.
      await erd.endComposition(COMPOSING);
      await closeEditor(erd);

      expect(driftOf(drawn.rows, composing.rows, scale), 'vertical drift').toBe(
        0
      );
      expect(
        Math.abs(centroidOf(composing.rows) - centroidOf(drawn.rows)) / scale,
        'sub pixel vertical drift'
      ).toBeLessThan(DRIFT_LIMIT_PX);
      expect(
        driftOf(drawn.cols[0], composing.cols[0], scale),
        'horizontal drift'
      ).toBe(0);
      expect(
        Math.abs(centroidOf(composing.cols[0]) - centroidOf(drawn.cols[0])) /
          scale,
        'sub pixel horizontal drift'
      ).toBeLessThan(COLUMN_LIMIT_PX);
    });

    /**
     * The case a box that fits its body cannot reach. A caret the editor put
     * past the fold pulls the textarea down to reach it, and the scene behind
     * it draws from the first line and has no scroll to follow with.
     */
    test.describe('a body taller than the box it is edited in', () => {
      for (const zoomLevel of ZOOM_LEVELS) {
        for (const place of PLACES) {
          for (const body of LONG_BODIES) {
            test(`${body.key} opens under the pointer at zoom ${zoomLevel} on ${place.key}`, async ({
              erd,
            }) => {
              await quietenOverlay(erd.page);
              await erd.seed(longSeed(body.value, zoomLevel, place));

              const advance = (await leadingOf(erd)) * zoomLevel;
              const box = await erd.sceneBox([
                `#memo-${MEMO_ID}`,
                '.memo-textarea-hit',
              ]);
              const lines = await drawnLinesOf(erd);
              const starts = startsOf(body.value, lines);
              const shown = Math.floor(box.height / advance);
              expect(shown, `${body.key} runs past the box`).toBeLessThan(
                lines.length
              );

              const clip = {
                x: box.x - CROP_MARGIN,
                y: box.y - CROP_MARGIN,
                width: box.width + CROP_MARGIN * 2,
                height: box.height + CROP_MARGIN * 2,
              };
              const bands: Band[] = [];
              for (let line = 0; line < shown; line++) {
                bands.push([
                  Math.round((CROP_MARGIN + line * advance) * scale),
                  Math.round((CROP_MARGIN + (line + 1) * advance) * scale),
                ]);
              }
              const drawn = await profileOf(erd.page, clip, bands);
              expect(
                inkOf(drawn.rows),
                `${body.key} draws glyphs`
              ).toBeGreaterThan(1);

              for (const reach of REACHES) {
                const line = reach.line(shown);
                const label = `${body.key} on ${reach.key}`;
                expect(
                  reach.x,
                  `${reach.key} is a point inside the box`
                ).toBeLessThan(LONG_BOX.width);
                await erd.clickAt({
                  x: box.x + reach.x * zoomLevel,
                  y: box.y + line * advance + advance / 2,
                });
                await expect(erd.memoEditor).toBeFocused();

                const caret = await erd.memoEditor.evaluate(
                  (el: HTMLTextAreaElement) => ({
                    scrollTop: el.scrollTop,
                    selectionStart: el.selectionStart,
                  })
                );
                const edited = await profileOf(erd.page, clip, bands);
                await closeEditor(erd);
                await erd.hoverAway();

                bands.forEach(([from, to], shownLine) => {
                  const rowsBefore = drawn.rows.slice(from, to);
                  const rowsAfter = edited.rows.slice(from, to);
                  const at = `${label} line ${shownLine}`;
                  expect(
                    Math.abs(driftOf(rowsBefore, rowsAfter, scale)) * scale,
                    `${at} vertical drift`
                  ).toBeLessThanOrEqual(SNAP_DRIFT_PX);
                  expect(
                    Math.abs(centroidOf(rowsAfter) - centroidOf(rowsBefore)),
                    `${at} sub pixel vertical drift`
                  ).toBeLessThan(SNAP_ROW_PX);
                  expect(
                    Math.abs(
                      driftOf(
                        drawn.cols[shownLine],
                        edited.cols[shownLine],
                        scale
                      )
                    ) * scale,
                    `${at} horizontal drift`
                  ).toBeLessThanOrEqual(SNAP_DRIFT_PX);
                  expect(
                    Math.abs(
                      centroidOf(edited.cols[shownLine]) -
                        centroidOf(drawn.cols[shownLine])
                    ),
                    `${at} sub pixel horizontal drift`
                  ).toBeLessThan(SNAP_COLUMN_PX);
                });

                expect(
                  caret.scrollTop,
                  `${label} holds the box at the line the scene starts on`
                ).toBe(0);
                expect(
                  caret.selectionStart,
                  `${label} puts the caret no earlier than that line`
                ).toBeGreaterThanOrEqual(starts[line]);
                expect(
                  caret.selectionStart,
                  `${label} puts the caret no later than that line`
                ).toBeLessThanOrEqual(starts[line] + lines[line].length);
                if (body.authored) {
                  expect(
                    body.value.slice(0, caret.selectionStart).split('\n')
                      .length - 1,
                    `${label} puts the caret on the line the author wrote`
                  ).toBe(line);
                }
              }
            });
          }
        }
      }
    });
  });
}

/** Written out because a comment cannot show the character it names. */
const CARRIAGE_RETURN = String.fromCharCode(13);

type CaretBody = {
  key: string;
  value: string;
  /** The string a textarea holds for that body, which an offset indexes. */
  held: string;
  width: number;
};

const CARET_BODIES: CaretBody[] = [
  {
    key: 'a body the box has room under',
    value: 'hello',
    held: 'hello',
    width: 220,
  },
  {
    key: 'two lines the author wrote',
    value: ['first line here', 'second line here'].join('\n'),
    held: ['first line here', 'second line here'].join('\n'),
    width: 220,
  },
  {
    key: 'two lines of hangul',
    value: ['첫째 줄 한글입니다', '둘째 줄 한글입니다'].join('\n'),
    held: ['첫째 줄 한글입니다', '둘째 줄 한글입니다'].join('\n'),
    width: 220,
  },
  {
    key: 'a body the box folds',
    value: 'the quick brown fox jumps over the lazy dog once more',
    held: 'the quick brown fox jumps over the lazy dog once more',
    width: 130,
  },
  {
    key: 'a body stored with carriage returns',
    value: ['alpha', 'bravo', 'charlie'].join(CARRIAGE_RETURN + '\n'),
    held: ['alpha', 'bravo', 'charlie'].join('\n'),
    width: 220,
  },
];

const caretSeed = (
  body: CaretBody,
  zoomLevel: number,
  place: Place
): ErdDocument =>
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

/**
 * Both answers for one screen point: the offset the scene mapped a click to,
 * and the offset blink puts the caret at for the same point on the textarea now
 * over it. The second is what the body did before the scene became a canvas.
 */
async function caretPairAt(erd: ErdEditorPage, point: Point) {
  // An open editor covers the box, so the first click has to reach the scene
  // or both answers come back off the same textarea and always agree.
  if (await erd.memoEditor.count()) {
    await closeEditor(erd);
    await erd.hoverAway();
  }
  await erd.clickAt(point);
  await expect(erd.memoEditor).toBeFocused();
  const read = (el: HTMLTextAreaElement) => el.selectionStart;
  const mapped = await erd.memoEditor.evaluate(read);
  await erd.clickAt(point);
  const native = await erd.memoEditor.evaluate(read);

  return { mapped, native };
}

/**
 * A whole viewport pixel, which is the only x both answers read alike. Blink
 * hit tests a click at the coordinate it arrived on while a script is handed
 * that coordinate rounded, so a fractional point is answered from two numbers.
 */
const wholePoint = (x: number, y: number): Point => ({
  x: Math.round(x),
  y: Math.round(y),
});

/**
 * A canvas has no caret, so where a click leaves one is a decision this editor
 * makes rather than one the platform makes for it. Every case below asks blink
 * for the same point on a real textarea and holds the mapping to that answer.
 */
test.describe('the caret a click on a drawn memo body leaves', () => {
  for (const zoomLevel of ZOOM_LEVELS) {
    for (const place of PLACES) {
      test(`lands where a textarea would put it at zoom ${zoomLevel} on ${place.key}`, async ({
        erd,
      }) => {
        for (const body of CARET_BODIES) {
          await erd.seed(caretSeed(body, zoomLevel, place));

          const advance = (await leadingOf(erd)) * zoomLevel;
          const box = await erd.sceneBox([
            `#memo-${MEMO_ID}`,
            '.memo-textarea-hit',
          ]);
          const lines = await drawnLinesOf(erd);
          const starts = startsOf(body.held, lines);
          expect(
            (lines.length + 1) * advance,
            `${body.key} leaves the box room under it`
          ).toBeLessThan(box.height);

          const below = [
            wholePoint(box.x + 2, box.y + (lines.length + 0.5) * advance),
            wholePoint(box.x + box.width / 2, box.y + box.height - 2),
            wholePoint(box.x + box.width - 2, box.y + box.height - 2),
          ];
          for (const point of below) {
            const caret = await caretPairAt(erd, point);
            expect(
              caret.mapped,
              `${body.key} under the body at ${point.x}`
            ).toBe(caret.native);
            expect(
              caret.mapped,
              `${body.key} under the body takes the end`
            ).toBe(body.held.length);
          }

          for (const [line, text] of lines.entries()) {
            const y = box.y + line * advance + advance / 2;
            // Zoomed out, one screen pixel is two of the body's own, so the
            // nearest click to the left edge can be a glyph in and the offset
            // it lands on is blink's to say rather than this suite's.
            const left = await caretPairAt(erd, wholePoint(box.x + 1, y));
            expect(left.mapped, `${body.key} line ${line} left edge`).toBe(
              left.native
            );
            expect(
              left.mapped,
              `${body.key} line ${line} opens no earlier`
            ).toBeGreaterThanOrEqual(starts[line]);
            expect(
              left.mapped,
              `${body.key} line ${line} opens no later`
            ).toBeLessThanOrEqual(starts[line] + text.length);

            const right = await caretPairAt(
              erd,
              wholePoint(box.x + box.width - 2, y)
            );
            expect(right.mapped, `${body.key} line ${line} right edge`).toBe(
              right.native
            );
            expect(right.mapped, `${body.key} line ${line} ends`).toBe(
              starts[line] + text.length
            );
          }

          expect(
            await erd.memoEditor.inputValue(),
            `${body.key} reaches the editor as the element holds it`
          ).toBe(body.held);
          await closeEditor(erd);
          expect(
            (await erd.memo(MEMO_ID)).value,
            `${body.key} is not rewritten by a click`
          ).toBe(body.value);
          await erd.hoverAway();
        }
      });
    }
  }
});
