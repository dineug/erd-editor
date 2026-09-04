import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

/**
 * Collaborative presence through the real transport: a second editor on the
 * page, cross-wired to the first. What only a real pair shows is that a burst of
 * focus changes leaves the peer on the cell the user actually stopped on.
 */
const PEER = '#peer erd-editor';
const LOCAL = '#app erd-editor';

/**
 * The peer registers its canvas under the same name as the local one, and the
 * registry hands out the newest claim, so the local Stage is kept aside here
 * before the peer mounts for the cursor cases to read it back.
 */
const LOCAL_CANVAS = '__erdLocalCanvas';

async function attachPeer(page: Page) {
  await page.evaluate(async localCanvas => {
    Reflect.set(window, localCanvas, Reflect.get(window, '__erdStages').canvas);

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
  }, LOCAL_CANVAS);
}

type Box = { x: number; y: number; width: number; height: number };

type Point = { x: number; y: number };

/**
 * A client rect read off the element itself. The peer host is visibility
 * hidden, which keeps its layout and is what a boundingBox call refuses.
 */
const rectOf = (locator: Locator): Promise<Box> =>
  locator.evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });

const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

const canvasOf = (page: Page, editor: string) =>
  page.locator(editor).locator('[data-testid="erd-canvas"]');

/**
 * A point in one editor's box of a table, read onto the scene by where it
 * falls between the box edges. The box scales uniformly with the zoom, which
 * is what makes the same fraction of it the same scene point on both sides.
 */
const boxToScene = (box: Box, point: Point, scene: Box): Point => ({
  x: scene.x + ((point.x - box.x) / box.width) * scene.width,
  y: scene.y + ((point.y - box.y) / box.height) * scene.height,
});

/** The reading above run backwards: where a scene point falls in a box. */
const sceneToBox = (box: Box, point: Point, scene: Box): Point => ({
  x: box.x + ((point.x - scene.x) / scene.width) * box.width,
  y: box.y + ((point.y - scene.y) / scene.height) * box.height,
});

/** The few fields a synthetic pointer or wheel event here carries. */
type PointerInit = {
  clientX?: number;
  clientY?: number;
  deltaX?: number;
  deltaY?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

/**
 * A synthetic pointer or wheel event on an editor's canvas box. It bubbles to
 * the shell that publishes the pointer and reads the wheel, and it passes no
 * mirror element on the way, so the coordinates arrive as given.
 */
function dispatchOnCanvas(
  page: Page,
  editor: string,
  type: 'mousemove' | 'wheel',
  init: PointerInit
) {
  return page.evaluate(
    ({ editor, type, init }) => {
      const host = document.querySelector<HTMLElement>(editor)!;
      const canvas = host.shadowRoot!.querySelector(
        '[data-testid="erd-canvas"]'
      ) as HTMLElement;
      const options = { bubbles: true, cancelable: true, ...init };

      canvas.dispatchEvent(
        type === 'wheel'
          ? new WheelEvent(type, options)
          : new MouseEvent(type, options)
      );
    },
    { editor, type, init }
  );
}

/** One notch of a zoom wheel, held with both keys so either platform reads it. */
const zoomWheel = (page: Page, editor: string, deltaY: number) =>
  dispatchOnCanvas(page, editor, 'wheel', {
    deltaY,
    ctrlKey: true,
    metaKey: true,
  });

const peerSettings = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(document.querySelector<any>('#peer erd-editor').value)
        .settings as {
        zoomLevel: number;
        scrollLeft: number;
        scrollTop: number;
      }
  );

type DrawnCursor = { x: number; y: number; screenX: number; screenY: number };

/**
 * The peer's cursor as the local scene holds it: the scene point the group
 * sits at, and where that point lands on the local screen once the presence
 * layer's transform and the canvas origin are applied.
 */
