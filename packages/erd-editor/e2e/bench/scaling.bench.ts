import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { createCorpus } from './corpus';
import { installBench, runDragBench } from './harness';

const HUB_DEGREE = 9;
const TOTALS = [24, 48, 80, 120];

const rows: Array<{
  total: number;
  fanOut: number;
  busy: number;
  frame: number;
  attr: number;
  segments: number;
}> = [];

test.describe.configure({ mode: 'serial' });

for (const total of TOTALS) {
  test(`relationship scaling — ${total} relationships`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus({
      name: `scale-${total}`,
      tables: 56,
      relationships: total,
      hubDegree: HUB_DEGREE,
    });

    const result = await runDragBench(page, corpus.document, {
      tableId: corpus.hubTableId,
      moves: 120,
    });

    rows.push({
      total: corpus.relationships,
      fanOut: result.fanOut.p50,
      busy: result.busyMsPerMove,
      frame: result.frame.p50,
      attr: result.attrWrites.perMove,
      segments: 0,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;
  const first = rows[0];

  process.stdout.write(
    [
      '',
      `relationship scaling — 56 tables, hub degree ${HUB_DEGREE} held constant`,
      '',
      'total R  fan-out  busy/move  vs first  frame p50  attr/move',
      '───────  ───────  ─────────  ────────  ─────────  ─────────',
      ...rows.map(row =>
        [
          String(row.total).padEnd(7),
          row.fanOut.toFixed(0).padEnd(7),
          `${row.busy.toFixed(2)}ms`.padEnd(9),
          `${(row.busy / first.busy).toFixed(2)}x`.padEnd(8),
          `${row.frame.toFixed(1)}ms`.padEnd(9),
          row.attr.toFixed(1),
        ].join('  ')
      ),
      '',
    ].join('\n')
  );
});
