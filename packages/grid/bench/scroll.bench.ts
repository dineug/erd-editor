// A million-row Grid, driven through its component the four ways a frame is
// asked to show new cells, against an idle control. It reports and judges
// nothing: no baseline is read or written, and no number fails the run.

import { expect, type Page, test } from '@playwright/test';

import type { FirstDraw, FrameSample, Scenario } from '../src/index.dev';

/** Frames, or input steps, each scenario runs; E2E_BENCH_FRAMES moves it. */
const FRAMES = Number(process.env.E2E_BENCH_FRAMES) || 300;

/** Wheel steps run first and thrown away, so the reported frames meet warm code. */
const WARM_UP_STEPS = 60;

/** One wheel notch, in the DOM pixels a mouse wheel asks the scroller for. */
const WHEEL_DELTA_PX = 100;

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
  sample.drawMs + sample.eventMs + sample.stepMs + sample.flushMs;

/** A frame that drew, handled input or ran a step; the frames a scenario is judged on. */
const busy = (sample: FrameSample) =>
  sample.draws > 0 || sample.events > 0 || sample.stepMs > 0;

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
 * 100 microseconds to 5, a step an event handler's span would round to.
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

const toTop = (page: Page) => page.evaluate(() => window.__gridBench!.toTop());

const nextFrame = (page: Page) =>
  page.evaluate(() => window.__gridBench!.nextFrame());

/** Samples every frame while the input the drive sends through Playwright reaches the page. */
async function recorded(
  page: Page,
  drive: () => Promise<void>
): Promise<FrameSample[]> {
  await page.evaluate(() => window.__gridBench!.record());
  await drive();

  return page.evaluate(() => window.__gridBench!.stop());
}

/** Turns the wheel over the cells, one notch and then one frame at a time, on the real scroller. */
async function wheel(page: Page, steps: number) {
  const point = await page.evaluate(() => window.__gridBench!.bodyPoint());
  await page.mouse.move(point.x, point.y);

  for (let index = 0; index < steps; index++) {
    await page.mouse.wheel(0, WHEEL_DELTA_PX);
    await nextFrame(page);
  }
}

/** Presses the vertical thumb and drags it to the end of its track, a frame between moves. */
async function dragThumb(page: Page, steps: number) {
  const thumb = await page.evaluate(() => window.__gridBench!.thumb());
  await page.mouse.move(thumb.x, thumb.y);
  await page.mouse.down();

  for (let index = 1; index <= steps; index++) {
    await page.mouse.move(
      thumb.x,
      thumb.y + ((thumb.end - thumb.y) * index) / steps
    );
    await nextFrame(page);
  }
  await page.mouse.up();
}

const ms = (value: number) => value.toFixed(2).padStart(7);

const percent = (value: number) => `${(value * 100).toFixed(1)}%`.padStart(7);

const verdict = (pass: boolean) => (pass ? 'yes' : 'NO');

function firstDrawLine(label: string, draw: FirstDraw) {
  return `${label}: ${draw.wallMs.toFixed(1)} ms from the Grid's render to the frame after its first whenDrawn (work ${draw.workMs.toFixed(1)} ms, ${draw.cells} cells); within ${FIRST_DRAW_BUDGET_MS} ms: ${verdict(draw.wallMs <= FIRST_DRAW_BUDGET_MS)}`;
}

