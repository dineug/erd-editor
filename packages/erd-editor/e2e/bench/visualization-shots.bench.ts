import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { createCorpus, type CorpusOptions } from './corpus';
import { installBench } from './harness';
import {
  BENCH_DIR,
  createReport,
  REPO_ROOT,
  repoRelative,
  writeReport,
} from './report';

// The Visualization tab as a reader sees it, which the spec makes the gate this
// redesign ends in: twelve frames a person looks at. It measures nothing and
// asserts only that it caught what it was pointed at.

const SHOTS = join(BENCH_DIR, 'shots');

/**
 * Bumped whenever a shot changes what it stands for rather than how it looks,
 * so a folder of PNGs taken across the bump is not read as one set.
 */
const METRICS_VERSION = 2;

/**
 * One hub carrying ten of the eighteen links, which is the screen the plan
 * makes mandatory: a narrowed view rests quiet and lights only what a hover
 * reaches, and the hub is where a wall of glow would show if it showed at all.
 */
const SCENE: CorpusOptions = {
  name: 'shots',
  tables: 18,
  relationships: 26,
  hubDegree: 10,
  seed: 11,
};

/** ELK parses a script heavier than the editor before it places anything. */
const LANDING_TIMEOUT = 120_000;

/** Around a card, so the closeup holds the border and the glow outside it. */
const CLOSEUP_MARGIN = 40;

type Box = { x: number; y: number; width: number; height: number };

type Row = {
  /** The subject, which is the name the spec calls this frame by. */
  shot: string;
  /** What a reader is being asked to judge in it. */
  shows: string;
  /** Where the PNG landed, written relative to the repository root. */
  file: string;
  bytes: number;
};

const rows: Row[] = [];

const label = process.env.E2E_BENCH_LABEL ?? 'current';

const corpus = createCorpus(SCENE);

const toolbarButton = (page: Page, title: string): Locator =>
  page.locator(`erd-editor .visualization-toolbar [title="${title}"]`);

const showModeTrigger = (page: Page): Locator =>
  page.locator('erd-editor .visualization-toolbar [title^="Row display"]');

const showModeMenu = (page: Page): Locator =>
  page.locator(
    'erd-editor .visualization-show-mode-menu .context-menu-content'
  );

/** Opens the row display menu from the bar and picks one of its three options. */
async function chooseShowMode(page: Page, title: string) {
  await showModeTrigger(page).click();
  await showModeMenu(page).locator('> div', { hasText: title }).click();
}

/** Seeds the corpus into the fixture and stands the reader on the graph. */
async function openVisualization(page: Page) {
  await page.goto(FIXTURE_URL);
  await installBench(page);
  await page.evaluate(
    json => window.__erdBench!.load(json),
    JSON.stringify(corpus.document)
  );
  await page.locator('erd-editor .toolbar [title^="Visualization"]').click();
  await expect(toolbarButton(page, 'Flow')).toBeVisible();
}

/**
 * Where a scene node stands on the page, or null while nothing draws it. The
 * shadow and the glow are left out of the box, or a lit card would measure
 * wider than it is drawn and a point inside it would land beside it.
 */
function nodeBox(page: Page, selector: string[]): Promise<Box | null> {
  return page.evaluate(path => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    let node: any = stage;
    for (const step of path) {
      node = node?.findOne(step);
      if (!node) return null;
    }

    const rect = node.getClientRect({ skipShadow: true, skipStroke: true });
    const container = stage.container().getBoundingClientRect();

    return {
      x: container.left + rect.x,
      y: container.top + rect.y,
      width: rect.width,
      height: rect.height,
    };
  }, selector);
}

/** Whether the card of the table given wears the glow a lit one does. */
const litCard = (page: Page, tableId: string) =>
  page.evaluate(id => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    const node: any = stage?.findOne(`#table-${id}`);

    return node ? node.find('.table-glow').length > 0 : false;
  }, tableId);

/** How many table cards the newest scene draws, which is what a narrowing cuts. */
const drawnTables = (page: Page) =>
  page.evaluate(() => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    return stage ? stage.find('.table').length : 0;
  });

/**
 * Stands the reader in the Flow with the placement ELK gave it under them. A
 * view draws no table until the layout lands, so the landing is where a card
 * is drawn off its document corner.
 */
async function enterFlow(page: Page) {
  const [table] = Object.values(corpus.document.collections.tableEntities);
  const seeded = {
    id: table.id,
    x: Math.round(table.ui.x),
    y: Math.round(table.ui.y),
  };

  await toolbarButton(page, 'Flow').click();
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
  await page.waitForTimeout(500);
}

/**
 * Puts the pointer over the middle of the card given and waits until the light
 * has come up on it, so a frame taken after this is one of a lit view rather
 * than one of a pointer that landed beside the card.
 */
async function hoverCard(page: Page, tableId: string) {
  const box = await nodeBox(page, [`#table-${tableId}`]);
  if (!box) throw new Error(`no card is drawn for ${tableId}`);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => litCard(page, tableId)).toBe(true);
  await page.waitForTimeout(400);

  return box;
}

