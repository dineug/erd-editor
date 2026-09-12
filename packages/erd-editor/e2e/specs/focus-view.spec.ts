import type { Page } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The Visualization tab and the Focus overlay from the outside: which mode the
// tab stands in, what ELK is asked for, where a walk lands, and what the host
// hears while a reader is in a view over the document.

/**
 * ELK is megabytes of script the worker parses before it answers anything, and
 * every Focus open and every Flow entry waits on one.
 */
const PLACEMENT_TIMEOUT = 45_000;

/** Past the 200ms debounce on the outward change event, so a count is settled. */
const CHANGE_SETTLE_MS = 300;

const pk = (id: string, name: string) => ({
  id,
  name,
  dataType: 'int',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
  keys: ColumnUIKey.primaryKey,
});

const fk = (id: string, name: string) => ({
  id,
  name,
  dataType: 'int',
  keys: ColumnUIKey.foreignKey,
});

const relate = (
  id: string,
  start: string,
  end: string,
  endColumnId: string
) => ({
  id,
  relationshipType: RelationshipType.OneN,
  startTableId: start,
  startColumnIds: [`${start}_id`],
  endTableId: end,
  endColumnIds: [endColumnId],
});

/**
 * A small shop, joined so every walk in this file has somewhere to go: orders
 * reaches customers, customers reaches addresses. Four tables sit on the
 * screen the runner opens with, and addresses sits far outside it.
 */
const shop = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'customers',
        name: 'customers',
        x: 200,
        y: 200,
        columns: [pk('customers_id', 'id')],
      },
      {
        id: 'orders',
        name: 'orders',
        x: 700,
        y: 200,
        columns: [pk('orders_id', 'id'), fk('orders_customer', 'customer_id')],
      },
      {
        id: 'products',
        name: 'products',
        x: 200,
        y: 520,
        columns: [pk('products_id', 'id')],
      },
      {
        id: 'order_items',
        name: 'order_items',
        x: 700,
        y: 520,
        columns: [
          pk('order_items_id', 'id'),
          fk('order_items_order', 'order_id'),
          fk('order_items_product', 'product_id'),
        ],
      },
      {
        id: 'addresses',
        name: 'addresses',
        x: 3_200,
        y: 2_400,
        columns: [
          pk('addresses_id', 'id'),
          fk('addresses_customer', 'customer_id'),
        ],
      },
    ],
    relationships: [
      relate('customers_orders', 'customers', 'orders', 'orders_customer'),
      relate(
        'customers_addresses',
        'customers',
        'addresses',
        'addresses_customer'
      ),
      relate('orders_items', 'orders', 'order_items', 'order_items_order'),
      relate(
        'products_items',
        'products',
        'order_items',
        'order_items_product'
      ),
    ],
  });

/**
 * Counts the layout calls the editor makes on the ELK worker. Comlink sends
 * one message per remote call over the worker's port, so the calls named
 * layout are the asks, and the handshake beside them is not one.
 */
async function countElkAsks(page: Page) {
  await page.addInitScript(() => {
    Reflect.set(window, '__elkAsks', 0);
    const proto = MessagePort.prototype as any;
    const post = proto.postMessage;
    proto.postMessage = function (this: any, message: any, ...rest: any[]) {
      const path = message?.path;
      if (Array.isArray(path) && path[0] === 'layout') {
        Reflect.set(window, '__elkAsks', Reflect.get(window, '__elkAsks') + 1);
      }
      return post.apply(this, [message, ...rest]);
    };
  });
}

const elkAsks = (page: Page) =>
  page.evaluate(() => Reflect.get(window, '__elkAsks') as number);

/** The ask count once anything scheduled behind a timer has had its window. */
async function settledElkAsks(page: Page) {
  await page.waitForTimeout(CHANGE_SETTLE_MS);
  return elkAsks(page);
}

/** Starts counting the outward change events from now, whatever came before. */
async function countChanges(page: Page) {
  await page.evaluate(() => {
    const editor = document.querySelector('erd-editor');
    if (!editor) throw new Error('erd-editor is not mounted');

    Reflect.set(window, '__changes', 0);
    const listener = Reflect.get(window, '__changeListener') as
      | EventListener
      | undefined;
    if (listener) editor.removeEventListener('change', listener);

    const next: EventListener = () =>
      Reflect.set(window, '__changes', Reflect.get(window, '__changes') + 1);
    Reflect.set(window, '__changeListener', next);
    editor.addEventListener('change', next);
  });
}

