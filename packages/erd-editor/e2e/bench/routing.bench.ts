import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { CORPORA, createCorpus } from './corpus';
import { measureQuality, readScene, type QualityMetrics } from './geometry';
import { installBench, runDragBench, type BenchResult } from './harness';

/**
 * The routing benchmark.
 *
 * Not a spec — it asserts nothing and gates nothing. It runs on demand
 * (`pnpm --filter @dineug/erd-editor e2e:bench`), never in CI, because a
 * runner's noise floor is larger than the differences it is meant to resolve.
 *
 *   E2E_BENCH_LABEL=phase-1   name the run in the report
 *   E2E_BENCH_BASELINE=1      save this run as the comparison baseline
 *
 * Each corpus is measured twice over: `perf` is what a drag costs, `quality` is
 * how much the drawing overlaps. Both have to be read together — cutting frame
 * cost by drawing worse is not an improvement, and neither is the reverse.
 */

const OUT_DIR = join(import.meta.dirname, '..', '.bench');
const BASELINE = join(OUT_DIR, 'baseline.json');
const LATEST = join(OUT_DIR, 'latest.json');

type Row = {
  corpus: string;
  tables: number;
  relationships: number;
  columns: number;
  perf: BenchResult;
  quality: QualityMetrics;
};

/**
 * Bumped whenever a metric changes what it means rather than what it measures.
 *
 * Deltas are suppressed across a bump. The alternative is what happened once
 * already: a baseline captured by an older harness kept printing percentages
 * against numbers that were no longer the same quantity, and every one of them
 * was quoted as a result.
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

    const quality = measureQuality(await readScene(page));

    rows.push({
      corpus: corpus.name,
      tables: corpus.tables,
      relationships: corpus.relationships,
      columns: corpus.columns,
      perf,
      quality,
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

  const qualityRows = report.rows.map(row => {
    const old = previous.get(row.corpus);
    return [
      row.corpus,
      num(row.quality.segments),
      num(row.quality.crossingsShared),
      delta(row.quality.crossingsShared, old?.quality.crossingsShared),
      num(row.quality.crossingsFree),
      delta(row.quality.crossingsFree, old?.quality.crossingsFree),
      num(row.quality.nodeCrossings),
      delta(row.quality.nodeCrossings, old?.quality.nodeCrossings),
      num(row.quality.collinearOverlapPx),
      delta(row.quality.collinearOverlapPx, old?.quality.collinearOverlapPx),
      Number.isFinite(row.quality.minAnchorPitch)
        ? row.quality.minAnchorPitch.toFixed(1)
        : 'n/a',
      num(row.quality.totalLengthPx),
      row.quality.worstCollinear
        ? `${row.quality.worstCollinear.length}px ${row.quality.worstCollinear.axis[0]} ${row.quality.worstCollinear.aEnds} vs ${row.quality.worstCollinear.bEnds}`
        : '—',
    ];
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
      'quality   (cross-shared = same table, cross-free = independent pairs; collinear = length two connectors run within one stroke width of each other)',
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
