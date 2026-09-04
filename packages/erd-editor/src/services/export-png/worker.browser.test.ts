import { observable } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import {
  createDocumentPng,
  type ExportPngProgress,
} from '@/services/export-png';
import { CANVAS_SIDE_MAX } from '@/services/export-png/pixelRatio';
import { renderDocumentPng } from '@/services/export-png/renderPng';
import { createOffscreenToWidth } from '@/services/export-png/textWidth';
import type { Theme } from '@/themes/tokens';
import { createText } from '@/utils/text';

const CANVAS = 600;

const theme: Theme = createTestTheme();

const meta = () => ({ updateAt: 0, createAt: 0 });

/**
 * The editor's own measurement, which is what the app hands the export and the
 * only one a worker can reproduce. Every case below turns on whether the realm
 * that draws agrees with it, so nothing here invents a width of its own.
 */
const { toWidth } = createText();

/**
 * Text in three scripts, so a realm that resolved the family list differently
 * would draw glyphs of a different width and the comparison would see it.
 */
function createDoc(width = CANVAS, height = CANVAS) {
  return JSON.stringify({
    version: '3.0.0',
    settings: {
      width,
      height,
      scrollLeft: 0,
      scrollTop: 0,
      zoomLevel: 1,
      databaseName: 'worker',
    },
    doc: {
      tableIds: ['t-1'],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    },
    collections: {
      tableEntities: {
        't-1': {
          id: 't-1',
          name: 'customer_orders',
          comment: '주문 이력 / 注文履歴',
          columnIds: ['c-1', 'c-2'],
          seqColumnIds: ['c-1', 'c-2'],
          ui: {
            x: 40,
            y: 40,
            zIndex: 2,
            widthName: toWidth('customer_orders'),
            widthComment: toWidth('주문 이력 / 注文履歴'),
            color: '',
          },
          meta: meta(),
        },
      },
      tableColumnEntities: {
        'c-1': {
          id: 'c-1',
          tableId: 't-1',
          name: 'order_id',
          dataType: 'BIGINT',
          default: '',
          comment: '—…€·',
          options: 0,
          ui: {
            keys: 0,
            widthName: toWidth('order_id'),
            widthDataType: toWidth('BIGINT'),
            widthDefault: toWidth(''),
            widthComment: toWidth('—…€·'),
          },
          meta: meta(),
        },
        'c-2': {
          id: 'c-2',
          tableId: 't-1',
          name: 'placed_at',
          dataType: 'TIMESTAMP',
          default: 'now()',
          comment: 'iIlL1 0O',
          options: 0,
          ui: {
            keys: 0,
            widthName: toWidth('placed_at'),
            widthDataType: toWidth('TIMESTAMP'),
            widthDefault: toWidth('now()'),
            widthComment: toWidth('iIlL1 0O'),
          },
          meta: meta(),
        },
      },
      relationshipEntities: {},
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {},
    },
  });
}

type Exported = {
  blob: Blob;
  progress: ExportPngProgress[];
};

async function exportPng(
  measure: (text: string) => number,
  doc = createDoc(),
  pixelRatio?: number
): Promise<Exported> {
  const progress: ExportPngProgress[] = [];
  const blob = await createDocumentPng({
    doc,
    theme,
    toWidth: measure,
    pixelRatio,
    onProgress: event => progress.push(event),
  });

  return { blob, progress };
}

const realmOf = ({ progress }: Exported) =>
  progress
    .filter(event => event.phase === 'finished')
    .map(({ realm }) => realm);

