import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  createSchema,
  RelationshipType,
} from '../support/schema';

// The dom scene painted the canvas colour on a document sized box and let the
// boundary colour of the editor show around it. The stage container is the
// screen now, so this is what says the document still ends somewhere.

type Point = { x: number; y: number };

/** A zoom that leaves the 2000px document box well inside a 1440x900 screen. */
const ZOOM = 0.2;

/**
 * Puts the document's own origin 300px into the canvas container on both axes:
 * getSceneOrigin is the scroll plus half the shrink of the box.
 */
const SCROLL = 300 - (2000 - 2000 * ZOOM) / 2;

const seed = () =>
  createSchema({
    zoomLevel: ZOOM,
    scrollLeft: SCROLL,
    scrollTop: SCROLL,
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 1200,
        y: 1200,
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          },
        ],
      },
    ],
  });

/**
 * Two connected tables at the default zoom, so a header drag opens the layers a
 * move splits the scene into and the moving connector has somewhere to go.
 */
const connectedSeed = () =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 200,
        y: 200,
        columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 800,
        y: 460,
        columns: [{ id: 'posts_user_id', name: 'user_id', dataType: 'int' }],
      },
    ],
    relationships: [
      {
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
      },
    ],
  });

/**
 * The colours of the composited page at the given viewport points. A screenshot
 * is the only reading that carries both the canvas and the dom under it, which
 * is exactly the pair this file is about.
 */
async function pixelsAt(page: Page, points: Point[]): Promise<string[]> {
  const shot = await page.screenshot({ type: 'png' });

  return page.evaluate(
    async ({ dataUrl, points }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);

      return points.map(({ x, y }) => {
        const [r, g, b] = context.getImageData(
          Math.round(x),
          Math.round(y),
          1,
          1
        ).data;
        return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
      });
    },
    { dataUrl: `data:image/png;base64,${shot.toString('base64')}`, points }
  );
}

/** The canvas colour the scene paints with and the boundary colour behind it. */
async function palette(page: Page) {
  return page.evaluate(() => {
    // Every css colour spelling settles on one #rrggbb here, which is what
    // lets a theme token be compared to a pixel read out of a screenshot.
    const toHex = (color: string) => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.fillStyle = '#000000';
      context.fillStyle = color;
      return context.fillStyle as string;
    };
    const host = document.querySelector('erd-editor')!;
    const style = getComputedStyle(host);
    const shell = host.shadowRoot!.querySelector<HTMLElement>(
      '[data-testid="erd-canvas"]'
    )!;
    const stage = Reflect.get(window, '__erdStages')?.canvas;
    const rect = stage?.findOne('.canvas-background')?.getChildren()[0];

    return {
      canvas: toHex(style.getPropertyValue('--canvas-background').trim()),
      boundary: toHex(
        style.getPropertyValue('--canvas-boundary-background').trim()
      ),
      fill: toHex(rect?.getAttr('fill') ?? ''),
      shellBackground: getComputedStyle(shell).backgroundColor,
      layers: stage ? stage.getLayers().map((layer: any) => layer.name()) : [],
    };
  });
}

/** The document box as konva drew it, in viewport coordinates. */
async function documentBox(page: Page) {
  const handle = await page.waitForFunction(() => {
    const stage = Reflect.get(window, '__erdStages')?.canvas;
    const rect = stage?.findOne('.canvas-background')?.getChildren()[0];
    if (!rect) return null;

    const box = rect.getClientRect({ relativeTo: stage });
    const origin = stage.container().getBoundingClientRect();
    return {
      x: origin.x + box.x,
      y: origin.y + box.y,
      width: box.width,
      height: box.height,
    };
  });

  const box = await handle.jsonValue();
  if (!box) throw new Error('the canvas background layer is not on the stage');

  return box;
}

test.describe('the canvas boundary', () => {
  test('paints the document box and leaves the boundary colour outside it', async ({
    erd,
  }) => {
    await erd.seed(seed());
    const { canvas, boundary, fill, layers } = await palette(erd.page);

    expect(layers[0]).toBe('canvas-background');
    expect(fill).toBe(canvas);
    expect(canvas).not.toBe(boundary);

    const corner = await erd.pointAt(0, 0);
    const [inside, outside, leftOf, above] = await pixelsAt(erd.page, [
      { x: corner.x + 12, y: corner.y + 12 },
      { x: corner.x - 12, y: corner.y - 12 },
      { x: corner.x - 12, y: corner.y + 12 },
      { x: corner.x + 12, y: corner.y - 12 },
    ]);

    expect(inside).toBe(canvas);
    expect(outside).toBe(boundary);
    expect(leftOf).toBe(boundary);
    expect(above).toBe(boundary);
    expect(inside).not.toBe(outside);
  });

  test('draws that box exactly where the scene transform puts the document', async ({
    erd,
  }) => {
    await erd.seed(seed());
    const settings = await erd.settings();

    const topLeft = await erd.pointAt(0, 0);
    const bottomRight = await erd.pointAt(settings.width, settings.height);
    const box = await documentBox(erd.page);

    expect(box.x).toBeCloseTo(topLeft.x, 1);
    expect(box.y).toBeCloseTo(topLeft.y, 1);
    expect(box.x + box.width).toBeCloseTo(bottomRight.x, 1);
    expect(box.y + box.height).toBeCloseTo(bottomRight.y, 1);
    expect(box.width).toBeCloseTo(settings.width * settings.zoomLevel, 1);
  });

  /**
   * The container is the screen. Painting the canvas colour on it would put
   * that colour over the whole viewport, which is what made the document box
   * and everything around it one flat surface.
   */
  test('leaves the stage container itself unpainted', async ({ erd }) => {
    await erd.seed(seed());
    const { shellBackground } = await palette(erd.page);

    expect(shellBackground).toBe('rgba(0, 0, 0, 0)');
  });

  /**
   * Konva warns past five layers on a stage and a drag opens one of its own, so
   * the document box shares the layer the moving connectors already needed to
   * be on: below the static scene, above nothing.
   */
  test('costs the drag no layer of its own', async ({ erd }) => {
    const warnings: string[] = [];
    erd.page.on('console', message => {
      if (message.text().includes('Recommended maximum number of layers')) {
        warnings.push(message.text());
      }
    });

    await erd.seed(connectedSeed());
    const from = await erd.tableHeaderPoint('users');

    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();
    for (let step = 1; step <= 6; step++) {
      await erd.page.mouse.move(from.x + step * 10, from.y + step * 6);
    }

    const midDrag = await erd.page.evaluate(() => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      const bottom = stage?.findOne('.canvas-background');
      return {
        layers: stage.getLayers().map((layer: any) => layer.name()),
        movingConnectors: bottom ? bottom.find('.relationship').length : -1,
      };
    });

    await erd.page.mouse.up();

    expect(midDrag.layers).toContain('drag-entity');
    expect(midDrag.layers[0]).toBe('canvas-background');
    expect(midDrag.layers.length).toBeLessThanOrEqual(5);
    expect(midDrag.movingConnectors).toBe(1);
    expect(warnings).toEqual([]);
  });
});
