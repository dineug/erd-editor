import { expect, test } from '../support/fixtures';

import type { CssPage } from '../support/CssPage';

/**
 * Q4 — what is the append fast path actually worth in a real engine?
 *
 * In happy-dom the largest batch went 5.01ms -> 1.77ms, but happy-dom models no
 * style invalidation at all: reassigning `adoptedStyleSheets` there is an array
 * write and nothing else. In Chromium every mutation dirties the shadow tree, and
 * that could push the number either way — reassignment could be far worse than
 * happy-dom suggested, or `replaceSync` parsing could swamp the whole difference.
 *
 * This file measures and prints. It deliberately does **not** assert milliseconds:
 * a wall-clock threshold on a shared CI runner fails for reasons that have nothing
 * to do with this repository, and a perf test that cries wolf gets ignored, which
 * is worse than not having one. The only assertion is on the *shape* — cost per
 * template must stay flat as the batch grows, because that is the property the
 * fast path exists to provide and the one a regression would destroy. Quadratic
 * accumulation over an 8x range shows up as 8x per-template growth; the guard
 * trips at 3x.
 *
 * Numbers are wall time from inside the page. `performance.now()` is coarsened to
 * 100µs, so the smallest batch carries the most quantization error — read the
 * table, not the last digit.
 */

const BATCHES = [100, 200, 400, 800] as const;
/** Quadratic over BATCHES would be ~8x. Linear is ~1x. */
const GROWTH_LIMIT = 3;
/**
 * Each batch is measured this many times and the **fastest** run is kept. A
 * descheduled worker or a GC pause can only ever make a run slower, so the minimum
 * is the sample least contaminated by the machine — and taking it is what stops
 * the shape guard from failing on a busy CI box. It does not weaken the guard: the
 * batches are run in ascending order, so the largest one is still measured with
 * the most templates already registered, which is where superlinear accumulation
 * would show up.
 */
const REPEATS = 3;

type Row = { label: string; count: number; ms: number };

async function fastestOf(run: () => Promise<number>): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < REPEATS; i++) best = Math.min(best, await run());
  return best;
}

function table(title: string, rows: Row[]): string {
  const header = `${title}\n${'-'.repeat(title.length)}`;
  const base = rows[0] ? rows[0].ms / rows[0].count : 0;
  const body = rows.map(({ label, count, ms }) => {
    const per = ms / count;
    return [
      label.padStart(22),
      String(count).padStart(6),
      ms.toFixed(2).padStart(9),
      (per * 1000).toFixed(2).padStart(11),
      `${base ? (per / base).toFixed(2) : '-'}x`.padStart(9),
    ].join(' | ');
  });

  return [
    header,
    [
      'path'.padStart(22),
      'count'.padStart(6),
      'total ms'.padStart(9),
      'µs each'.padStart(11),
      'vs first'.padStart(9),
    ].join(' | '),
    ...body,
    `(fastest of ${REPEATS}; performance.now() is coarsened to 100µs, so the ` +
      'smallest batch carries the most error)',
  ].join('\n');
}

async function report(title: string, rows: Row[]) {
  const rendered = table(title, rows);
  console.log(`\n${rendered}\n`);
  await test
    .info()
    .attach(title, { body: rendered, contentType: 'text/plain' });
}

/** Per-template µs, which is the quantity the shape guard is about. */
const perItem = (row: Row) => (row.ms / row.count) * 1000;

async function guardFlatCost(title: string, rows: Row[]) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const growth = perItem(last) / perItem(first);

  expect(
    growth,
    `${title}: cost per item grew ${growth.toFixed(2)}x between ${first.count} ` +
      `and ${last.count} items (${perItem(first).toFixed(2)}µs -> ` +
      `${perItem(last).toFixed(2)}µs each). Flat is the whole point of the append ` +
      'fast path — growth on this scale means a registration is walking the ' +
      'accumulated list again, i.e. something is rebuilding where it used to ' +
      'append. This guards the shape, not the wall clock; the absolute numbers ' +
      'in the table above are a report, not a budget.'
  ).toBeLessThan(GROWTH_LIMIT);
}

async function mountHosts(cssPage: CssPage, total: number) {
  const existing = (await cssPage.hostIds()).length;
  for (let i = existing; i < total; i++) await cssPage.mountHost();
}

// Serial within this file so the two measurements are not competing with each
// other for the same core. Other spec files still run alongside, which is part of
// why these numbers are reported rather than asserted.
test.describe.configure({ mode: 'serial' });

test.describe('registration cost', () => {
  for (const hosts of [1, 8]) {
    test(`stays flat per template as the batch grows — ${hosts} host(s)`, async ({
      cssPage,
    }) => {
      test.setTimeout(120_000);
      await mountHosts(cssPage, hosts);

      // Warm up the JIT and the first-registration rebuild, neither of which is
      // proportional to anything and both of which land entirely in the first
      // batch otherwise.
      await cssPage.benchmarkRegister(100);

      const rows: Row[] = [];
      for (const count of BATCHES) {
        rows.push({
          label: 'css() registration',
          count,
          ms: await fastestOf(() => cssPage.benchmarkRegister(count)),
        });
      }

      const title = `registration through css() — ${hosts} host(s)`;
      await report(title, rows);
      await guardFlatCost(title, rows);
    });
  }

  test('the adopt call alone: push against reassign', async ({ cssPage }) => {
    test.setTimeout(180_000);
    await mountHosts(cssPage, 8);

    // The control. `benchmarkRegister` measures compile + hash + replaceSync +
    // adopt together, so the adopt term is not separable from it — and the
    // question is precisely whether the parsing swamps the constant. This runs the
    // same number of pre-built sheets onto the same mounted hosts through the raw
    // platform call, which isolates the one line the fast path changed.
    //
    // `flush` decides whether the style recalc each mutation invalidated is paid
    // inside the window. Real startup registers in a burst and recalculates once,
    // which is the unflushed row; flushing every iteration is the pessimistic
    // bound where every registration is immediately observed.
    const rows: Row[] = [];
    await cssPage.benchmarkAdopt({ count: 100, mode: 'push' });

    for (const mode of ['push', 'reassign'] as const) {
      for (const flush of [false, true]) {
        for (const count of BATCHES) {
          rows.push({
            label: `${mode} ${flush ? '+ forced recalc' : '(deferred recalc)'}`,
            count,
            ms: await fastestOf(() =>
              cssPage.benchmarkAdopt({ count, mode, flush })
            ),
          });
        }
      }
    }

    await report('adoptedStyleSheets mutation — 8 hosts', rows);

    const pushRows = rows.filter(row => row.label === 'push (deferred recalc)');
    const reassignRows = rows.filter(
      row => row.label === 'reassign (deferred recalc)'
    );

    // Reported, never asserted: how much reassignment costs is a fact about
    // Chromium's invalidation, and pinning it would make this file fail when
    // Chromium improves.
    const ratios = pushRows.map(
      (push, index) =>
        `${push.count}: ${(reassignRows[index].ms / push.ms).toFixed(1)}x`
    );
    console.log(`\nreassign / push, deferred recalc — ${ratios.join(', ')}\n`);

    // The fast path's own shape is fair game, because that is ours.
    await guardFlatCost('push (deferred recalc)', pushRows);
  });
});
