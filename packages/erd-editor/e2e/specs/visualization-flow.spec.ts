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

// The Visualization tab from the outside: which mode the tab stands in, what
// ELK is asked for, what an entry from the ERD narrows the view to, and what
// the host hears while a reader stands in that view over the document.

/**
 * ELK is megabytes of script the worker parses before it answers anything, and
 * every Flow entry waits on one.
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

/**
 * The tab's own scene while the Visualization tab stands in its Flow mode. The
 * ERD is cached out of the document by then, so the one canvas is the Flow's.
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

/** Waits for the Flow mode to be up, narrowed to the center, with a placement under it. */
async function flowPlaced(erd: ErdEditorPage, centerId: string) {
  await expect(modeButton(erd, 'Tidy Up')).toBeVisible({
    timeout: PLACEMENT_TIMEOUT,
  });
  await expect(flowTable(erd, centerId)).toBeVisible({
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

test.describe('the visualization tab and the flow view over the document', () => {
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

  test('places a table a peer adds while the flow stands, and asks once more for it', async ({
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
    // The placement the view stands on was computed over the document as it
    // was, so a table added to it is a placement gone stale and the tab asks
    // again over the document it has now.
    await expect
      .poll(() => elkAsks(page), { timeout: PLACEMENT_TIMEOUT })
      .toBe(2);
    await erd.whenDrawn();

    await modeButton(erd, 'Tidy Up').click();
    await expect
      .poll(() => elkAsks(page), { timeout: PLACEMENT_TIMEOUT })
      .toBe(3);
    await expect(flowTable(erd, 'invoices')).toBeVisible();
    await erd.whenDrawn();

    const { invoices } = await placementsOf(erd, ['invoices']);
    expect(invoices).not.toBeNull();
    expect(invoices).not.toEqual({ x: 4_000, y: 3_000 });
    expect(await settledElkAsks(page)).toBe(3);
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

  /**
   * AC-39, AC-40, AC-41. The mirror of the ERD tab's own wheel case: the view
   * reads a wheel the way the document does, and the document stands still
   * through all three of them.
   */
  test('moves the flow view on a wheel, swaps the axis on shift and zooms it on the modifier', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await enterFlow(erd);
    const document = await erd.settings();
    const at = (await placementsOf(erd, ['customers'])).customers!;
    const fitted = (await flowTable(erd, 'customers').boundingBox())!;

    // The zoom first, while the fit still holds every box on the screen: the
    // pans below carry the point this notch is delivered over off it.
    const modKey = await erd.pointerModKey();
    await erd.wheel(-120, { at, modifiers: [modKey] });
    await erd.whenDrawn();

    await expect
      .poll(
        async () => (await flowTable(erd, 'customers').boundingBox())!.width
      )
      .toBeGreaterThan(fitted.width);

    const zoomed = (await flowTable(erd, 'customers').boundingBox())!;
    await erd.wheel(200, { at });
    await erd.whenDrawn();

    const movedY = (await flowTable(erd, 'customers').boundingBox())!;
    expect(movedY.y).toBeLessThan(zoomed.y);
    expect(movedY.x).toBeCloseTo(zoomed.x, 0);

    await erd.wheel(200, { at, modifiers: ['Shift'] });
    await erd.whenDrawn();

    const movedX = (await flowTable(erd, 'customers').boundingBox())!;
    expect(movedX.x).toBeLessThan(movedY.x);
    expect(movedX.y).toBeCloseTo(movedY.y, 0);

    expect(await erd.settings()).toMatchObject({
      originX: document.originX,
      originY: document.originY,
      zoomLevel: document.zoomLevel,
    });
  });

  /** AC-44. The body click pins the highlight; it never narrows what the view shows. */
  test('leaves the display set alone on a click of a flow box', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await enterFlow(erd);
    const before = await placementsOf(erd, ['customers', 'orders']);

    await flowTable(erd, 'orders').click();
    await erd.whenDrawn();

    await expect(flowTable(erd, 'addresses')).toBeVisible();
    await expect(flowTable(erd, 'products')).toBeVisible();
    expect(await placementsOf(erd, ['customers', 'orders'])).toEqual(before);
  });

  /** AC-51. The chord stands the tab in Flow, narrowed to the selection. */
  test('stands the flow on the selected table with the chord, and on nothing with none selected', async ({
    erd,
  }) => {
    await erd.seed(shop());

    await erd.focusCanvas();
    await erd.press(Shortcut.focusView);
    await expect(modeButton(erd, 'Tidy Up')).toHaveCount(0);
    expect((await erd.settings()).canvasType).toBe('ERD');

    await erd.clickTableHeader('orders');
    await erd.press(Shortcut.focusView);
    await flowPlaced(erd, 'orders');

    expect((await erd.settings()).canvasType).toContain('visualization');
    await expect(flowTable(erd, 'customers')).toBeVisible();
    await expect(flowTable(erd, 'order_items')).toBeVisible();
    await expect(flowTable(erd, 'addresses')).toHaveCount(0);
  });

  /** AC-51. The context menu is the second handle, and it lands the same view. */
  test('stands the same view from the context menu', async ({ erd, page }) => {
    await countElkAsks(page);
    await erd.goto();
    await erd.seed(shop());

    await erd.clickAt(await erd.tableHeaderPoint('orders'), {
      button: 'right',
    });
    await erd.contextMenuItem('Focus on this table').click();
    await flowPlaced(erd, 'orders');

    await expect(flowTable(erd, 'customers')).toBeVisible();
    await expect(flowTable(erd, 'addresses')).toHaveCount(0);
    // The narrowed display set is what the one ask carried, not the document.
    expect(await settledElkAsks(page)).toBe(1);
  });

  /** AC-59. Every selected table comes in as a center, and the union is what it shows. */
  test('stands on three centers when three tables are selected', async ({
    erd,
  }) => {
    await erd.seed(shop());

    await erd.clickTableHeader('customers');
    await erd.modClickAt(await erd.tableHeaderPoint('orders'));
    await erd.modClickAt(await erd.tableHeaderPoint('products'));
    await expect(erd.selectedTables()).toHaveCount(3);

    await erd.press(Shortcut.focusView);
    await flowPlaced(erd, 'customers');

    await expect(flowScene(erd).locator('.table[data-id]')).toHaveCount(5);
  });

  /** AC-45. The Related button narrows the display set to one table and its hop. */
  test('narrows the flow to one table and its hop from the Related button', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await enterFlow(erd);

    await flowTable(erd, 'orders').hover();
    await flowScene(erd)
      .locator('.table[data-id="orders"] .table-related')
      .click();
    await erd.whenDrawn();

    // orders reaches customers and order_items; products and addresses are
    // each two hops out and leave the display set with the narrowing.
    await expect(flowTable(erd, 'customers')).toBeVisible({
      timeout: PLACEMENT_TIMEOUT,
    });
    await expect(flowTable(erd, 'order_items')).toBeVisible();
    await expect(flowTable(erd, 'products')).toHaveCount(0);
    await expect(flowTable(erd, 'addresses')).toHaveCount(0);
  });

  /** AC-48. The Go to ERD button leaves for the ERD tab, standing on that table. */
  test('leaves for the ERD tab on the Go to ERD button, scrolled to that table', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await enterFlow(erd);
    const before = await erd.settings();

    await flowTable(erd, 'addresses').hover();
    await flowScene(erd)
      .locator('.table[data-id="addresses"] .table-go-to-erd')
      .click();

    await expect
      .poll(async () => (await erd.settings()).canvasType)
      .toBe('ERD');
    await erd.whenDrawn();

    // The document keeps addresses far outside the screen the runner opens
    // with, so the way out scrolls to it and selects it there.
    const after = await erd.settings();
    expect(after.originX).not.toBe(before.originX);
    expect(after.originY).not.toBe(before.originY);
    await expect(erd.selectedTables()).toHaveCount(1);
  });

  /** AC-60. Nothing a reader does inside the view reaches the host. */
  test('says nothing to the host while the reader stands in the view', async ({
    erd,
    page,
  }) => {
    await erd.seed(shop());
    await erd.clickTableHeader('customers');
    await countChanges(page);
    await recordActions(page);

    await erd.press(Shortcut.focusView);
    await flowPlaced(erd, 'customers');

    await flowTable(erd, 'orders').hover();
    await flowTable(erd, 'orders').click();
    await erd.whenDrawn();

    // The tab coming up is the one thing the host hears; the hover, the pin
    // and the placement inside the view reach it not at all.
    expect(await settledChanges(page)).toBe(1);
    expect(await recordedChanges(page)).toEqual(['settings.changeCanvasType']);

    const after = await erd.settings();
    expect(after.originX).toBe(0);
    expect(after.originY).toBe(0);
    expect(after.zoomLevel).toBe(1);
  });
});
