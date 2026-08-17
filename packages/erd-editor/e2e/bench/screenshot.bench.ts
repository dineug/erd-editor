import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { createCorpus, type CorpusOptions } from './corpus';
import { installBench } from './harness';

/**
 * Renders each scene and saves a PNG.
 *
 * This repo has no visual regression test of any kind, and the overlap metrics
 * cannot see everything — a drawing can score well and still read badly. These
 * images are for a person to look at before calling a routing change done.
 *
 *   E2E_BENCH_ALL=1 E2E_BENCH_LABEL=before \
 *     pnpm exec playwright test -c playwright.bench.config.ts screenshot
 *
 * Output goes to `e2e/.bench/shots/`, which is gitignored. Label the run to
 * keep a before and after side by side.
 */

const SHOTS = join(import.meta.dirname, '..', '.bench', 'shots');
const VIEWPORT = { width: 1440, height: 900 };

const SCENES: CorpusOptions[] = [
  // Small enough to read the anchors and cardinality symbols at 1:1.
  { name: 'detail', tables: 6, relationships: 11, hubDegree: 4, seed: 7 },
  // One table carrying far more than its side can comfortably hold.
  { name: 'hub', tables: 9, relationships: 18, hubDegree: 8, seed: 11 },
  // Enough tables that paths have to pass others to get anywhere.
  { name: 'dense', tables: 20, relationships: 38, hubDegree: 5, seed: 3 },
];

for (const scene of SCENES) {
  test(`screenshot — ${scene.name}`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus(scene);

    // The generator lays tables on a grid inside a fixed 4000px canvas, which
    // leaves the viewport looking at empty space. Shrink the canvas to the
    // occupied region and zoom so the whole scene is in frame.
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
    await page.screenshot({ path: join(SHOTS, `${label}-${scene.name}.png`) });
  });
}
