import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import { createDocumentPng } from '@/services/export-png';
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

  it('paints the palette it was handed rather than one it looked up', async () => {
    const repainted: Theme = { ...theme, canvasBackground: '#123456' };

    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme: repainted, toWidth })
    );

    expect(image.at(10, 10)).toBe('#123456');
  });
});
