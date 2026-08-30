import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { DEFAULT_SHOW, Show } from '../support/schema';
import { createCorpus } from './corpus';
import { installBench, runDragBench } from './harness';

const CORPUS = { name: 'large', tables: 56, relationships: 120, hubDegree: 9 };

type Variant = {
  name: string;
  what: string;
  /** Mutates the loaded page before the drag is measured. */
  apply?: (page: Page) => Promise<void>;
  showMask?: number;
};

/** Injects arbitrary CSS into the editor's shadow root. */
const css = (rule: string) => async (page: Page) => {
  await page.evaluate(text => {
    const host = document.querySelector('erd-editor');
    const root = (host as HTMLElement & { shadowRoot: ShadowRoot | null })
      ?.shadowRoot;
    if (!root) throw new Error('shadow root is not reachable');
    const style = document.createElement('style');
    style.textContent = text;
    root.appendChild(style);
  }, rule);
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

const VARIANTS: Variant[] = [
  {
    name: 'full',
    what: 'everything the editor normally paints',
  },
  {
    name: 'no-minimap',
    what: 'minimap hidden — it renders a second copy of every table and edge',
    apply: hide('.minimap'),
  },
  {
    name: 'no-relationships',
    what: 'relationship SVG off via settings.show',
    showMask: DEFAULT_SHOW & ~Show.relationship,
  },
  {
    name: 'no-svg-layer',
    what: 'the canvas SVG element hidden, tables still live',
    apply: hide('[data-testid="erd-canvas"] svg'),
  },
  {
    name: 'minimap-layer',
    what: 'minimap promoted to its own layer — this is what shipped',
    apply: css('.minimap { will-change: transform; }'),
  },
  {
    name: 'minimap-contain',
    what: 'paint containment on the minimap subtree — measured to do nothing',
    apply: css('.minimap { contain: strict; }'),
  },
  {
    name: 'neither',
    what: 'no minimap and no relationships — the floor for table painting',
    showMask: DEFAULT_SHOW & ~Show.relationship,
    apply: hide('.minimap'),
  },
];

const rows: Array<{
  variant: Variant;
  framep50: number;
  framep95: number;
  dispatch: number;
  attr: number;
}> = [];

test.describe.configure({ mode: 'serial' });

for (const variant of VARIANTS) {
  test(`frame attribution — ${variant.name}`, async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await installBench(page);

    const corpus = createCorpus(CORPUS);
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
      variant,
      framep50: result.frame.p50,
      framep95: result.frame.p95,
      dispatch: result.busyMsPerMove,
      attr: result.attrWrites.perMove,
    });
  });
}

test.afterAll(() => {
  if (!rows.length) return;

  const full = rows.find(row => row.variant.name === 'full');
  const width = Math.max(...rows.map(row => row.variant.name.length));

  const lines = rows.map(row => {
    const saved =
      full && row !== full
        ? ` (−${(full.framep50 - row.framep50).toFixed(1)}ms)`
        : '';
    return [
      row.variant.name.padEnd(width),
      `frame p50 ${row.framep50.toFixed(2)}ms`.padEnd(22),
      `p95 ${row.framep95.toFixed(2)}ms`.padEnd(16),
      `busy/move ${row.dispatch.toFixed(2)}ms`.padEnd(20),
      `attr/move ${row.attr.toFixed(1)}`.padEnd(18),
      saved,
    ].join('  ');
  });

  process.stdout.write(
    [
      '',
      `frame attribution — ${CORPUS.tables} tables / ${CORPUS.relationships} relationships`,
      '',
      ...lines,
      '',
      ...rows.map(row => `  ${row.variant.name}: ${row.variant.what}`),
      '',
    ].join('\n')
  );
});
