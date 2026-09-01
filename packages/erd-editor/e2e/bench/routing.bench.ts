import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { expect, test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import type { ErdDocument } from '../support/schema';
import { CORPORA, createCorpus } from './corpus';
import {
  fitWholeCanvas,
  measureQuality,
  readScene,
  type QualityMetrics,
} from './geometry';
import {
  installBench,
  runDragBench,
  VIEWPORT,
  type BenchResult,
} from './harness';

const OUT_DIR = join(import.meta.dirname, '..', '.bench');
const BASELINE = join(OUT_DIR, 'baseline.json');
const LATEST = join(OUT_DIR, 'latest.json');

type Row = {
  corpus: string;
  tables: number;
  relationships: number;
  columns: number;
  perf: BenchResult;
  /** Every connector, read off a second load at a zoom that culls none. */
  quality: QualityMetrics;
  /** The same read off the screen the drag left, which the canvas does cull. */
  onScreen: QualityMetrics;
};

/**
 * Bumped whenever a metric changes what it means rather than what it measures,
 * which suppresses deltas across the bump. Otherwise a stale baseline prints
 * percentages against numbers that are no longer the same quantity.
 */
const METRICS_VERSION = 3;

type Report = {
  label: string;
  createdAt: string;
  /** Absent on reports written before versioning — treated as version 1. */
  metricsVersion?: number;
  rows: Row[];
};

const rows: Row[] = [];

test.describe.configure({ mode: 'serial' });

for (const options of CORPORA) {
  test(`routing bench — ${options.name}`, async ({ page }) => {
    // Each corpus gets a fresh page: the harness holds a MessageChannel and a
    // MutationObserver, and the editor keeps a store per mount.
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus(options);
    const perf = await runDragBench(page, corpus.document, {
      // The hub is the worst case for anchor crowding and the most sensitive
      // target for a routing change.
      tableId: corpus.hubTableId,
      moves: 120,
    });

    const onScreen = measureQuality(await readScene(page));

    // Quality is read from a second load rather than off the drag: the scene
    // culls, and the dom scene it is compared against did not. A zoom where
    // three screens hold the whole canvas is what leaves nothing culled.
    const dragged = JSON.parse(
      await page.evaluate(
        () =>
          (
            document.querySelector('erd-editor') as HTMLElement & {
              value: string;
            }
          ).value
      )
    ) as ErdDocument;

    // The corpus as generated, with the tables where the drag left them. What
    // the editor serialised would not do: it carries measured column widths,
    // and a document already measured is sorted a different number of times.
    const whole = JSON.parse(JSON.stringify(corpus.document)) as ErdDocument;
    for (const id of whole.doc.tableIds) {
      const { ui } = dragged.collections.tableEntities[id];
      whole.collections.tableEntities[id].ui.x = ui.x;
      whole.collections.tableEntities[id].ui.y = ui.y;
    }
    Object.assign(whole.settings, fitWholeCanvas(whole.settings, VIEWPORT));

    await page.goto(FIXTURE_URL);
    await installBench(page);
    await page.evaluate(
      json => window.__erdBench!.load(json),
      JSON.stringify(whole)
    );

    const quality = measureQuality(await readScene(page));
    // The point of the second load. A short read is a culled one, and every
    // number under it would be a fraction of the document rather than all of it.
    expect(quality.drawn).toBe(quality.total);

    rows.push({
      corpus: corpus.name,
      tables: corpus.tables,
      relationships: corpus.relationships,
      columns: corpus.columns,
      perf,
      quality,
      onScreen,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;

  const report: Report = {
    label: process.env.E2E_BENCH_LABEL ?? 'unlabelled',
    createdAt: new Date().toISOString(),
    metricsVersion: METRICS_VERSION,
    rows,
  };

  mkdirSync(dirname(LATEST), { recursive: true });
  writeFileSync(LATEST, `${JSON.stringify(report, null, 2)}\n`);
  if (process.env.E2E_BENCH_BASELINE) {
    writeFileSync(BASELINE, `${JSON.stringify(report, null, 2)}\n`);
  }

  const baseline = readBaseline();
  print(report, baseline);
});

function readBaseline(): Report | null {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8')) as Report;
  } catch {
    return null;
  }
}

// ── reporting ───────────────────────────────────────────────────────────────

const ms = (value: number) => `${value.toFixed(2)}ms`;
const num = (value: number) => `${value}`;

/** Printed where a delta would be, when the two rows counted different sets. */
const POPULATION_MISMATCH = '≠pop';

function delta(
  current: number,
  previous: number | undefined,
  lowerIsBetter = true
) {
  if (previous === undefined || previous === 0) return '';
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return '  ·';
  const better = lowerIsBetter ? change < 0 : change > 0;
  const sign = change > 0 ? '+' : '';
  return `${better ? '▼' : '▲'} ${sign}${change.toFixed(0)}%`;
}

function table(headers: string[], body: string[][]) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map(row => (row[index] ?? '').length))
  );
  const line = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join('  ');
  return [
    line(headers),
    widths.map(width => '─'.repeat(width)).join('  '),
    ...body.map(line),
  ].join('\n');
}