const localCursor = (page: Page): Promise<DrawnCursor | null> =>
  page.evaluate(localCanvas => {
    const stage = Reflect.get(window, localCanvas);
    const node = stage?.findOne('.shared-mouse-cursor');
    if (!node) return null;

    const origin = stage.container().getBoundingClientRect();
    const absolute = node.getAbsolutePosition();
    return {
      x: node.x(),
      y: node.y(),
      screenX: origin.x + absolute.x,
      screenY: origin.y + absolute.y,
    };
  }, LOCAL_CANVAS);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

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

  test('a peer pointer is drawn at the point it shares, and eases onto the next', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    const canvas = await rectOf(canvasOf(page, PEER));
    await dispatchOnCanvas(page, PEER, 'mousemove', {
      clientX: canvas.x + 300,
      clientY: canvas.y + 200,
    });

    const cursor = page.locator(LOCAL).locator('.shared-mouse-cursor');
    await expect(cursor).toHaveCount(1);
    await expect(cursor.locator('.shared-mouse-cursor-nickname')).toHaveText(
      'user'
    );
    await expect(
      page.locator(PEER).locator('.shared-mouse-cursor')
    ).toHaveCount(0);

    // Both editors are at rest, so the scene point is the pointer less the
    // canvas origin, and a first position is taken as it is: there is nothing
    // yet to ease from.
    const drawn = (await localCursor(page)) as DrawnCursor;
    expect(drawn.x).toBeCloseTo(300, 5);
    expect(drawn.y).toBeCloseTo(200, 5);

    await dispatchOnCanvas(page, PEER, 'mousemove', {
      clientX: canvas.x + 500,
      clientY: canvas.y + 350,
    });

    // A twentieth of the way each frame, so the cursor arrives over a couple
    // of seconds rather than at once.
    await expect
      .poll(async () => {
        const next = await localCursor(page);
        return next ? distance(next, { x: 500, y: 350 }) : Infinity;
      })
      .toBeLessThan(0.5);
  });

  test('a peer pointing at a table is drawn on that table, whatever zoom and scroll each side is at', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await attachPeer(page);

    // At rest here, a mirror box is the scene box moved by the canvas origin
    // alone, which is the one reading of the table's scene box the case needs.
    const localCanvas = await rectOf(canvasOf(page, LOCAL));
    const localTable = page.locator(LOCAL).locator('.table[data-id="users"]');
    const atRest = await rectOf(localTable);
    const scene: Box = {
      ...atRest,
      x: atRest.x - localCanvas.x,
      y: atRest.y - localCanvas.y,
    };

    // The peer zooms out and scrolls away, so a screen point over there names
    // a different scene point than the same screen point does here.
    for (let i = 0; i < 10; i++) await zoomWheel(page, PEER, 100);
    for (let i = 0; i < 2; i++) {
      await dispatchOnCanvas(page, PEER, 'wheel', { deltaX: 120, deltaY: 80 });
    }
    await expect
      .poll(async () => (await peerSettings(page)).zoomLevel)
      .toBeLessThan(0.75);
    await expect
      .poll(async () => (await peerSettings(page)).scrollTop)
      .toBeLessThan(0);

    // A synthetic event keeps whole client px, so the aim is rounded first and
    // the scene point it names is read off the peer's own box of the table.
    const peerTable = await rectOf(
      page.locator(PEER).locator('.table[data-id="users"]')
    );
    const centre = centreOf(peerTable);
    const aim = { x: Math.round(centre.x), y: Math.round(centre.y) };
    const expected = boxToScene(peerTable, aim, scene);
    await dispatchOnCanvas(page, PEER, 'mousemove', {
      clientX: aim.x,
      clientY: aim.y,
    });

    await expect
      .poll(async () => {
        const drawn = await localCursor(page);
        return drawn ? distance(drawn, expected) : Infinity;
      })
      .toBeLessThan(0.1);

    // Then this side zooms in. The cursor keeps its scene point, so on screen
    // it stays at the same place on the table here as well.
    for (let i = 0; i < 5; i++) await zoomWheel(page, LOCAL, -100);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeGreaterThan(1.1);
    await expect
      .poll(async () => {
        const drawn = await localCursor(page);
        const onScreen = sceneToBox(await rectOf(localTable), expected, scene);
        return drawn
          ? distance({ x: drawn.screenX, y: drawn.screenY }, onScreen)
          : Infinity;
      })
      .toBeLessThan(0.1);
  });
});
