import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { type ErdDocument } from '../support/schema';
import { createCorpus, type CorpusOptions, selectCorpus } from './corpus';
import { installBench, runEditBench, runHoverBench } from './harness';
import { createReport, delta, readBaseline, writeReport } from './report';

// What the Flow view costs: a hover over a Flow of three hundred name boxes,
// the same hover over the ERD with no view open, and one document edit landing
// while a Flow stands over it. It asserts nothing, like every bench here.

/**
 * Bumped whenever a metric changes what it means rather than what it measures,
 * which suppresses deltas across the bump. Version 3: the view lost its aid
 * layer, its highlight walks over 300ms, and a particle frame solves its path rather than reading one.
 */
const METRICS_VERSION = 3;

/** The corpus the ERD hover baseline runs, as every diagnostic here does. */
const CORPUS = selectCorpus();

/**
 * The Flow corpus, which is the one number the plan names rather than the row
 * E2E_BENCH_CORPUS picks: a Flow draws every table of the document at once, so
 * three hundred boxes is the scene it is asked about, and both edit rows stand on it so the pair compares.
 */
const FLOW_CORPUS: CorpusOptions = {
  name: 'flow300',
  tables: 300,
  relationships: 480,
  hubDegree: 10,
};

/** ELK parses a script heavier than the editor before it places anything. */
const LANDING_TIMEOUT = 120_000;

/** Events dispatched per pass, one to a frame, as the drag bench dispatches moves. */
const MOVES = 120;

/*
 * Writes are counted over every stage rather than over the canvas alone. A tab
 * change caches the ERD out without unmounting it, so its scene still commits
 * while a Flow is up, and the canvas bucket names the Flow's stage by then.
 */

type Row = {
  name: string;
  corpus: string;
  tables: number;
  loadMs: number;
  frameP50: number;
  frameP95: number;
  frameMax: number;
  busy: number;
  writes: number;
  contexts: number;
  contextSubscribes: number;
};

const rows: Row[] = [];

/**
 * Stands the reader in the Flow mode with the placement ELK gave it under
 * them. A Flow draws every table where the document keeps it until the layout
 * lands, so the landing is where a box stops standing on its document corner — a zoom is no landing, since the fit has no ceiling of 1.
 */
function enterFlow(document: ErdDocument) {
  const [table] = Object.values(document.collections.tableEntities);
  const seeded = {
    id: table.id,
    x: Math.round(table.ui.x),
    y: Math.round(table.ui.y),
  };

  return async (page: Page) => {
    await page.locator('erd-editor .toolbar [title^="Visualization"]').click();
    await page
      .locator('erd-editor .visualization-toolbar [title="Flow"]')
      .click();

    await expect
      .poll(
        () =>
          page.evaluate(corner => {
            const stage: any = Reflect.get(window, '__erdStages')?.canvas;
            const node: any = stage?.findOne(`#table-${corner.id}`);

            return node
              ? Math.round(node.x()) !== corner.x ||
                  Math.round(node.y()) !== corner.y
              : false;
          }, seeded),
        { timeout: LANDING_TIMEOUT }
      )
      .toBe(true);
  };
}

test.describe.configure({ mode: 'serial' });

test('flow hover — three hundred name boxes, one lit at a time', async ({
  page,
}) => {
  test.setTimeout(LANDING_TIMEOUT + 120_000);

  await page.goto(FIXTURE_URL);
  await installBench(page);

  const corpus = createCorpus(FLOW_CORPUS);
  const result = await runHoverBench(
    page,
    corpus.document,
    { moves: MOVES },
    enterFlow(corpus.document)
  );

  rows.push({
    name: `flow hover (${result.targets} boxes on screen)`,
    corpus: `${corpus.name} ${corpus.relationships}R`,
    tables: corpus.tables,
    loadMs: result.loadMs,
    frameP50: result.frame.p50,
    frameP95: result.frame.p95,
    frameMax: result.frame.max,
    busy: result.busyMsPerMove,
    writes: result.attrWrites.total / MOVES,
    contexts: result.sceneContexts.live,
    contextSubscribes: result.sceneContexts.total,
  });
});

test('erd hover — the same pass with no view open', async ({ page }) => {
  await page.goto(FIXTURE_URL);
  await installBench(page);

  const corpus = createCorpus(CORPUS);
  const result = await runHoverBench(page, corpus.document, {
    tableId: corpus.hubTableId,
    moves: MOVES,
  });

  rows.push({
    name: `erd hover (${result.targets} boxes on screen)`,
    corpus: `${corpus.name} ${corpus.relationships}R`,
    tables: corpus.tables,
    loadMs: result.loadMs,
    frameP50: result.frame.p50,
    frameP95: result.frame.p95,
    frameMax: result.frame.max,
    busy: result.busyMsPerMove,
    writes: result.attrWrites.total / MOVES,
    contexts: result.sceneContexts.live,
    contextSubscribes: result.sceneContexts.total,
  });
});