/** Captures one frame of the whole viewport under the name the spec calls it. */
async function shoot(page: Page, shot: string, shows: string, clip?: Box) {
  mkdirSync(SHOTS, { recursive: true });
  const file = join(SHOTS, `${label}-${shot}.png`);
  const png = await page.screenshot({ path: file, ...(clip ? { clip } : {}) });

  rows.push({ shot, shows, file: repoRelative(file), bytes: png.byteLength });
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(() => {
  test.setTimeout(LANDING_TIMEOUT + 120_000);
});

test('shot — graph default', async ({ page }) => {
  await openVisualization(page);
  await page.waitForTimeout(3_000);

  await shoot(page, 'graph-default', 'the tab as it opens, in its graph mode');
});

test('shot — flow over the whole document, and one card lit', async ({
  page,
}) => {
  await openVisualization(page);
  await enterFlow(page);

  await shoot(page, 'flow-all', 'the whole document as a flow, nothing lit');

  await hoverCard(page, corpus.hubTableId);
  await shoot(page, 'flow-hover', 'the hub hovered: its cards and lines lit');

  const bar = await page
    .locator('erd-editor .visualization-toolbar')
    .boundingBox();
  if (bar) {
    await shoot(page, 'toolbar-closeup', 'the bar at the bottom of the tab', {
      x: Math.max(0, bar.x - CLOSEUP_MARGIN),
      y: Math.max(0, bar.y - CLOSEUP_MARGIN / 2),
      width: bar.width + CLOSEUP_MARGIN * 2,
      height: bar.height + CLOSEUP_MARGIN,
    });
  }

  // The menu open is the only thing this change draws that the shots above do
  // not, and where it lands over its trigger is the whole of what a reader
  // judges here, so the frame holds the bar under it as well.
  await showModeTrigger(page).click();
  const menu = await showModeMenu(page).boundingBox();
  if (bar && menu) {
    await shoot(
      page,
      'row-display-menu',
      'the row display menu open over its trigger',
      {
        x: Math.max(0, menu.x - CLOSEUP_MARGIN),
        y: Math.max(0, menu.y - CLOSEUP_MARGIN),
        width: menu.width + CLOSEUP_MARGIN * 2,
        height: bar.y + bar.height + CLOSEUP_MARGIN - menu.y + CLOSEUP_MARGIN,
      }
    );
  }
  await showModeTrigger(page).click();
});

test('shot — the hub narrowed, at rest and hovered, in three row modes', async ({
  page,
}) => {
  await openVisualization(page);
  await enterFlow(page);

  const whole = await drawnTables(page);
  await hoverCard(page, corpus.hubTableId);

  // The two header buttons are drawn on the hovered card alone, so the press
  // is aimed at where the icon stands rather than at a selector.
  const related = await nodeBox(page, [
    `#table-${corpus.hubTableId}`,
    '.table-related',
  ]);
  if (!related) throw new Error('the Related button is not drawn');

  await page.mouse.click(
    related.x + related.width / 2,
    related.y + related.height / 2
  );
  await expect
    .poll(() => drawnTables(page), { timeout: LANDING_TIMEOUT })
    .toBeLessThan(whole);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);

  await shoot(
    page,
    'flow-focused',
    'the hub and its hop alone, at rest with nothing lit'
  );

  await hoverCard(page, corpus.hubTableId);
  await shoot(
    page,
    'flow-focused-hover',
    'the same narrowing hovered: one card, its hop and their lines'
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);

  for (const [title, shot] of [
    ['Name only', 'flow-focused-name-only'],
    ['Keys only', 'flow-focused-keys-only'],
    ['All fields', 'flow-focused-all-fields'],
  ] as const) {
    await chooseShowMode(page, title);
    // A row mode changes the size of every card, so the view is placed anew
    // and what was fitted no longer is. The Fit is the reader's own button,
    // pressed here so the frame holds the whole display set it is judged on.
    await page.waitForTimeout(1_200);
    await toolbarButton(page, 'Fit').click();
    await page.waitForTimeout(400);
    await shoot(page, shot, `the narrowed view with ${title.toLowerCase()}`);
  }

  // The last row mode is the one with something in every cell, and the two
  // header buttons are drawn on the hovered card alone, so the closeup is
  // taken here rather than over the name boxes of the whole display set.
  const box = await hoverCard(page, corpus.hubTableId);
  await shoot(page, 'card-closeup', 'one lit card, hovered, at its own size', {
    x: Math.max(0, box.x - CLOSEUP_MARGIN),
    y: Math.max(0, box.y - CLOSEUP_MARGIN),
    width: box.width + CLOSEUP_MARGIN * 2,
    height: box.height + CLOSEUP_MARGIN * 2,
  });
});

test('shot — the screen carried off every card', async ({ page }) => {
  await openVisualization(page);
  await enterFlow(page);

  // A wheel with no modifier pans the view, so the content is carried off the
  // screen the way a reader carries it off, and the bar grows its arrow.
  await page.mouse.move(700, 400);
  for (let step = 0; step < 40; step++) {
    await page.mouse.wheel(600, 600);
  }

  await expect(toolbarButton(page, 'Go to content')).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(400);

  await shoot(page, 'compass', 'the bar pointing back at what is off screen');
});

test.afterAll(() => {
  if (!rows.length) return;

  const written = writeReport(
    'visualization-shots',
    createReport(rows, METRICS_VERSION)
  );
  const width = Math.max(...rows.map(row => row.shot.length));

  process.stdout.write(
    [
      '',
      'visualization shots — the human gate this feature ends in; look at them',
      '',
      ...rows.map(row =>
        [
          row.shot.padEnd(width),
          `${(row.bytes / 1024).toFixed(0)}KB`.padEnd(8),
          row.shows.padEnd(52),
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
