import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

/**
 * Collaborative presence through the real transport: a second editor on the
 * page, cross-wired to the first. What only a real pair shows is that a burst of
 * focus changes leaves the peer on the cell the user actually stopped on.
 */
const PEER = '#peer erd-editor';
const LOCAL = '#app erd-editor';

async function attachPeer(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const local = document.querySelector('erd-editor')!;
    const host = document.createElement('div');
    host.id = 'peer';
    host.setAttribute(
      'style',
      'position:fixed;left:0;top:0;width:900px;height:600px;visibility:hidden'
    );
    document.body.appendChild(host);

    const peer = document.createElement('erd-editor');
    peer.systemDarkMode = false;
    peer.setAttribute('style', 'display:block;width:100%;height:100%');
    host.appendChild(peer);
    peer.setInitialValue(local.value);

    const local$ = local.getSharedStore();
    const peer$ = peer.getSharedStore();
    local$.subscribe(actions => peer$.dispatch(actions));
    peer$.subscribe(actions => local$.dispatch(actions));
  });
}

test.describe('shared presence', () => {
  test('a peer focus outlines the table and underlines the cell', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    const peerCell = page
      .locator(PEER)
      .locator('[data-testid="erd-canvas"] .table')
      .first()
      .locator('.column-col[data-type="columnName"]')
      .first();
    await peerCell.dispatchEvent('mousedown');

    const marked = page
      .locator(LOCAL)
      .locator('[data-testid="erd-canvas"] .table[data-shared-focus]');
    await expect(marked).toHaveCount(1);
    await expect(marked.locator('.column-col[data-shared-focus]')).toHaveCount(
      1
    );

    await page
      .locator(PEER)
      .locator('[data-testid="erd-canvas"]')
      .dispatchEvent('mousedown');
    await expect(
      page.locator(LOCAL).locator('[data-shared-focus]')
    ).toHaveCount(0);
  });

  test('the last focus of a burst is the one the peer ends up showing', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    const cells = page
      .locator(PEER)
      .locator('[data-testid="erd-canvas"] .table')
      .first()
      .locator('.column-col[data-type="columnName"]');
    const count = await cells.count();
    expect(count).toBeGreaterThan(1);

    // Faster than the 100ms shared-stream window, so every step but the last is
    // compressed away.
    for (let index = 0; index < count; index++) {
      await cells.nth(index).dispatchEvent('mousedown');
      await page.waitForTimeout(30);
    }
    const expected = (await cells.nth(count - 1).textContent())?.trim();

    await expect(
      page
        .locator(LOCAL)
        .locator('[data-testid="erd-canvas"] .column-col[data-shared-focus]')
    ).toHaveText(expected!);
  });

  test('a peer multi-select rings every table it holds', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    await page.evaluate(() => {
      const peer = document.querySelector<HTMLElement>('#peer erd-editor')!;
      const tables = [
        ...peer.shadowRoot!.querySelectorAll<HTMLElement>(
          '[data-testid="erd-canvas"] .table'
        ),
      ];

      tables.forEach((table, index) =>
        table.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            metaKey: index > 0,
            ctrlKey: index > 0,
          })
        )
      );
    });

    const rung = page
      .locator(LOCAL)
      .locator('[data-testid="erd-canvas"] .table[data-shared-select]');
    await expect(rung).toHaveCount(2);

    const colors = await rung.evaluateAll(elements =>
      elements.map(el =>
        (el as HTMLElement).style.getPropertyValue('--shared-select')
      )
    );
    expect(new Set(colors).size).toBe(1);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('a peer drag box is drawn while the drag is live and gone after it ends', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    const drag = (type: string, x: number, y: number) =>
      page.evaluate(
        ({ type, x, y }) => {
          const peer = document.querySelector<HTMLElement>('#peer erd-editor')!;
          const canvas = peer.shadowRoot!.querySelector(
            '[data-testid="erd-canvas"]'
          ) as HTMLElement;
          canvas.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              clientX: x,
              clientY: y,
              metaKey: true,
              ctrlKey: true,
            })
          );
        },
        { type, x, y }
      );

    await drag('mousedown', 40, 40);
    await drag('mousemove', 600, 400);

    const box = page
      .locator(LOCAL)
      .locator('[data-testid="shared-drag-select"]');
    await expect(box).toHaveCount(1);
    await expect(box).toHaveAttribute('style', /stroke: /);

    await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    await expect(box).toHaveCount(0);
  });
});
