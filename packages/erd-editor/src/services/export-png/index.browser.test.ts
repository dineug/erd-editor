import { Konva } from 'konva/lib/Global';
import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import { Show } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { unionRect } from '@/konva/scene/contentBounds';
import { getMemoRect, type Rect } from '@/konva/scene/metrics';
import {
  createDocumentPng,
  type ResolutionReduction,
} from '@/services/export-png';
import { renderDocumentScene } from '@/services/export-png/documentScene';
import { EXPORT_MARGIN, getExportScale } from '@/services/export-png/exportBox';
import {
  CANVAS_AREA_MAX,
  CANVAS_SIDE_MAX,
} from '@/services/export-png/pixelRatio';
import { renderDocumentPng } from '@/services/export-png/renderPng';
import type { Theme } from '@/themes/tokens';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { getRouteBBox } from '@/utils/draw-relationship';

/** The box the schema still clamps settings.width to, which nothing reads now. */
const CANVAS = 2000;

const meta = () => ({ updateAt: 0, createAt: 0 });

const toWidth = (text: string) => text.length * 7 + 2;

type MemoSeed = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type RelationshipSeed = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type TableSeed = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type Seed = {
  memos?: MemoSeed[];
  tables?: TableSeed[];
  relationships?: RelationshipSeed[];
  show?: number;
  originX?: number;
  originY?: number;
  zoomLevel?: number;
};

const DEFAULT_MEMO: MemoSeed = {
  id: 'm-1',
  x: 0,
  y: 0,
  width: 240,
  height: 160,
};

/**
 * A document of memos, whose width and height are literal in the seed, and of
 * connectors between anchors no table holds — the sort leaves those where they
 * are written, so where they reach is stated here rather than measured.
 */
function createDoc({
  memos = [DEFAULT_MEMO],
  tables = [],
  relationships = [],
  show,
  originX = 0,
  originY = 0,
  zoomLevel = 1,
}: Seed = {}) {
  return JSON.stringify({
    version: '3.0.0',
    settings: {
      width: CANVAS,
      height: CANVAS,
      originX,
      originY,
      zoomLevel,
      databaseName: 'export',
      ...(show === undefined ? {} : { show }),
    },
    doc: {
      tableIds: tables.map(({ id }) => id),
      relationshipIds: relationships.map(({ id }) => id),
      indexIds: [],
      memoIds: memos.map(({ id }) => id),
    },
    collections: {
      tableEntities: Object.fromEntries(
        tables.map(({ id, name, x, y }) => [
          id,
          {
            id,
            name,
            comment: '',
            columnIds: [],
            seqColumnIds: [],
            ui: {
              x,
              y,
              zIndex: 2,
              widthName: 60,
              widthComment: 60,
              color: '#00ff00',
            },
            meta: meta(),
          },
        ])
      ),
      tableColumnEntities: {},
      relationshipEntities: Object.fromEntries(
        relationships.map(({ id, start, end }) => [
          id,
          {
            id,
            identification: false,
            relationshipType: 4,
            startRelationshipType: 2,
            start: { tableId: '', columnIds: [], ...start, direction: 8 },
            end: { tableId: '', columnIds: [], ...end, direction: 8 },
            meta: meta(),
          },
        ])
      ),
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: Object.fromEntries(
        memos.map(({ id, x, y, width, height }) => [
          id,
          {
            id,
            value: '',
            ui: { x, y, width, height, zIndex: 2, color: '#ff0000' },
            meta: meta(),
          },
        ])
      ),
    },
  });
}