function print(report: Report, saved: Report | null) {
  // A baseline from an older metrics version is kept on disk but not compared
  // against: a percentage between two different definitions is worse than no
  // percentage, because it reads exactly like a result.
  const stale = !!saved && (saved.metricsVersion ?? 1) !== METRICS_VERSION;
  const baseline = stale ? null : saved;
  const previous = new Map(baseline?.rows.map(row => [row.corpus, row]) ?? []);

  const header = stale
    ? `\nrouting bench — ${report.label}  (baseline "${saved!.label}" is metrics v${saved!.metricsVersion ?? 1}, this run is v${METRICS_VERSION} — no deltas; re-record with E2E_BENCH_BASELINE=1)`
    : baseline
      ? `\nrouting bench — ${report.label}  (vs baseline "${baseline.label}")`
      : `\nrouting bench — ${report.label}  (no baseline saved)`;

  const perfRows = report.rows.map(row => {
    const old = previous.get(row.corpus);
    return [
      row.corpus,
      `${row.tables}T/${row.relationships}R/${row.columns}C`,
      ms(row.perf.loadMs),
      delta(row.perf.loadMs, old?.perf.loadMs),
      // A clamped run means drag blocking came in under the idle floor, so the
      // difference is noise and the number above it means nothing.
      `${ms(row.perf.busyMsPerMove)}${row.perf.busyRaw.clamped ? '!' : ''}`,
      delta(row.perf.busyMsPerMove, old?.perf.busyMsPerMove),
      `${(row.perf.utilization * 100).toFixed(0)}%`,
      ms(row.perf.frameIdle.p50),
      ms(row.perf.frame.p50),
      delta(row.perf.frame.p50, old?.perf.frame.p50),
      ms(row.perf.frame.p95),
      row.perf.attrWrites.perMove.toFixed(1),
      delta(row.perf.attrWrites.perMove, old?.perf.attrWrites.perMove),
      `${row.perf.fanOut.p50.toFixed(0)}/${row.relationships}`,
      delta(row.perf.fanOut.p50, old?.perf.fanOut.p50),
      row.perf.flipsPerMove.toFixed(2),
      delta(row.perf.flipsPerMove, old?.perf.flipsPerMove),
    ];
  });

  // A baseline row read off a culled scene counted a different set of
  // connectors, and a percentage between two populations reads exactly like a
  // result. Its deltas are replaced by the marker rather than printed.
  const wholeDocument = (metrics: QualityMetrics) => {
    const { drawn, total } = metrics as Partial<QualityMetrics>;
    return drawn === undefined || drawn === total;
  };

  const qualityRows = report.rows.map(row => {
    const old = previous.get(row.corpus);
    const change = (current: number, previousValue: number | undefined) =>
      old && !wholeDocument(old.quality)
        ? POPULATION_MISMATCH
        : delta(current, previousValue);

    return [
      row.corpus,
      num(row.quality.segments),
      num(row.quality.crossingsShared),
      change(row.quality.crossingsShared, old?.quality.crossingsShared),
      num(row.quality.crossingsFree),
      change(row.quality.crossingsFree, old?.quality.crossingsFree),
      num(row.quality.nodeCrossings),
      change(row.quality.nodeCrossings, old?.quality.nodeCrossings),
      num(row.quality.collinearOverlapPx),
      change(row.quality.collinearOverlapPx, old?.quality.collinearOverlapPx),
      Number.isFinite(row.quality.minAnchorPitch)
        ? row.quality.minAnchorPitch.toFixed(1)
        : 'n/a',
      num(row.quality.totalLengthPx),
      `${row.onScreen.drawn}/${row.onScreen.total}`,
      num(row.onScreen.segments),
      row.quality.worstCollinear
        ? `${row.quality.worstCollinear.length}px ${row.quality.worstCollinear.axis[0]} ${row.quality.worstCollinear.aEnds} vs ${row.quality.worstCollinear.bEnds}`
        : '—',
    ];
  });

  const unknownPopulation = report.rows.some(row => {
    const old = previous.get(row.corpus);
    return (
      !!old && (old.quality as Partial<QualityMetrics>).drawn === undefined
    );
  });

  process.stdout.write(
    [
      header,
      '',
      'performance   (busy/move = main-thread blocking above idle, "!" = clamped and meaningless; util = its share of one frame; fan-out = relationships redrawn per move)',
      table(
        [
          'corpus',
          'size',
          'load',
          'Δ',
          'busy/move',
          'Δ',
          'util',
          'idle p50',
          'frame p50',
          'Δ',
          'frame p95',
          'attr/move',
          'Δ',
          'fan-out',
          'Δ',
          'flips/move',
          'Δ',
        ],
        perfRows
      ),
      '',
      'quality   (every connector, off a second load of the corpus with the tables where the drag left them, at a zoom that culls nothing; cross-shared = same table, cross-free = independent pairs; collinear = length two connectors run within one stroke width of each other)',
      '          (routing depends on the run of sorts a layout was reached by, so this lands within a percent or two of the scene the drag ended on rather than on it)',
      `          (on screen = the population that drag left drawn, and its segment count — a culled subset, never compared with anything${
        unknownPopulation
          ? '; the baseline predates these two columns, so what it counted is on its own record'
          : ''
      })`,
      table(
        [
          'corpus',
          'segs',
          'cross-shared',
          'Δ',
          'cross-free',
          'Δ',
          'node-cross',
          'Δ',
          'collinear px',
          'Δ',
          'min pitch',
          'length px',
          'on screen',
          'screen segs',
          'worst collinear',
        ],
        qualityRows
      ),
      '',
      ...report.rows
        .filter(row => row.quality.worstCollinear)
        .map(
          row =>
            `worst ${row.corpus}: ${row.quality.worstCollinear!.a} ${row.quality.worstCollinear!.aPath}\n` +
            `      ${' '.repeat(row.corpus.length)}${row.quality.worstCollinear!.b} ${row.quality.worstCollinear!.bPath}`
        ),
      '',
      `written: ${LATEST}`,
      process.env.E2E_BENCH_BASELINE ? `baseline: ${BASELINE}` : '',
      '',
    ]
      .filter(Boolean)
      .join('\n')
  );
}