test('erd edit — one document edit with no view over it', async ({ page }) => {
  test.setTimeout(LANDING_TIMEOUT + 120_000);

  await page.goto(FIXTURE_URL);
  await installBench(page);

  // The Flow corpus, not the one the knob picks: this row is the other half of
  // the pair the double sort is read from, and a pair is only a pair on one
  // document. The ERD hover row above is the standard-corpus baseline.
  const corpus = createCorpus(FLOW_CORPUS);
  const result = await runEditBench(page, corpus.document, {
    tableId: corpus.hubTableId,
    moves: MOVES,
  });

  rows.push({
    name: 'erd edit',
    corpus: `${corpus.name} ${corpus.relationships}R`,
    tables: corpus.tables,
    loadMs: result.loadMs,
    frameP50: result.frame.p50,
    frameP95: result.frame.p95,
    frameMax: result.frame.max,
    busy: result.busyMsPerEdit,
    writes: result.attrWrites.total / MOVES,
    contexts: result.sceneContexts.live,
    contextSubscribes: result.sceneContexts.total,
  });
});

test('flow edit — the same edit while a flow stands over the document', async ({
  page,
}) => {
  test.setTimeout(LANDING_TIMEOUT + 120_000);

  await page.goto(FIXTURE_URL);
  await installBench(page);

  const corpus = createCorpus(FLOW_CORPUS);
  const result = await runEditBench(
    page,
    corpus.document,
    { tableId: corpus.hubTableId, moves: MOVES },
    enterFlow(corpus.document)
  );

  rows.push({
    name: 'flow edit',
    corpus: `${corpus.name} ${corpus.relationships}R`,
    tables: corpus.tables,
    loadMs: result.loadMs,
    frameP50: result.frame.p50,
    frameP95: result.frame.p95,
    frameMax: result.frame.max,
    busy: result.busyMsPerEdit,
    writes: result.attrWrites.total / MOVES,
    contexts: result.sceneContexts.live,
    contextSubscribes: result.sceneContexts.total,
  });
});

test.afterAll(() => {
  if (!rows.length) return;

  const written = writeReport('view', createReport(rows, METRICS_VERSION));
  const { baseline, note } = readBaseline<Row>('view', METRICS_VERSION);
  // Rows pair by the name they were measured under, so a run that skipped one
  // of them compares the rest against the right numbers.
  const paired = rows.map(row =>
    baseline?.rows.find(old => old.name === row.name)
  );

  const change = (current: number, old: number | undefined) =>
    baseline ? [delta(current, old).padEnd(7)] : [];

  type Column = [label: string, width: number];
  const deltaColumn: Column[] = baseline ? [['Δ', 7]] : [];

  const columns: Column[] = [
    ['what', 34],
    ['corpus', 16],
    ['tables', 6],
    ['load', 8],
    ['frame p50', 9],
    ['frame p95', 9],
    ['frame max', 9],
    ['busy/ev', 8],
    ...deltaColumn,
    ['writes/ev', 9],
    ...deltaColumn,
    ['ctx live/subs', 13],
  ];

  const against = note
    ? `  (${note})`
    : baseline
      ? `  (vs baseline "${baseline.label}")`
      : '  (no baseline saved)';

  process.stdout.write(
    [
      '',
      `scene views — a hover and a document edit, by where they land${against}`,
      '',
      columns.map(([label, width]) => label.padEnd(width)).join('  '),
      columns.map(([, width]) => '─'.repeat(width)).join('  '),
      ...rows.map((row, index) => {
        const old = paired[index];
        return [
          row.name.padEnd(34),
          row.corpus.padEnd(16),
          String(row.tables).padEnd(6),
          `${row.loadMs.toFixed(0)}ms`.padEnd(8),
          `${row.frameP50.toFixed(1)}ms`.padEnd(9),
          `${row.frameP95.toFixed(1)}ms`.padEnd(9),
          `${row.frameMax.toFixed(1)}ms`.padEnd(9),
          `${row.busy.toFixed(2)}ms`.padEnd(8),
          ...change(row.busy, old?.busy),
          row.writes.toFixed(1).padEnd(9),
          ...change(row.writes, old?.writes),
          `${row.contexts}/${row.contextSubscribes}`.padEnd(13),
        ].join('  ');
      }),
      '',
      `written: ${written.latest}`,
      ...(written.baseline ? [`baseline: ${written.baseline}`] : []),
      '',
    ].join('\n')
  );
});
