import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import {
  createDocumentPng,
  type ResolutionReduction,
} from '@/services/export-png';
import { CANVAS_SIDE_MAX } from '@/services/export-png/pixelRatio';
import type { Theme } from '@/themes/tokens';

const CANVAS = 2000;

const FAR_X = 1500;

const FAR_Y = 1500;

const meta = () => ({ updateAt: 0, createAt: 0 });

const toWidth = (text: string) => text.length * 7 + 2;

type Placement = {
  scrollLeft?: number;
  scrollTop?: number;
  zoomLevel?: number;
};

/**
 * One table far past the corner of any viewport a test window has. Everything
 * else is the schema default, so what a case varies is only the placement the
 * editor happens to be looking at the document through.
 */
function createDoc({
  scrollLeft = 0,
  scrollTop = 0,
  zoomLevel = 1,
}: Placement = {}) {
  return JSON.stringify({
    version: '3.0.0',
    settings: {
      width: CANVAS,
      height: CANVAS,
      scrollLeft,
      scrollTop,
      zoomLevel,
      databaseName: 'export',
    },
    doc: {
      tableIds: ['t-far'],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    },
    collections: {
      tableEntities: {
        't-far': {
          id: 't-far',
          name: 'far_away',
          comment: '',
          columnIds: [],
          seqColumnIds: [],
          ui: {
            x: FAR_X,
            y: FAR_Y,
            zIndex: 2,
            widthName: 60,
            widthComment: 60,
            color: '',
          },
          meta: meta(),
        },
      },
      tableColumnEntities: {},
      relationshipEntities: {},
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {},
    },
  });
}

type Decoded = {
  width: number;
  height: number;
  at: (x: number, y: number) => string;
};

async function decode(blob: Blob): Promise<Decoded> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.drawImage(bitmap, 0, 0);

  return {
    width: bitmap.width,
    height: bitmap.height,
    at: (x, y) => {
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    },
  };
}

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** CANVAS_SIZE_MIN by CANVAS_SIZE_MAX: the tallest box the schema will hold. */
const TALL_WIDTH = 2000;

const TALL_HEIGHT = 20_000;

const TALL_MEMO = { x: 400, y: 18_000, width: 1200, height: 1200 };

/**
 * The tallest document the schema allows, with a memo far enough down that no
 * image cropped to what a canvas can hold in one dimension would reach it.
 */
function createTallDoc() {
  return JSON.stringify({
    version: '3.0.0',
    settings: {
      width: TALL_WIDTH,
      height: TALL_HEIGHT,
      scrollLeft: 0,
      scrollTop: 0,
      zoomLevel: 1,
      databaseName: 'tall',
    },
    doc: {
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: ['m-bottom'],
    },
    collections: {
      tableEntities: {},
      tableColumnEntities: {},
      relationshipEntities: {},
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {
        'm-bottom': {
          id: 'm-bottom',
          value: '',
          ui: { ...TALL_MEMO, zIndex: 2, color: '#ff0000' },
          meta: meta(),
        },
      },
    },
  });
}

const theme: Theme = createTestTheme();

describe('createDocumentPng', () => {
  it('is the canvas box, not the window', async () => {
    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme, toWidth })
    );

    expect(image.width).toBe(CANVAS);
    expect(image.height).toBe(CANVAS);
  });

  it('draws the same image whatever the editor is scrolled and zoomed to', async () => {
    const plain = await createDocumentPng({ doc: createDoc(), theme, toWidth });
    const moved = await createDocumentPng({
      doc: createDoc({ scrollLeft: -640, scrollTop: -480, zoomLevel: 0.5 }),
      theme,
      toWidth,
    });

    expect(await bytesOf(moved)).toEqual(await bytesOf(plain));
  });

  it('keeps a table no viewport of that size could have shown', async () => {
    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme, toWidth })
    );

    expect(image.at(FAR_X + 20, FAR_Y + 10)).not.toBe(theme.canvasBackground);
    expect(image.at(10, 10)).toBe(theme.canvasBackground);
  });

  it('keeps a box taller than a canvas side at full resolution', async () => {
    const image = await decode(
      await createDocumentPng({ doc: createTallDoc(), theme, toWidth })
    );

    // 20000 is past any one canvas side, but 2000 by 20000 is well under the
    // area a canvas holds, so nothing about this box has to be scaled down.
    expect(image.width).toBe(TALL_WIDTH);
    expect(image.height).toBe(TALL_HEIGHT);
  });

  it('says nothing about resolution for a box that kept all of it', async () => {
    const reductions: unknown[] = [];

    await createDocumentPng({
      doc: createTallDoc(),
      theme,
      toWidth,
      onResolutionReduced: reduction => reductions.push(reduction),
    });

    expect(reductions).toEqual([]);
  });

  it('keeps the far end of a box no viewport could reach', async () => {
    const image = await decode(
      await createDocumentPng({ doc: createTallDoc(), theme, toWidth })
    );

    // Inside the memo at y 18000, which only an image of the whole box reaches.
    expect(image.at(1000, 18_600)).toBe(theme.memoBackground);
    expect(image.at(10, 10)).toBe(theme.canvasBackground);
  });

  it('scales down and says so when the raster runs past a canvas', async () => {
    const reductions: ResolutionReduction[] = [];

    const image = await decode(
      await createDocumentPng({
        doc: createTallDoc(),
        theme,
        toWidth,
        // Twice over is past the longest side a canvas will hold, so this is
        // the cheapest box that has to give resolution back.
        pixelRatio: 2,
        onResolutionReduced: reduction => reductions.push(reduction),
      })
    );

    expect(image.height).toBe(CANVAS_SIDE_MAX);
    expect(reductions).toEqual([
      {
        documentWidth: TALL_WIDTH,
        documentHeight: TALL_HEIGHT,
        width: image.width,
        height: image.height,
      },
    ]);
  });

  it('paints the palette it was handed rather than one it looked up', async () => {
    const repainted: Theme = { ...theme, canvasBackground: '#123456' };

    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme: repainted, toWidth })
    );

    expect(image.at(10, 10)).toBe('#123456');
  });
});