async function pixelsOf(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.drawImage(bitmap, 0, 0);

  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

const differingBytes = (a: ImageData, b: ImageData) =>
  a.data.reduce(
    (count, byte, index) => (byte === b.data[index] ? count : count + 1),
    0
  );

describe('the export runs in a shared worker', () => {
  it('draws in the worker when the caller measures text as the worker does', async () => {
    const exported = await exportPng(toWidth);

    expect(realmOf(exported)).toEqual(['worker']);
  });

  it('says it started before it says it finished', async () => {
    const { progress } = await exportPng(toWidth);

    expect(progress.map(({ phase }) => phase)).toEqual(['started', 'finished']);
    expect(progress[0]).toEqual({ phase: 'started', realm: 'worker' });
  });

  it('hands the export back to the main thread when the widths disagree', async () => {
    const exported = await exportPng(text => text.length * 7 + 2);

    expect(realmOf(exported)).toEqual(['main']);
  });

  it('draws in the worker from the palette the editor really hands it', async () => {
    // ErdEditor builds the scene palette with exactly this call, and a proxy is
    // what a structured clone refuses, so a live one reaches the worker as a
    // DataCloneError rather than as an image.
    const sceneTheme = observable({ ...theme }, { shallow: true });
    const progress: ExportPngProgress[] = [];

    const blob = await createDocumentPng({
      doc: createDoc(),
      theme: sceneTheme,
      toWidth,
      onProgress: event => progress.push(event),
    });

    const drawn = await pixelsOf(blob);
    const expected = await pixelsOf(
      (
        await renderDocumentPng({
          doc: createDoc(),
          theme,
          pixelRatio: 1,
          toWidth,
        })
      ).blob
    );

    expect(progress.at(-1)).toMatchObject({
      phase: 'finished',
      realm: 'worker',
    });
    expect(differingBytes(drawn, expected)).toBe(0);
  });

  it('draws a different picture when the widths change, which is what it guards', async () => {
    const real = await renderDocumentPng({
      doc: createDoc(),
      theme,
      pixelRatio: 1,
      toWidth,
    });
    const other = await renderDocumentPng({
      doc: createDoc(),
      theme,
      pixelRatio: 1,
      toWidth: text => text.length * 7 + 2,
    });

    const [a, b] = await Promise.all([
      pixelsOf(real.blob),
      pixelsOf(other.blob),
    ]);

    expect([a.width, a.height]).toEqual([b.width, b.height]);
    expect(differingBytes(a, b)).toBeGreaterThan(0);
  });

  it('measures a string identically in both realms', async () => {
    const offscreen = createOffscreenToWidth();
    const probes = ['customer_orders', '주문 이력 / 注文履歴', '—…€· iIlL1'];

    expect(probes.map(text => offscreen?.(text))).toEqual(probes.map(toWidth));
  });
});

describe('the worker and the main thread draw the same document', () => {
  it('rasters it to the same box', async () => {
    const worker = await exportPng(toWidth);
    const main = await renderDocumentPng({
      doc: createDoc(),
      theme,
      pixelRatio: 1,
      toWidth,
    });

    const drawn = await pixelsOf(worker.blob);

    expect(realmOf(worker)).toEqual(['worker']);
    expect([drawn.width, drawn.height]).toEqual([main.width, main.height]);
  });

  it('rasters it to the same pixels, which is the font gate holding', async () => {
    const worker = await exportPng(toWidth);
    const main = await renderDocumentPng({
      doc: createDoc(),
      theme,
      pixelRatio: 1,
      toWidth,
    });

    const [drawn, expected] = await Promise.all([
      pixelsOf(worker.blob),
      pixelsOf(main.blob),
    ]);

    expect(differingBytes(drawn, expected)).toBe(0);
  });
});

describe('a box past what a canvas holds', () => {
  it('is scaled down in the worker, and says so on the main thread', async () => {
    const reductions: unknown[] = [];
    const progress: ExportPngProgress[] = [];

    const blob = await createDocumentPng({
      doc: createDoc(2000, 20_000),
      theme,
      toWidth,
      pixelRatio: 2,
      onResolutionReduced: reduction => reductions.push(reduction),
      onProgress: event => progress.push(event),
    });

    const drawn = await createImageBitmap(blob);

    expect(progress.at(-1)).toEqual({
      phase: 'finished',
      realm: 'worker',
      width: drawn.width,
      height: drawn.height,
    });
    expect(drawn.height).toBe(CANVAS_SIDE_MAX);
    expect(reductions).toEqual([
      {
        documentWidth: 2000,
        documentHeight: 20_000,
        width: drawn.width,
        height: drawn.height,
      },
    ]);
  }, 60_000);

  it('keeps every pixel of a box that fits, and says nothing', async () => {
    const reductions: unknown[] = [];

    const blob = await createDocumentPng({
      doc: createDoc(2000, 20_000),
      theme,
      toWidth,
      onResolutionReduced: reduction => reductions.push(reduction),
    });

    const drawn = await createImageBitmap(blob);

    expect([drawn.width, drawn.height]).toEqual([2000, 20_000]);
    expect(reductions).toEqual([]);
  }, 60_000);
});