/** The change count once the debounce behind it has had its window. */
async function settledChanges(page: Page) {
  await page.waitForTimeout(CHANGE_SETTLE_MS);
  return page.evaluate(() => Reflect.get(window, '__changes') as number);
}

/**
 * The action types the peer stream carries that are neither the presence
 * trackers nor the LWW handshake, which leaves the changes the host is told
 * of. The stream is the one place their identity is readable from outside.
 */
const TRACKER_ACTIONS = [
  'editor.sharedMouseTracker',
  'editor.sharedFocusTracker',
  'editor.sharedSelectionTracker',
  'editor.sharedDragSelectTracker',
  'editor.getLWW',
  'editor.mergeLWW',
];

/** Starts recording the actions the editor sends a peer, from now on. */
async function recordActions(page: Page) {
  await page.evaluate(() => {
    const editor = document.querySelector('erd-editor');
    if (!editor) throw new Error('erd-editor is not mounted');

    const previous = Reflect.get(window, '__actionStore') as
      | { destroy(): void }
      | undefined;
    previous?.destroy();
    Reflect.set(window, '__actionTypes', []);

    const peer = editor.getSharedStore({
      mouseTracker: false,
      focusTracker: false,
    });
    peer.subscribe(actions => {
      const types = Reflect.get(window, '__actionTypes') as string[];
      types.push(...actions.map(action => action.type));
    });
    Reflect.set(window, '__actionStore', peer);
  });
}

/** What the recorder heard, less the presence traffic that is not a change. */
async function recordedChanges(page: Page) {
  const types = await page.evaluate(
    () => Reflect.get(window, '__actionTypes') as string[]
  );
  return types.filter(type => !TRACKER_ACTIONS.includes(type));
}

/** Where each table stands in the scene the newest stage draws, rounded. */
function placementsOf(erd: ErdEditorPage, ids: string[]) {
  return erd.page.evaluate(tableIds => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;

    return Object.fromEntries(
      tableIds.map(id => {
        const node = stage?.findOne(`#table-${id}`);
        return [
          id,
          node ? { x: Math.round(node.x()), y: Math.round(node.y()) } : null,
        ];
      })
    ) as Record<string, { x: number; y: number } | null>;
  }, ids);
}

/** Where the scene layer of the newest stage stands, which is its pan and zoom. */
function sceneTransform(erd: ErdEditorPage) {
  return erd.page.evaluate(() => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    const layer: any = stage?.findOne('.scene');

    return layer
      ? {
          x: Math.round(layer.x()),
          y: Math.round(layer.y()),
          scale: layer.scaleX(),
        }
      : null;
  });
}

/** The overlay's own scene, which is a second canvas over the tab's own. */
const focusScene = (erd: ErdEditorPage) =>
  erd.host.locator('.focus-view [data-testid="erd-canvas"] .scene-mirror');

const focusBar = (erd: ErdEditorPage) => erd.host.locator('.focus-bar');
const focusCenters = (erd: ErdEditorPage) => erd.host.locator('.focus-centers');
const focusTable = (erd: ErdEditorPage, id: string) =>
  focusScene(erd).locator(`.table[data-id="${id}"]`);

/**
 * The tab's own scene while the Visualization tab stands in its Flow mode. The
 * ERD is cached out of the document by then, so the one canvas is the Flow's,
 * until a Focus overlay draws a second one over it.
 */
const flowScene = (erd: ErdEditorPage) =>
  erd.host.locator('[data-testid="erd-canvas"] .scene-mirror');

const flowTable = (erd: ErdEditorPage, id: string) =>
  flowScene(erd).locator(`.table[data-id="${id}"]`);

const modeButton = (erd: ErdEditorPage, title: string) =>
  erd.host.locator(`.visualization-toolbar [title="${title}"]`);

/**
 * Waits until the view has the placement ELK gave it, not merely a scene. A
 * view draws a table where the document keeps it until a layout lands, so a
 * coordinate read before the landing is the document's own.
 */
async function landed(erd: ErdEditorPage, tableId: string) {
  const { ui } = await erd.table(tableId);
  const seeded = { x: Math.round(ui.x), y: Math.round(ui.y) };

  await expect
    .poll(async () => (await placementsOf(erd, [tableId]))[tableId], {
      timeout: PLACEMENT_TIMEOUT,
    })
    .not.toEqual(seeded);
  await erd.whenDrawn();
}

/** Waits for the Focus overlay to be up with a placement under it. */
async function focusPlaced(erd: ErdEditorPage, centerId: string) {
  await expect(focusBar(erd)).toBeVisible({ timeout: PLACEMENT_TIMEOUT });
  await expect(focusTable(erd, centerId)).toBeVisible({
    timeout: PLACEMENT_TIMEOUT,
  });
  await landed(erd, centerId);
}

