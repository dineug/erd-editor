import { expect, test } from '@playwright/test';

import { expectSameValues, resetRoom, RoomClient } from '../support/room';

/**
 * The room through a real relay and real providers: three pages and the
 * compactor, a Node client of its own, each holding its own Y.Doc, which only
 * the relay's sync and presence messages join.
 */
test.describe('a room over a websocket relay', () => {
  test.beforeEach(async ({ request }) => {
    await resetRoom(request);
  });

  test('AC-A8 a client cut off while the compactor folds, a late joiner and a cursor all end alike', async ({
    context,
    page,
  }) => {
    const a = await RoomClient.open(page, 'A');
    expect(await a.seed()).toBe(true);
    const first = await a.addTable();
    // Installed before any cursor arrives, so the stage that draws one is caught.
    expect(await a.cursorLabels()).toEqual([]);

    const b = await RoomClient.open(await context.newPage(), 'B');
    await expect.poll(() => b.tableIds()).toEqual([first]);
    expect(await a.seed()).toBe(false);

    await b.disconnect();
    const generation = await a.generation();
    await b.addTable();
    for (let added = 0; added < 3; added++) await a.addTable();
    await expect.poll(() => a.generation()).toBeGreaterThan(generation);
    expect(await b.generation()).toBe(generation);

    await b.connect();
    await expect.poll(async () => (await b.tableIds()).length).toBe(5);
    await expectSameValues([a, b]);

    const c = await RoomClient.open(await context.newPage(), 'C');
    await expectSameValues([a, b, c]);

    await b.moveMouse();
    await expect.poll(() => a.cursorLabels()).toContain('B');
    await b.page.close();
    await expect.poll(() => a.cursorLabels()).not.toContain('B');

    expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  });
});
