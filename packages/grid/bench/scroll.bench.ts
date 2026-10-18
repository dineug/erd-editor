// A million-row grid's scene under the three ways a frame is asked to show new
// cells, against an idle control. It reports and judges nothing: no baseline
// is read or written, and no number fails the run.

import { expect, type Page, test } from '@playwright/test';

import type { FirstDraw, FrameSample, Scenario } from '../src/index.dev';

/** Animation frames each scenario steps through; E2E_BENCH_FRAMES moves it. */
const FRAMES = Number(process.env.E2E_BENCH_FRAMES) || 300;

/** Frames of small steps run first and thrown away, so the reported ones meet warm code. */
const WARM_UP_FRAMES = 60;

/** How far one small step scrolls, in the DOM pixels a wheel notch moves the scroller. */
const STEP_DOM_PX = 100;

const JUMP_SEED = 20_261_018;

const REMOUNTS = 5;

/** The frame work a scroll must stay under, and the first draw's. */
const FRAME_BUDGET_MS = 16;

const FIRST_DRAW_BUDGET_MS = 100;

interface Summary {
  p50: number;
  p95: number;
  max: number;
}

function summarize(values: number[]): Summary {
  if (!values.length) return { p50: 0, p95: 0, max: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

  return { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

const workOf = (sample: FrameSample) =>
  sample.drawMs + sample.scrollMs + sample.flushMs;

function gaps(samples: FrameSample[]): number[] {
  const found: number[] = [];
  for (let index = 1; index < samples.length; index++) {
    found.push(samples[index].time - samples[index - 1].time);
  }

  return found;
}

/**
 * The share of display frames that ran no animation frame callback: a gap of
 * n frame periods between two callbacks skipped n - 1 of them, the period
 * being the idle control's median gap.
 */
function missedRatio(samples: FrameSample[], periodMs: number): number {
  let missed = 0;
  let ran = 0;

  for (const gap of gaps(samples)) {
    missed += Math.max(0, Math.round(gap / periodMs) - 1);
    ran++;
  }

  return ran ? missed / (missed + ran) : 0;
}

/**
 * Serves the page cross-origin isolated, which narrows performance.now from
 * 100 microseconds to 5, a step the scroll handler's span would round to.
 */
async function isolate(page: Page) {
  await page.route('**/index.html*', async route => {
    const response = await route.fetch();

    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      },
    });
  });
}

const run = (page: Page, scenario: Scenario, frames: number) =>
  page.evaluate(
    ([scenario, frames]) => window.__gridBench!.run(scenario, frames),
    [scenario, frames] as const
  );

const toTop = (page: Page) =>
  page.evaluate(() => window.__gridBench!.jumpToRow(0));

const ms = (value: number) => value.toFixed(2).padStart(7);

const percent = (value: number) => `${(value * 100).toFixed(1)}%`.padStart(7);

const verdict = (pass: boolean) => (pass ? 'yes' : 'NO');

function firstDrawLine(label: string, draw: FirstDraw) {
  return `${label}: ${draw.wallMs.toFixed(1)} ms to the frame after the first whenDrawn (work ${draw.workMs.toFixed(1)} ms, ${draw.cells} cells); within ${FIRST_DRAW_BUDGET_MS} ms: ${verdict(draw.wallMs <= FIRST_DRAW_BUDGET_MS)}`;
}