/** Stands the reader in the Flow mode of the Visualization tab, placed. */
async function enterFlow(erd: ErdEditorPage) {
  await erd.toolbarButton('Visualization').click();
  await modeButton(erd, 'Flow').click();
  await expect(modeButton(erd, 'Tidy Up')).toBeVisible();
  await expect(flowTable(erd, 'customers')).toBeVisible({
    timeout: PLACEMENT_TIMEOUT,
  });
  await landed(erd, 'customers');
}

/**
 * One row of the quick search list, named by the action and the keyword the
 * row draws beside it. The keyword is what tells the jump to a table from the
 * Focus on the same one, since the name of the second carries the first.
 */
const searchRow = (
  erd: ErdEditorPage,
  name: string,
  keyword: 'Table' | 'Focus'
) =>
  erd.host
    .locator('.quick-search')
    .getByText(`${name}${keyword}`, { exact: true });

test.describe('the visualization tab and the focus view over the document', () => {
  test.beforeEach(async () => {
    // Every test here waits on ELK at least once, and the worker parses a
    // script heavier than the editor before it answers the first.
    test.setTimeout(120_000);
  });

  test('opens the tab on the graph, keeps flow across a tab change, and opens a new session on the graph again', async ({
    erd,
  }) => {
    await erd.seed(shop());

    const graph = erd.host.locator('[data-testid="visualization-canvas"]');
    await erd.toolbarButton('Visualization').click();
    await expect(graph).toBeVisible();
    await expect(modeButton(erd, 'Tidy Up')).toHaveCount(0);

    await enterFlow(erd);
    await expect(graph).toHaveCount(0);

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await expect(erd.host.locator('.visualization-toolbar')).toHaveCount(0);
    await erd.toolbarButton('Visualization').click();
    await expect(modeButton(erd, 'Tidy Up')).toBeVisible();
    await expect(graph).toHaveCount(0);

    // The mode is the reader's for the session and never the file's, so a
    // fresh page stands on the graph again with the same document.
    await erd.goto();
    await erd.seed(shop());
    await erd.toolbarButton('Visualization').click();
    await expect(graph).toBeVisible();
  });

  test('asks elk once for the flow layout, and nothing more on a return to the tab', async ({
    erd,
    page,
  }) => {
    await countElkAsks(page);
    await erd.goto();
    await erd.seed(shop());

    await enterFlow(erd);
    await expect.poll(() => elkAsks(page)).toBe(1);
    const placed = await placementsOf(erd, ['customers', 'orders', 'products']);
    expect(placed.customers).not.toBeNull();

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await expect(erd.host.locator('.visualization-toolbar')).toHaveCount(0);
    await erd.toolbarButton('Visualization').click();
    await expect(flowTable(erd, 'customers')).toBeVisible();
    await erd.whenDrawn();

    expect(await settledElkAsks(page)).toBe(1);
    expect(
      await placementsOf(erd, ['customers', 'orders', 'products'])
    ).toEqual(placed);
  });

  test('asks nothing for a table a peer adds while the flow stands, and places it on tidy up', async ({
    erd,
    page,
  }) => {
    await countElkAsks(page);
    await erd.goto();
    await erd.seed(shop());
    await enterFlow(erd);
    await expect.poll(() => elkAsks(page)).toBe(1);

    // The tab has no editing of its own, so the edit arrives the way a peer's
    // does: tagged shared, which is what the view gate lets through.
    await page.evaluate(() => {
      const editor = document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');

      // The trackers off and the store destroyed after: a peer that stays
      // connected would leave the rest of the test in another editor.
      const peer = editor.getSharedStore({
        mouseTracker: false,
        focusTracker: false,
      });
      peer.dispatch([
        {
          type: 'table.add',
          payload: { id: 'invoices', ui: { x: 4_000, y: 3_000 } },
          tags: 1,
        },
        {
          type: 'table.changeName',
          payload: { id: 'invoices', value: 'invoices' },
          tags: 1,
        },
      ] as any);
      peer.destroy();
    });

    await expect.poll(() => erd.tableIds()).toContain('invoices');
    await erd.whenDrawn();
    expect(await settledElkAsks(page)).toBe(1);

    await modeButton(erd, 'Tidy Up').click();
    await expect
      .poll(() => elkAsks(page), { timeout: PLACEMENT_TIMEOUT })
      .toBe(2);
    await expect(flowTable(erd, 'invoices')).toBeVisible();
    await erd.whenDrawn();

    const { invoices } = await placementsOf(erd, ['invoices']);
    expect(invoices).not.toBeNull();
    expect(invoices).not.toEqual({ x: 4_000, y: 3_000 });
  });

  test('stands the flow back on the layout elk gave it after a drag and a tab change', async ({
    erd,
    page,
  }) => {
    await countElkAsks(page);
    await erd.goto();
    await erd.seed(shop());
    await enterFlow(erd);

    const ids = ['customers', 'orders', 'products', 'order_items'];
    const placed = await placementsOf(erd, ids);

    // The header strip, since the middle of a name box is the name cell and a
    // drag never starts there.
    await erd.moveTable('customers', 180, 140);
    await erd.whenDrawn();
    await expect
      .poll(async () => (await placementsOf(erd, ['customers'])).customers)
      .not.toEqual(placed.customers);

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await erd.toolbarButton('Visualization').click();
    await expect(flowTable(erd, 'customers')).toBeVisible();
    await erd.whenDrawn();

    expect(await placementsOf(erd, ids)).toEqual(placed);
    expect(await elkAsks(page)).toBe(1);
    // The drag moved the view alone; the document keeps the corner it was seeded at.
    expect((await erd.table('customers')).ui).toMatchObject({ x: 200, y: 200 });
  });

  test('opens focus on the table a flow box is clicked on', async ({ erd }) => {
    await erd.seed(shop());
    await enterFlow(erd);

    await flowTable(erd, 'orders').click();
    await focusPlaced(erd, 'orders');

    await expect(focusCenters(erd)).toHaveText('orders');
    await expect(focusTable(erd, 'customers')).toBeVisible();
    await expect(focusTable(erd, 'order_items')).toBeVisible();
    await expect(focusTable(erd, 'addresses')).toHaveCount(0);
  });

  test('opens focus on the selected table with the chord, and on nothing with none selected', async ({
    erd,
  }) => {
    await erd.seed(shop());

    await erd.focusCanvas();
    await erd.press(Shortcut.focusView);
    await expect(focusBar(erd)).toHaveCount(0);

    await erd.clickTableHeader('orders');
    await erd.press(Shortcut.focusView);
    await focusPlaced(erd, 'orders');
    await expect(focusCenters(erd)).toHaveText('orders');
    await expect(erd.host.locator('.focus-neighbours')).toHaveText(
      '2 neighbours'
    );
  });

  test('opens the same view from the context menu and from quick search', async ({
    erd,
  }) => {
    await erd.seed(shop());

    await erd.clickAt(await erd.tableHeaderPoint('orders'), {
      button: 'right',
    });
    await erd.contextMenuItem('Focus on this table').click();
    await focusPlaced(erd, 'orders');
    await expect(focusCenters(erd)).toHaveText('orders');
    const fromMenu = await placementsOf(erd, ['orders', 'customers']);

    await erd.press(Shortcut.stop);
    await expect(focusBar(erd)).toHaveCount(0);

    await erd.press(Shortcut.search);
    const search = erd.host.locator('.quick-search');
    await expect(search).toBeVisible();
    await search.locator('input').fill('Focus on orders');
    await searchRow(erd, 'Focus on orders', 'Focus').click();

    await focusPlaced(erd, 'orders');
    await expect(focusCenters(erd)).toHaveText('orders');
    expect(await placementsOf(erd, ['orders', 'customers'])).toEqual(fromMenu);
  });

  test('stands on three centers when three tables are selected', async ({
    erd,
  }) => {
    await erd.seed(shop());

    await erd.clickTableHeader('customers');
    await erd.modClickAt(await erd.tableHeaderPoint('orders'));
    await erd.modClickAt(await erd.tableHeaderPoint('products'));
    await expect(erd.selectedTables()).toHaveCount(3);

    await erd.press(Shortcut.focusView);
    await focusPlaced(erd, 'customers');

    await expect(focusCenters(erd)).toHaveText('customers and 2 more');
    await expect(erd.host.locator('.focus-neighbours')).toHaveText(
      '2 neighbours'
    );
    await expect(focusScene(erd).locator('.table[data-id]')).toHaveCount(5);
  });

  test('walks orders to customers to addresses and leaves the reader standing on the last of them', async ({
    erd,
  }) => {
    await erd.seed(shop());
    const before = await erd.settings();

    await erd.clickTableHeader('orders');
    await erd.press(Shortcut.focusView);
    await focusPlaced(erd, 'orders');

    await focusTable(erd, 'customers').click();
    await expect(focusCenters(erd)).toHaveText('customers');
    await expect(focusTable(erd, 'addresses')).toBeVisible({
      timeout: PLACEMENT_TIMEOUT,
    });

    await focusTable(erd, 'addresses').click();
    await expect(focusCenters(erd)).toHaveText('addresses');
    await erd.whenDrawn();

    await erd.press(Shortcut.stop);
    await expect(focusBar(erd)).toHaveCount(0);
    await erd.whenDrawn();

    const after = await erd.settings();
    expect(after.canvasType).toBe('ERD');
    expect(after.zoomLevel).toBe(before.zoomLevel);

    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveAttribute('data-id', 'addresses');

    const box = await erd.sceneBox('#table-addresses');
    const viewport = erd.page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });

  test('says nothing to the host while the view is open, nor on the way out of one already on screen', async ({
    erd,
    page,
  }) => {
    await erd.seed(shop());
    await erd.clickTableHeader('customers');
    await countChanges(page);
    await recordActions(page);

    await erd.press(Shortcut.focusView);
    await focusPlaced(erd, 'customers');

    await erd.press(Shortcut.zoomIn);
    await erd.press(Shortcut.zoomIn);
    await erd.hoverScene('#table-orders');
    await erd.whenDrawn();
    expect(await settledChanges(page)).toBe(0);

    await erd.press(Shortcut.stop);
    await expect(focusBar(erd)).toHaveCount(0);
    expect(await settledChanges(page)).toBe(0);
    expect(await recordedChanges(page)).toEqual([]);

    const after = await erd.settings();
    expect(after.originX).toBe(0);
    expect(after.originY).toBe(0);
    expect(after.zoomLevel).toBe(1);
  });

  test('says one thing to the host on the way out to a center off screen, and it is the scroll', async ({
    erd,
    page,
  }) => {
    await erd.seed(shop());
    const before = await erd.settings();
    await countChanges(page);
    await recordActions(page);

    await erd.press(Shortcut.search);
    const search = erd.host.locator('.quick-search');
    await search.locator('input').fill('Focus on addresses');
    await searchRow(erd, 'Focus on addresses', 'Focus').click();
    await focusPlaced(erd, 'addresses');
    expect(await settledChanges(page)).toBe(0);

    await erd.press(Shortcut.stop);
    await expect(focusBar(erd)).toHaveCount(0);
    expect(await settledChanges(page)).toBe(1);
    // The one change by name, not by the origin moving under it: two actions
    // inside the debounce would leave the host hearing one all the same.
    expect(await recordedChanges(page)).toEqual(['settings.scrollTo']);

    const after = await erd.settings();
    expect(after.canvasType).toBe('ERD');
    expect(after.zoomLevel).toBe(before.zoomLevel);
    expect(after.originX).not.toBe(before.originX);
  });

  test('says one thing to the host on the way out of a flow, and it is the tab', async ({
    erd,
    page,
  }) => {
    await erd.seed(shop());
    await enterFlow(erd);
    await countChanges(page);
    await recordActions(page);

    await flowTable(erd, 'customers').click();
    await focusPlaced(erd, 'customers');
    expect(await settledChanges(page)).toBe(0);

    await erd.press(Shortcut.stop);
    await expect(focusBar(erd)).toHaveCount(0);
    expect(await settledChanges(page)).toBe(1);
    expect(await recordedChanges(page)).toEqual(['settings.changeCanvasType']);

    const after = await erd.settings();
    expect(after.canvasType).toBe('ERD');
    // Nothing scrolled: customers is on screen where the document keeps it, so
    // the one thing the host heard was the tab coming back.
    expect(after.originX).toBe(0);
    expect(after.originY).toBe(0);
  });

  test('jumps to a table in view coordinates from quick search, leaving the document origin where it was', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await erd.clickTableHeader('orders');
    await erd.press(Shortcut.focusView);
    await focusPlaced(erd, 'orders');

    const before = await erd.settings();
    const view = await sceneTransform(erd);

    await erd.press(Shortcut.search);
    const search = erd.host.locator('.quick-search');
    await search.locator('input').fill('customers');
    await searchRow(erd, 'customers', 'Table').click();
    await erd.whenDrawn();

    expect(await sceneTransform(erd)).not.toEqual(view);

    const after = await erd.settings();
    expect(after.originX).toBe(before.originX);
    expect(after.originY).toBe(before.originY);
    expect(after.zoomLevel).toBe(before.zoomLevel);
  });
});
