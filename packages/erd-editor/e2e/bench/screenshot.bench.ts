import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { createCorpus, selectCorpus, type CorpusOptions } from './corpus';
import { installBench } from './harness';
import {
  BENCH_DIR,
  createReport,
  REPO_ROOT,
  repoRelative,
  writeReport,
  type BenchCorpus,
} from './report';

const SHOTS = join(BENCH_DIR, 'shots');
const VIEWPORT = { width: 1440, height: 900 };
const CORPUS = selectCorpus();

/**
 * Bumped whenever a row changes what it means rather than what it measures,
 * which suppresses comparison across the bump.
 */
const METRICS_VERSION = 1;

/**
 * Three scenes sized to be read at a glance, plus whichever corpus the run
 * selected — the numbered benches measure that one, and this is what it looks
 * like while they do.
 */
const SCENES: CorpusOptions[] = [
  // Small enough to read the anchors and cardinality symbols at 1:1.
  { name: 'detail', tables: 6, relationships: 11, hubDegree: 4, seed: 7 },
  // One table carrying far more than its side can comfortably hold.
  { name: 'hub', tables: 9, relationships: 18, hubDegree: 8, seed: 11 },
  // Enough tables that paths have to pass others to get anywhere.
  { name: 'dense', tables: 20, relationships: 38, hubDegree: 5, seed: 3 },
  CORPUS,
];

type Row = {
  scene: string;
  tables: number;
  relationships: number;
  columns: number;
  /** Canvas the scene was shrunk to, and the zoom that brought it into frame. */
  width: number;
  height: number;
  zoomLevel: number;
  /** Where the PNG landed, written relative to the repository root. */
  file: string;
  bytes: number;
};

const rows: Row[] = [];

/** Filled from the selected corpus's scene; the options are the estimate. */
let size: BenchCorpus = {
  name: CORPUS.name,
  tables: CORPUS.tables,
  relationships: CORPUS.relationships,
  columns: 0,
};

test.describe.configure({ mode: 'serial' });

for (const scene of SCENES) {
  test(`screenshot — ${scene.name}`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus(scene);
    if (scene.name === CORPUS.name) {
      size = {
        name: corpus.name,
        tables: corpus.tables,
        relationships: corpus.relationships,
        columns: corpus.columns,
      };
    }

    // The generator lays tables on a grid inside a canvas no smaller than
    // 4000px, which leaves the viewport looking at empty space. Shrink it to
    // the occupied region and zoom so the whole scene is in frame.
    const tables = Object.values(corpus.document.collections.tableEntities);
    const right = Math.max(...tables.map(table => table.ui.x));
    const bottom = Math.max(...tables.map(table => table.ui.y));
    // Tables are laid out from their top-left, so the rightmost one still needs
    // room for its own box; 420 covers the widest this generator produces.
    const width = right + 420;
    const height = bottom + 420;

    corpus.document.settings.width = width;
    corpus.document.settings.height = height;
    corpus.document.settings.zoomLevel = Math.min(
      1,
      VIEWPORT.width / width,
      VIEWPORT.height / height
    );

    await page.evaluate(
      json => window.__erdBench!.load(json),
      JSON.stringify(corpus.document)
    );

    mkdirSync(SHOTS, { recursive: true });
    const label = process.env.E2E_BENCH_LABEL ?? 'current';
    const file = join(SHOTS, `${label}-${scene.name}.png`);
    const png = await page.screenshot({ path: file });

    rows.push({
      scene: corpus.name,
      tables: corpus.tables,
      relationships: corpus.relationships,
      columns: corpus.columns,
      width,
      height,
      zoomLevel: corpus.document.settings.zoomLevel,
      file: repoRelative(file),
      bytes: png.byteLength,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;

  const written = writeReport(
    'screenshot',
    createReport(rows, METRICS_VERSION, size)
  );
  const width = Math.max(...rows.map(row => row.scene.length));

  process.stdout.write(
    [
      '',
      'screenshots — the only visual check in this repo; look at them',
      '',
      ...rows.map(row =>
        [
          row.scene.padEnd(width),
          `${row.tables}T/${row.relationships}R`.padEnd(12),
          `${row.width}x${row.height}`.padEnd(14),
          `zoom ${row.zoomLevel.toFixed(3)}`.padEnd(12),
          `${(row.bytes / 1024).toFixed(0)}KB`.padEnd(8),
          join(REPO_ROOT, row.file),
        ].join('  ')
      ),
      '',
      `written: ${written.latest}`,
      ...(written.baseline ? [`baseline: ${written.baseline}`] : []),
      '',
    ].join('\n')
  );
});
