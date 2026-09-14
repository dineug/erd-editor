import { expect, test } from '../support/fixtures';
import { type ErdEditorPage, type Point } from '../support/ErdEditorPage';
import { ColumnOption, ColumnUIKey, createSchema } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// AC-I10. The preview is drawn on the scene layer, in canvas units, from a
// pointer the editor reads off the dom root. The two coordinate systems have to
// agree on every frame or the dashed line trails the cursor.

/** The end of the preview path, in canvas units, as the scene node holds it. */
async function previewEnd(erd: ErdEditorPage): Promise<Point> {
  const data = await erd.sceneAttr(
    ['#draw-relationship', '.draw-relationship-preview'],
    'data'
  );
  const match = /L\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(String(data));
  if (!match) throw new Error(`no line end in path data: ${String(data)}`);

  return { x: Number(match[1]), y: Number(match[2]) };
}

function twoTablesAt(zoomLevel: number, scrollLeft = 0, scrollTop = 0) {
  return createSchema({
    zoomLevel,
    scrollLeft,
    scrollTop,
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 300,
        y: 260,
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 1000,
        y: 700,
        columns: [{ id: 'posts_id', name: 'id', dataType: 'int' }],
      },
    ],
  });
}

/**
 * Starts keeping the line end of every preview the scene layer paints, read as
 * the layer finishes drawing, so a frame no attr read happens to catch counts too.
 */
async function recordPaintedEnds(erd: ErdEditorPage) {
  await erd.page.evaluate(() => {
    const layer = Reflect.get(window, '__erdStages')?.canvas.findOne('.scene');
    const ends: string[] = [];
    Reflect.set(window, '__paintedEnds', ends);

    layer.on('draw.paintedEnds', () => {
      const node = layer.findOne('.draw-relationship-preview');
      if (!node?.isVisible()) return;

      const match = /L\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(
        node.getAttr('data')
      );
      ends.push(
        match ? `${Math.round(+match[1])},${Math.round(+match[2])}` : ''
      );
    });
  });
}

/** The line ends recordPaintedEnds has kept, one per painted frame, as x,y. */
async function paintedEnds(erd: ErdEditorPage): Promise<string[]> {
  return erd.page.evaluate(() => Reflect.get(window, '__paintedEnds'));
}

/** A header point on the pixel grid, the only place a browser delivers a pointer. */
async function headerAim(erd: ErdEditorPage, id: string): Promise<Point> {
  const header = await erd.tableHeaderPoint(id);
  return { x: Math.round(header.x), y: Math.round(header.y) };
}

/** Arms a draw and picks the start table, leaving the preview in flight. */
async function startDraw(erd: ErdEditorPage) {
  await erd.focusCanvas();
  await erd.press(Shortcut.relationshipOneN);
  await erd.clickTableHeader('users');
  await expect(erd.drawPreview).toBeVisible();
}

test.describe('relationship draw preview', () => {
  test('the preview ends exactly where the pointer is', async ({ erd }) => {
    await erd.seed(twoTablesAt(1));
    await startDraw(erd);

    for (const point of [
      { x: 900, y: 620 },
      { x: 1180, y: 200 },
      { x: 420, y: 780 },
    ]) {
      await erd.hoverAt(await erd.pointAt(point.x, point.y));

      await expect
        .poll(async () => {
          const end = await previewEnd(erd);
          return [Math.round(end.x), Math.round(end.y)];
        })
        .toEqual([point.x, point.y]);
    }
  });

  test('the preview still lands on the pointer under zoom and scroll', async ({
    erd,
  }) => {
    await erd.seed(twoTablesAt(0.8, -120, -60));
    await startDraw(erd);

    // The pointer is placed through the scene transform, so a preview that
    // followed screen pixels instead of canvas units misses by the zoom.
    for (const point of [
      { x: 950, y: 700 },
      { x: 1250, y: 260 },
    ]) {
      await erd.hoverAt(await erd.pointAt(point.x, point.y));

      await expect
        .poll(async () => {
          const end = await previewEnd(erd);
          return [Math.round(end.x), Math.round(end.y)];
        })
        .toEqual([point.x, point.y]);
    }
  });

  test('the preview keeps following over a table and closes on it', async ({
    erd,
  }) => {
    await erd.seed(twoTablesAt(1));
    await startDraw(erd);

    const header = await erd.tableHeaderPoint('posts');
    // Whole pixels, because the browser delivers a pointer on the pixel grid
    // and half a header width does not always land on one.
    const aim = { x: Math.round(header.x), y: Math.round(header.y) };
    await erd.hoverAt(aim);

    // The preview takes no hit test of its own, so lying over the target table
    // neither stops it tracking nor swallows the click that closes the draw.
    const overTable = await previewEnd(erd);
    const expected = await erd.pointAt(0, 0);
    expect(overTable.x).toBeCloseTo(aim.x - expected.x, 0);
    expect(overTable.y).toBeCloseTo(aim.y - expected.y, 0);

    await erd.clickTableHeader('posts');

    await expect(erd.drawPreview).toHaveCount(0);
    expect(await erd.relationshipIds()).toHaveLength(1);
  });

  test('the first preview painted already ends at the press', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTablesAt(1));
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipOneN);

    const aim = await headerAim(erd, 'users');
    await erd.hoverAt(aim);
    await recordPaintedEnds(erd);

    // A still hand: the press mounts the preview and no move follows it, so
    // the end it is drawn with can only have come from the press itself.
    await page.mouse.down();
    await page.mouse.up();
    await erd.whenDrawn();

    const origin = await erd.pointAt(0, 0);
    const pressed = [aim.x - origin.x, aim.y - origin.y];
    const end = await previewEnd(erd);
    expect([Math.round(end.x), Math.round(end.y)]).toEqual(pressed);

    const ends = await paintedEnds(erd);
    expect(ends.length).toBeGreaterThan(0);
    expect(new Set(ends)).toEqual(new Set([pressed.join(',')]));
  });
});

test.describe('relationship draw preview under touch', () => {
  test.use({ hasTouch: true });

  test('a draw a tap started points at the tap, not the origin', async ({
    erd,
  }) => {
    await erd.seed(twoTablesAt(1));
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipOneN);

    // A tap sends no mousemove, and the preview follows nothing else, so the
    // end it takes at the press is the one it keeps until the second tap.
    const aim = await headerAim(erd, 'users');
    await erd.touchStart(aim);
    await erd.touchEnd();
    await expect(erd.drawPreview).toBeVisible();
    await erd.whenDrawn();

    const origin = await erd.pointAt(0, 0);
    const end = await previewEnd(erd);
    expect([Math.round(end.x), Math.round(end.y)]).toEqual([
      aim.x - origin.x,
      aim.y - origin.y,
    ]);
  });
});