/** The same union the export makes, spelled from the entity geometry itself. */
function expectedBox({
  memos = [DEFAULT_MEMO],
  relationships = [],
}: Seed = {}) {
  const boxes: Rect[] = [
    ...memos.map(({ id, x, y, width, height }) =>
      getMemoRect(createMemo({ id, ui: { x, y, width, height } }))
    ),
    ...relationships.map(({ id, start, end }) =>
      getRouteBBox(createRelationship({ id, start, end }) as Relationship)
    ),
  ];
  const box = boxes.reduce(
    unionRect,
    boxes[0] ?? { x: 0, y: 0, width: 0, height: 0 }
  );

  return {
    x: box.x - EXPORT_MARGIN,
    y: box.y - EXPORT_MARGIN,
    width: box.width + EXPORT_MARGIN * 2,
    height: box.height + EXPORT_MARGIN * 2,
  };
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

/** A memo far enough down that the box holding it is taller than it is wide. */
const TALL_MEMO: MemoSeed = {
  id: 'm-bottom',
  x: 400,
  y: 18_000,
  width: 1_200,
  height: 1_200,
};

const theme: Theme = createTestTheme();

/** One table, whose rows are what the high level spelling drops. */
const TABLE: TableSeed = { id: 't-1', name: 'users', x: 0, y: 0 };

describe('renderDocumentScene', () => {
  /**
   * The zoom decides the spelling as well as the scale, so an image taken while
   * the editor shows named boxes is one of named boxes.
   */
  const drawnTables = async (zoomLevel: number) => {
    const scene = await renderDocumentScene({
      doc: createDoc({ memos: [], tables: [TABLE] }),
      theme,
      toWidth,
      zoomLevel,
    });

    try {
      return {
        tables: scene.stage.find('.table').length,
        highLevel: scene.stage.find('.high-level-table').length,
        scale: scene.scale,
      };
    } finally {
      scene.destroy();
    }
  };

  it('draws a table in full at a zoom that can show its rows', async () => {
    const drawn = await drawnTables(1);

    expect(drawn).toEqual({ tables: 1, highLevel: 0, scale: 1 });
  });

  it('draws a table as a named box under the high level threshold', async () => {
    const drawn = await drawnTables(0.5);

    // The high level group carries both names, so it is one table drawn in the
    // other spelling rather than a second node beside it.
    expect(drawn).toEqual({ tables: 1, highLevel: 1, scale: 0.5 });
  });
});

describe('createDocumentPng', () => {
  it('is what the document draws with a margin around it, not the canvas box', async () => {
    const box = expectedBox();
    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme, toWidth })
    );

    expect([image.width, image.height]).toEqual([box.width, box.height]);
    expect(image.width).toBeLessThan(CANVAS);
  });

  it('is the margin on its own for a document that draws nothing', async () => {
    const image = await decode(
      await createDocumentPng({ doc: createDoc({ memos: [] }), theme, toWidth })
    );

    expect([image.width, image.height]).toEqual([
      EXPORT_MARGIN * 2,
      EXPORT_MARGIN * 2,
    ]);
    expect(image.at(EXPORT_MARGIN, EXPORT_MARGIN)).toBe(theme.canvasBackground);
  });

  it('draws the same image wherever the editor is scrolled to', async () => {
    const plain = await createDocumentPng({ doc: createDoc(), theme, toWidth });
    const moved = await createDocumentPng({
      doc: createDoc({ originX: -640, originY: -480 }),
      theme,
      toWidth,
    });

    expect(await bytesOf(moved)).toEqual(await bytesOf(plain));
  });

  it('draws the document at the zoom it is being read at', async () => {
    const box = expectedBox();
    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ zoomLevel: 0.5 }),
        theme,
        toWidth,
      })
    );

    // The box the image holds is the whole document either way; what the zoom
    // decides is how many image pixels one scene unit is drawn with.
    expect([image.width, image.height]).toEqual([
      Math.round(box.width * 0.5),
      Math.round(box.height * 0.5),
    ]);
  });

  it('draws at the zoom the caller names, over the one the document carries', async () => {
    const box = expectedBox();
    const image = await decode(
      await createDocumentPng({
        // A document saved with the zoom left out arrives at 1, so the editor's
        // own zoom is what the caller has to be able to name.
        doc: createDoc({ zoomLevel: 1 }),
        theme,
        toWidth,
        zoomLevel: 0.5,
      })
    );

    expect([image.width, image.height]).toEqual([
      Math.round(box.width * 0.5),
      Math.round(box.height * 0.5),
    ]);
  });

  it('says nothing about resolution for an image the zoom alone made smaller', async () => {
    const reductions: unknown[] = [];

    await createDocumentPng({
      doc: createDoc(),
      theme,
      toWidth,
      zoomLevel: 0.5,
      onResolutionReduced: reduction => reductions.push(reduction),
    });

    expect(reductions).toEqual([]);
  });

  it('holds a memo left of and above where the old canvas box began', async () => {
    const memos = [
      { id: 'm-far', x: -3_000, y: -3_000, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });

    const image = await decode(
      await createDocumentPng({ doc: createDoc({ memos }), theme, toWidth })
    );

    expect([image.width, image.height]).toEqual([box.width, box.height]);
    // The memo starts one margin in on both axes, so its own middle is where
    // the image is painted with a memo rather than with the canvas behind it.
    expect(image.at(EXPORT_MARGIN + 120, EXPORT_MARGIN + 100)).toBe(
      theme.memoBackground
    );
    expect(image.at(10, 10)).toBe(theme.canvasBackground);
  });

  it('reaches a memo the width of ten canvas boxes away', async () => {
    const memos = [
      DEFAULT_MEMO,
      { id: 'm-far', x: 20_000, y: 0, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });

    const image = await decode(
      await createDocumentPng({ doc: createDoc({ memos }), theme, toWidth })
    );

    expect([image.width, image.height]).toEqual([box.width, box.height]);
    expect(
      image.at(image.width - EXPORT_MARGIN - 120, EXPORT_MARGIN + 100)
    ).toBe(theme.memoBackground);
  });

  it('holds the connectors when the document shows them', async () => {
    const relationships = [
      {
        id: 'r-1',
        start: { x: -4_000, y: -4_000 },
        end: { x: -3_600, y: -3_600 },
      },
    ];
    const box = expectedBox({ relationships });

    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ relationships }),
        theme,
        toWidth,
      })
    );

    expect([image.width, image.height]).toEqual([box.width, box.height]);
  });

  it('is the entity box alone when the document hides the connectors', async () => {
    const relationships = [
      {
        id: 'r-1',
        start: { x: -4_000, y: -4_000 },
        end: { x: -3_600, y: -3_600 },
      },
    ];
    const show = Show.tableComment;
    const box = expectedBox();

    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ relationships, show }),
        theme,
        toWidth,
      })
    );

    expect([image.width, image.height]).toEqual([box.width, box.height]);
    expect(image.width).toBeLessThan(expectedBox({ relationships }).width);
  });

  it('keeps a box taller than half a canvas side at full resolution', async () => {
    const memos = [DEFAULT_MEMO, TALL_MEMO];
    const box = expectedBox({ memos });

    const image = await decode(
      await createDocumentPng({ doc: createDoc({ memos }), theme, toWidth })
    );

    // A box this tall is well under both the side and the area a canvas holds,
    // so nothing about it has to be scaled down.
    expect(box.height).toBeGreaterThan(CANVAS_SIDE_MAX / 2);
    expect([image.width, image.height]).toEqual([box.width, box.height]);
  });

  it('says nothing about resolution for a box that kept all of it', async () => {
    const reductions: unknown[] = [];

    await createDocumentPng({
      doc: createDoc({ memos: [DEFAULT_MEMO, TALL_MEMO] }),
      theme,
      toWidth,
      onResolutionReduced: reduction => reductions.push(reduction),
    });

    expect(reductions).toEqual([]);
  });

  it('scales down and says so when the raster runs past a canvas', async () => {
    const memos = [
      DEFAULT_MEMO,
      { id: 'm-far', x: 20_000, y: 0, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });
    const reductions: ResolutionReduction[] = [];

    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ memos }),
        theme,
        toWidth,
        // Twice over is past the longest side a canvas will hold, so this is
        // the cheapest box that has to give resolution back.
        pixelRatio: 2,
        onResolutionReduced: reduction => reductions.push(reduction),
      })
    );

    expect(image.width).toBe(CANVAS_SIDE_MAX);
    expect(reductions).toEqual([
      {
        documentWidth: box.width,
        documentHeight: box.height,
        width: image.width,
        height: image.height,
      },
    ]);
  });

  it('draws a document wider than any canvas, and reports the box it was', async () => {
    const memos = [
      DEFAULT_MEMO,
      { id: 'm-far', x: 400_000, y: 0, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });
    const reductions: ResolutionReduction[] = [];

    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ memos }),
        theme,
        toWidth,
        onResolutionReduced: reduction => reductions.push(reduction),
      })
    );

    expect(box.width).toBeGreaterThan(400_000);
    expect(image.width).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
    expect(image.width).toBeGreaterThan(0);
    expect(reductions).toEqual([
      {
        documentWidth: box.width,
        documentHeight: box.height,
        width: image.width,
        height: image.height,
      },
    ]);
    expect(Number.isFinite(reductions[0].documentWidth)).toBe(true);
  });

  /**
   * On the main thread konva backs every layer with a canvas of the Stage
   * times the device pixel ratio, so a Stage bounded to the area a canvas holds
   * still hands the browser one four times that; the raster is drawn afresh at its own ratio.
   */
  it('still draws a document bounded to the area ceiling on a main thread at a pixel ratio of 2', async () => {
    const wide: MemoSeed = {
      id: 'm-wide',
      x: 0,
      y: 0,
      width: 40_000,
      height: 40_000,
    };
    const memos = [
      wide,
      { id: 'm-far', x: 400_000, y: 400_000, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });
    const scale = getExportScale(box);
    const stageSide = box.width * scale;
    const pixelRatio = 0.05;
    const before = Konva.pixelRatio;
    Konva.pixelRatio = 2;

    try {
      const { blob, reduction } = await renderDocumentPng({
        doc: createDoc({ memos }),
        theme,
        pixelRatio,
        toWidth,
      });
      const image = await decode(blob);
      const middle = {
        x: Math.round((wide.x + wide.width / 2 - box.x) * scale * pixelRatio),
        y: Math.round((wide.y + wide.height / 2 - box.y) * scale * pixelRatio),
      };

      // The Stage sits on the area ceiling, so its layer canvases at twice the
      // ratio run four times past what a canvas holds.
      expect((stageSide * box.height * scale) / CANVAS_AREA_MAX).toBeCloseTo(
        1,
        9
      );
      expect(image.width).toBe(Math.round(stageSide * pixelRatio));
      expect(reduction?.documentWidth).toBe(box.width);
      expect(image.at(middle.x, middle.y)).toBe(theme.memoBackground);
      expect(image.at(image.width - 2, 1)).toBe(theme.canvasBackground);
    } finally {
      Konva.pixelRatio = before;
    }
  });

  it('paints the palette it was handed rather than one it looked up', async () => {
    const repainted: Theme = { ...theme, canvasBackground: '#123456' };

    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme: repainted, toWidth })
    );

    expect(image.at(10, 10)).toBe('#123456');
  });
});