test('a million-row scene keeps each frame under budget', async ({ page }) => {
  await isolate(page);
  await page.goto('/index.html?bench');
  await page.waitForFunction(() => Boolean(window.__gridBench?.firstDraw));

  const cold = await page.evaluate(() => window.__gridBench!.firstDraw!);
  const info = await page.evaluate(() => window.__gridBench!.info());

  await run(page, { kind: 'step', domPx: STEP_DOM_PX }, WARM_UP_FRAMES);
  await toTop(page);

  const idle = await run(page, { kind: 'idle' }, FRAMES);
  const steps = await run(page, { kind: 'step', domPx: STEP_DOM_PX }, FRAMES);
  await toTop(page);
  const jumps = await run(page, { kind: 'jump', seed: JUMP_SEED }, FRAMES);
  await toTop(page);
  const versions = await run(page, { kind: 'version' }, FRAMES);

  const warm: FirstDraw[] = [];
  for (let index = 0; index < REMOUNTS; index++) {
    warm.push(await page.evaluate(() => window.__gridBench!.remount()));
  }

  const period = summarize(gaps(idle)).p50;
  const idleMissed = missedRatio(idle, period);
  const rows: Array<[string, FrameSample[]]> = [
    ['idle control', idle],
    [`small steps, ${STEP_DOM_PX} DOM px`, steps],
    ['random jumps', jumps],
    ['version bump', versions],
  ];
  const header = [
    'scenario'.padEnd(26),
    'frames',
    ' p50 ms',
    ' p95 ms',
    ' max ms',
    'draw p95',
    'scroll p95',
    'flush p95',
    'cells/frame',
    ' missed',
    'vs idle',
    `p95 <= ${FRAME_BUDGET_MS} ms`,
  ].join('  ');
  const lines = rows.map(([label, samples]) => {
    const work = summarize(samples.map(workOf));
    const drawing = samples.filter(sample => sample.cells > 0);
    const missed = missedRatio(samples, period);

    return [
      label.padEnd(26),
      String(samples.length).padStart(6),
      ms(work.p50),
      ms(work.p95),
      ms(work.max),
      ms(summarize(samples.map(sample => sample.drawMs)).p95).padStart(8),
      ms(summarize(samples.map(sample => sample.scrollMs)).p95).padStart(10),
      ms(summarize(samples.map(sample => sample.flushMs)).p95).padStart(9),
      String(summarize(drawing.map(sample => sample.cells)).p50).padStart(11),
      percent(missed),
      `${((missed - idleMissed) * 100).toFixed(1)} pt`.padStart(7),
      verdict(work.p95 <= FRAME_BUDGET_MS),
    ].join('  ');
  });
  const warmWall = summarize(warm.map(draw => draw.wallMs)).p50;
  const warmWork = summarize(warm.map(draw => draw.workMs)).p50;

  console.log(
    [
      '',
      `Grid scroll bench: ${info.rowCount.toLocaleString('en-US')} rows x ${info.columnCount} columns on a ${info.width}x${info.height} stage, devicePixelRatio ${info.devicePixelRatio}, canvas pixel ratio ${info.canvasPixelRatio}, ${info.visibleCells} cells in view`,
      'Frame work is the konva layer draws (the scene canvas and the hit canvas sync, each clear included), the scroll handler and the commit flush, summed per animation frame.',
      `Style, layout and raster time are not included. The page is ${info.isolated ? '' : 'not '}cross-origin isolated, so performance.now steps by ${info.isolated ? '5 microseconds' : '100 microseconds'}.`,
      `A small step goes through the scroll mapping: ${STEP_DOM_PX} DOM px is ${(STEP_DOM_PX * info.scrollRatio).toFixed(0)} content px (ratio ${info.scrollRatio}). A jump lands on a random row and scrollLeft every frame; a version bump changes every string in view every frame.`,
      'The page has no pointer input, so no scrollbar thumb drag is measured.',
      '',
      firstDrawLine('First draw, cold', cold),
      `First draw, warm remount (p50 of ${REMOUNTS}): ${warmWall.toFixed(1)} ms (work ${warmWork.toFixed(1)} ms); within ${FIRST_DRAW_BUDGET_MS} ms: ${verdict(warmWall <= FIRST_DRAW_BUDGET_MS)}`,
      '',
      header,
      ...lines,
      '',
      `missed: the share of display frames with no animation frame callback, at the idle control's frame period of ${period.toFixed(2)} ms; vs idle: that share less the idle control's.`,
      '',
    ].join('\n')
  );

  expect(cold.cells).toBeGreaterThan(0);
  for (const [, samples] of rows.slice(1)) {
    expect(samples.some(sample => sample.cells > 0)).toBe(true);
  }
});
