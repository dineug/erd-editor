import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { createCorpus, selectCorpus } from './corpus';
import { installBench, runDragBench } from './harness';
import {
  createReport,
  delta,
  readBaseline,
  writeReport,
  type BenchCorpus,
} from './report';

const CORPUS = selectCorpus();
const HUB_DEGREE = CORPUS.hubDegree ?? 6;

/**
 * Bumped whenever a metric changes what it means rather than what it measures,
 * which suppresses deltas across the bump. Otherwise a stale baseline prints
 * percentages against numbers that are no longer the same quantity.
 */
const METRICS_VERSION = 1;

/**
 * The generator lays a spanning tree first, so it cannot return fewer than one
 * relationship per table plus the self relationships. A step under that floor
 * comes back clamped, and two clamped steps measure the same document twice.
 */
const FLOOR = Math.max(1, CORPUS.tables - 1 + (CORPUS.selfRelationships ?? 1));
const STEP_COUNT = 4;
const TOP = Math.max(CORPUS.relationships, FLOOR);

/**
 * Steps spread from that floor to the corpus, so no two of them collapse onto
 * one document and the sweep still ends at the corpus. Each row reports what
 * the generator returned, which at the floor is one above what was asked.
 */
const TOTALS = [
  ...new Set(
    Array.from({ length: STEP_COUNT }, (_, index) =>
      Math.round(FLOOR + ((TOP - FLOOR) * index) / (STEP_COUNT - 1))
    )
  ),
];

type Row = {
  total: number;
  fanOut: number;
  busy: number;
  frame: number;
  writes: number;
};

const rows: Row[] = [];

/** Filled from the full-corpus step; the options are the pre-run estimate. */
let size: BenchCorpus = {
  name: CORPUS.name,
  tables: CORPUS.tables,
  relationships: CORPUS.relationships,
  columns: 0,
};

test.describe.configure({ mode: 'serial' });

for (const total of TOTALS) {
  test(`relationship scaling — ${total} relationships`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus({
      ...CORPUS,
      name: `${CORPUS.name}-${total}`,
      relationships: total,
      hubDegree: HUB_DEGREE,
    });

    // The last step is the corpus itself, so its counts are the ones the
    // report envelope records.
    if (total === TOTALS[TOTALS.length - 1]) {
      size = {
        name: CORPUS.name,
        tables: corpus.tables,
        relationships: corpus.relationships,
        columns: corpus.columns,
      };
    }

    const result = await runDragBench(page, corpus.document, {
      tableId: corpus.hubTableId,
      moves: 120,
    });

    rows.push({
      total: corpus.relationships,
      fanOut: result.fanOut.p50,
      busy: result.busyMsPerMove,
      frame: result.frame.p50,
      writes: result.attrWrites.perMove,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;
  const first = rows[0];

  const written = writeReport(
    'scaling',
    createReport(rows, METRICS_VERSION, size)
  );
  const { baseline, note } = readBaseline<Row>(
    'scaling',
    METRICS_VERSION,
    size
  );
  // Rows pair by position, never by total: a sweep whose steps collapsed onto
  // one total makes a map keyed by it compare a row against its neighbour. The
  // total still has to match, or the two rows are not the same measurement.
  const paired = rows.map((row, index) => {
    const old = baseline?.rows[index];
    return old && old.total === row.total ? old : undefined;
  });
  const sweptDifferently =
    !!baseline &&
    (baseline.rows.length !== rows.length || paired.includes(undefined));

  // The delta columns appear only against a comparable baseline, so a first
  // run reads as the plain table it was before there was one.
  const change = (current: number, old: number | undefined) =>
    baseline ? [delta(current, old).padEnd(7)] : [];

  type Column = [label: string, width: number];
  const deltaColumn: Column[] = baseline ? [['Δ', 7]] : [];

  const columns: Column[] = [
    ['total R', 7],
    ['fan-out', 7],
    ['busy/move', 9],
    ...deltaColumn,
    ['vs first', 8],
    ['frame p50', 9],
    ...deltaColumn,
    ['writes/move', 11],
    ...deltaColumn,
  ];

  const against = note
    ? `  (${note})`
    : !baseline
      ? '  (no baseline saved)'
      : sweptDifferently
        ? `  (baseline "${baseline.label}" swept other totals — deltas only where the rows line up)`
        : `  (vs baseline "${baseline.label}")`;

  process.stdout.write(
    [
      '',
      `relationship scaling — ${size.name}: ${size.tables} tables, hub degree ${HUB_DEGREE} held constant${against}`,
      '',
      columns.map(([label, width]) => label.padEnd(width)).join('  '),
      columns.map(([, width]) => '─'.repeat(width)).join('  '),
      ...rows.map((row, index) => {
        const old = paired[index];
        return [
          String(row.total).padEnd(7),
          row.fanOut.toFixed(0).padEnd(7),
          `${row.busy.toFixed(2)}ms`.padEnd(9),
          ...change(row.busy, old?.busy),
          `${(row.busy / first.busy).toFixed(2)}x`.padEnd(8),
          `${row.frame.toFixed(1)}ms`.padEnd(9),
          ...change(row.frame, old?.frame),
          row.writes.toFixed(1).padEnd(11),
          ...change(row.writes, old?.writes),
        ].join('  ');
      }),
      '',
      `written: ${written.latest}`,
      ...(written.baseline ? [`baseline: ${written.baseline}`] : []),
      '',
    ].join('\n')
  );
});
