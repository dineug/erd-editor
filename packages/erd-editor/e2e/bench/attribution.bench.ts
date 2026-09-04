import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { DEFAULT_SHOW, Show } from '../support/schema';
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

/**
 * Bumped whenever a metric changes what it means rather than what it measures,
 * which suppresses deltas across the bump. Otherwise a stale baseline prints
 * percentages against numbers that are no longer the same quantity.
 */
const METRICS_VERSION = 1;

type Variant = {
  name: string;
  what: string;
  /** Mutates the loaded page before the drag is measured. */
  apply?: (page: Page) => Promise<void>;
  showMask?: number;
};

/** Injects a stylesheet into the editor's shadow root. */
const hide = (selector: string) => async (page: Page) => {
  await page.evaluate(css => {
    const host = document.querySelector('erd-editor');
    const root = (host as HTMLElement & { shadowRoot: ShadowRoot | null })
      ?.shadowRoot;
    if (!root) throw new Error('shadow root is not reachable');
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }, `${selector} { display: none !important; }`);
};

type Hideable = { visible(value: boolean): void };

type StageHandle = {
  getLayers(): Hideable[];
  findOne(selector: string): Hideable | undefined;
};

/**
 * Takes a subtree of a live stage out of the draw. A konva node that is not
 * visible is skipped by the layer's own draw, which is the closest thing a
 * canvas scene has to the dom bench hiding an element with css.
 */
const unpaint = (stage: string, selector?: string) => async (page: Page) => {
  await page.evaluate(
    ([stageName, nodeSelector]) => {
      const stages = Reflect.get(window, '__erdStages') as
        | Record<string, StageHandle>
        | undefined;
      const found = stages?.[stageName];
      if (!found) throw new Error(`konva stage "${stageName}" is missing`);

      if (!nodeSelector) {
        for (const layer of found.getLayers()) layer.visible(false);
        return;
      }

      const node = found.findOne(nodeSelector);
      if (!node) throw new Error(`konva node "${nodeSelector}" is missing`);
      node.visible(false);
    },
    [stage, selector] as const
  );
};

/** Runs several page mutations in the order they are given. */
const all =
  (...steps: Array<(page: Page) => Promise<void>>) =>
  async (page: Page) => {
    for (const step of steps) await step(page);
  };

const VARIANTS: Variant[] = [
  {
    name: 'full',
    what: 'everything the editor normally paints',
  },
  {
    name: 'no-minimap',
    what: 'minimap stage neither drawn nor composited — its scene still commits',
    apply: all(hide('.minimap'), unpaint('minimap')),
  },
  {
    name: 'no-relationships',
    what: 'relationship nodes never built, via settings.show',
    showMask: DEFAULT_SHOW & ~Show.relationship,
  },
  {
    name: 'no-relationship-paint',
    what: 'connectors still rewritten every move, their group left undrawn',
    apply: unpaint('canvas', '.relationship-group'),
  },
  {
    name: 'neither',
    what: 'no minimap and no relationships — the floor for table painting',
    showMask: DEFAULT_SHOW & ~Show.relationship,
    apply: all(hide('.minimap'), unpaint('minimap')),
  },
];

type Row = {
  variant: string;
  what: string;
  frameP50: number;
  frameP95: number;
  busyMsPerMove: number;
  sceneWritesPerMove: number;
};

const rows: Row[] = [];

/** Filled from the first corpus built; the options are the pre-run estimate. */
let size: BenchCorpus = {
  name: CORPUS.name,
  tables: CORPUS.tables,
  relationships: CORPUS.relationships,
  columns: 0,
};

test.describe.configure({ mode: 'serial' });

for (const variant of VARIANTS) {
  test(`frame attribution — ${variant.name}`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus(CORPUS);
    size = {
      name: corpus.name,
      tables: corpus.tables,
      relationships: corpus.relationships,
      columns: corpus.columns,
    };
    if (variant.showMask !== undefined) {
      corpus.document.settings.show = variant.showMask;
    }

    const result = await runDragBench(
      page,
      corpus.document,
      { tableId: corpus.hubTableId, moves: 120 },
      variant.apply
    );

    rows.push({
      variant: variant.name,
      what: variant.what,
      frameP50: result.frame.p50,
      frameP95: result.frame.p95,
      busyMsPerMove: result.busyMsPerMove,
      sceneWritesPerMove: result.attrWrites.perMove,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;

  const written = writeReport(
    'attribution',
    createReport(rows, METRICS_VERSION, size)
  );
  const { baseline, note } = readBaseline<Row>(
    'attribution',
    METRICS_VERSION,
    size
  );
  const previous = new Map(baseline?.rows.map(row => [row.variant, row]) ?? []);

  const full = rows.find(row => row.variant === 'full');
  const width = Math.max(...rows.map(row => row.variant.length));

  // The delta columns appear only against a comparable baseline, so a first
  // run reads as the plain table it was before there was one.
  const change = (current: number, old: number | undefined) =>
    baseline ? [delta(current, old).padEnd(7)] : [];

  const lines = rows.map(row => {
    const old = previous.get(row.variant);
    // The sign comes off the value, not the template: a variant slower than
    // full used to print a minus in front of a negative number.
    const vsFull =
      full && row !== full ? row.frameP50 - full.frameP50 : undefined;
    const saved =
      vsFull === undefined
        ? ''
        : ` (${vsFull < 0 ? '−' : '+'}${Math.abs(vsFull).toFixed(1)}ms)`;
    return [
      row.variant.padEnd(width),
      `frame p50 ${row.frameP50.toFixed(2)}ms`.padEnd(22),
      ...change(row.frameP50, old?.frameP50),
      `p95 ${row.frameP95.toFixed(2)}ms`.padEnd(16),
      `busy/move ${row.busyMsPerMove.toFixed(2)}ms`.padEnd(20),
      ...change(row.busyMsPerMove, old?.busyMsPerMove),
      `writes/move ${row.sceneWritesPerMove.toFixed(1)}`.padEnd(20),
      ...change(row.sceneWritesPerMove, old?.sceneWritesPerMove),
      saved,
    ].join('  ');
  });

  const against = note
    ? `  (${note})`
    : baseline
      ? `  (vs baseline "${baseline.label}")`
      : '  (no baseline saved)';

  process.stdout.write(
    [
      '',
      `frame attribution — ${size.name}: ${size.tables} tables / ${size.relationships} relationships${against}`,
      '',
      ...lines,
      '',
      ...rows.map(row => `  ${row.variant}: ${row.what}`),
      '',
      `written: ${written.latest}`,
      ...(written.baseline ? [`baseline: ${written.baseline}`] : []),
      '',
    ].join('\n')
  );
});