test('reports the frame work of a million-row Grid', async ({ page }) => {
  await isolate(page);
  await page.goto('/index.html?bench');
  await page.waitForFunction(() => Boolean(window.__gridBench?.firstDraw));

  const cold = await page.evaluate(() => window.__gridBench!.firstDraw!);
  const info = await page.evaluate(() => window.__gridBench!.info());

  await wheel(page, WARM_UP_STEPS);
  await toTop(page);

  const idle = await run(page, { kind: 'idle' }, FRAMES);

  const wheels = await recorded(page, () => wheel(page, FRAMES));
  const wheeled = await page.evaluate(() => window.__gridBench!.info());
  await toTop(page);

  const jumps = await run(page, { kind: 'jump', seed: JUMP_SEED }, FRAMES);
  await toTop(page);

  const drags = await recorded(page, () => dragThumb(page, FRAMES));
  const dragged = await page.evaluate(() => window.__gridBench!.viewport());
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
    [`wheel, ${WHEEL_DELTA_PX} px a notch`, wheels],
    ['random jumps, scrollTo', jumps],
    ['thumb drag to the end', drags],
    ['version bump', versions],
  ];
  const header = [
    'scenario'.padEnd(24),
    ' frames',
    '  busy',
    ' p50 ms',
    ' p95 ms',
    ' max ms',
    'draw p95',
    'event p95',
    'step p95',
    'flush p95',
    'cells/frame',
    ' missed',
    'vs idle',
    `p95 <= ${FRAME_BUDGET_MS} ms`,
  ].join('  ');
  const lines = rows.map(([label, samples]) => {
    const judged = samples.filter(busy);
    const frames = judged.length ? judged : samples;
    const work = summarize(frames.map(workOf));
    const drawing = samples.filter(sample => sample.cells > 0);
    const missed = missedRatio(samples, period);
    const p95 = (pick: (sample: FrameSample) => number) =>
      ms(summarize(frames.map(pick)).p95);

    return [
      label.padEnd(24),
      String(samples.length).padStart(7),
      String(judged.length).padStart(6),
      ms(work.p50),
      ms(work.p95),
      ms(work.max),
      p95(sample => sample.drawMs).padStart(8),
      p95(sample => sample.eventMs).padStart(9),
      p95(sample => sample.stepMs).padStart(8),
      p95(sample => sample.flushMs).padStart(9),
      String(summarize(drawing.map(sample => sample.cells)).p50).padStart(11),
      percent(missed),
      `${((missed - idleMissed) * 100).toFixed(1)} pt`.padStart(7),
      verdict(work.p95 <= FRAME_BUDGET_MS),
    ].join('  ');
  });
  const warmWall = summarize(warm.map(draw => draw.wallMs)).p50;
  const warmWork = summarize(warm.map(draw => draw.workMs)).p50;
  const notch = (wheeled.scrollTop / FRAMES).toFixed(1);

  console.log(
    [
      '',
      `Grid bench: ${info.rowCount.toLocaleString('en-US')} rows x ${info.columnCount} columns in a ${info.width}x${info.height} container, devicePixelRatio ${info.devicePixelRatio}, canvas pixel ratio ${info.canvasPixelRatio}, ${info.visibleCells} cells in view`,
      'Frame work is the konva layer draws (the scene canvas and the hit canvas sync, each clear included), the scroller events the Grid handles with the drain and commit after each, and the page step with its flush, summed per animation frame.',
      `Style, layout and raster time are not included. The page is ${info.isolated ? '' : 'not '}cross-origin isolated, so performance.now steps by ${info.isolated ? '5 microseconds' : '100 microseconds'}.`,
      `The wheel turns over the cells through Playwright, a notch and then a wait for the next frame, ${FRAMES} times; the scroller moved ${notch} DOM px a notch, ${(Number(notch) * info.scrollRatio).toFixed(0)} content px (ratio ${info.scrollRatio}). A jump calls the handle's scrollTo on a random cell every frame. The thumb drag presses the vertical thumb and moves the pointer to the track's end in ${FRAMES} moves, a frame between them, ending at row ${dragged ? dragged.rowEnd + 1 : '?'} of ${info.rowCount.toLocaleString('en-US')}. A version bump every frame leaves the measure cache holding none of the strings in view.`,
      'p50, p95 and max are over the busy frames, those that drew, handled input or ran a step.',
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
  expect(wheeled.scrollTop).toBeGreaterThan(0);
  expect(dragged?.rowEnd).toBe(info.rowCount - 1);
  for (const [, samples] of rows.slice(1)) {
    expect(samples.some(sample => sample.cells > 0)).toBe(true);
  }
});
