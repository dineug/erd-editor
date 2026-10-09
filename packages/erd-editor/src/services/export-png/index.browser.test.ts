import type { Container } from 'konva/lib/Container';
import { Konva } from 'konva/lib/Global';
import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import { Show } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { unionRect } from '@/konva/scene/contentBounds';
import { getMemoRect, type Rect } from '@/konva/scene/metrics';
import {
  createDocumentPng,
  createDocumentPreview,
  type ResolutionReduction,
} from '@/services/export-png';
import { renderDocumentScene } from '@/services/export-png/documentScene';
import {
  EXPORT_MARGIN,
  getExportScale,
  getExportSize,
} from '@/services/export-png/exportBox';
import { TRANSPARENT_BACKGROUND } from '@/services/export-png/exportTheme';
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
  groupId?: string;
};

type GroupSeed = {
  id: string;
  color: string;
  x: number;
  y: number;
};

type Seed = {
  memos?: MemoSeed[];
  tables?: TableSeed[];
  groups?: GroupSeed[];
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
  groups = [],
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
      lockSettings: 0,
      ...(show === undefined ? {} : { show }),
    },
    doc: {
      tableIds: tables.map(({ id }) => id),
      relationshipIds: relationships.map(({ id }) => id),
      indexIds: [],
      memoIds: memos.map(({ id }) => id),
      ...(groups.length ? { tableGroupIds: groups.map(({ id }) => id) } : {}),
    },
    collections: {
      tableEntities: Object.fromEntries(
        tables.map(({ id, name, x, y, groupId }) => [
          id,
          {
            id,
            name,
            ...(groupId ? { groupId } : {}),
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
      ...(groups.length
        ? {
            tableGroupEntities: Object.fromEntries(
              groups.map(({ id, color, x, y }) => [
                id,
                {
                  id,
                  name: id,
                  color,
                  ui: { x, y, width: 200, height: 100, zIndex: 1 },
                  meta: meta(),
                },
              ])
            ),
          }
        : {}),
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

/**
 * A zoom under the high level threshold, at which the editor draws a table as
 * a named box, and which the export never draws at.
 */
const ZOOMED_OUT = 0.4;

describe('renderDocumentScene', () => {
  /**
   * A document saved while the editor showed named boxes is still drawn in
   * full, and at a scale of one.
   */
  const drawnTables = async (zoomLevel: number) => {
    const scene = await renderDocumentScene({
      doc: createDoc({ memos: [], tables: [TABLE], zoomLevel }),
      theme,
      toWidth,
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

  it('caps the scale at the side it is given, still drawing the table in full', async () => {
    const scene = await renderDocumentScene({
      doc: createDoc({ memos: [], tables: [TABLE], zoomLevel: ZOOMED_OUT }),
      theme,
      toWidth,
      maxSide: 100,
    });

    try {
      const side = Math.max(scene.box.width, scene.box.height);
      expect(scene.scale).toBeCloseTo(100 / side, 9);
      expect(Math.max(scene.stage.width(), scene.stage.height())).toBeCloseTo(
        100,
        9
      );
      expect(scene.stage.find('.table')).toHaveLength(1);
      expect(scene.stage.find('.high-level-table')).toHaveLength(0);
    } finally {
      scene.destroy();
    }
  });

  it('draws at 100% when the side it is given is larger than the box, whatever zoom the document carries', async () => {
    const drawn = await renderDocumentScene({
      doc: createDoc({ memos: [], tables: [TABLE], zoomLevel: 0.8 }),
      theme,
      toWidth,
      maxSide: 100_000,
    });

    try {
      expect(drawn.scale).toBe(1);
    } finally {
      drawn.destroy();
    }
  });

  it('draws a table in full and at 100% for a document saved under the high level threshold', async () => {
    const drawn = await drawnTables(ZOOMED_OUT);

    // The high level group carries both names, so a table drawn in the other
    // spelling would still count once here, and once more under its own name.
    expect(drawn).toEqual({ tables: 1, highLevel: 0, scale: 1 });
  });

  /**
   * The worker this runs inside has no animation frame, and Table reaches the
   * highlight ticker. Nothing asks the ticker for one while the scene draws the
   * document, so the source this scene resolves to is pinned by what it paints.
   */
  it('draws the document card, wearing none of the paint a view card carries', async () => {
    const scene = await renderDocumentScene({
      doc: createDoc({ memos: [], tables: [TABLE] }),
      theme,
      toWidth,
    });

    try {
      const body = scene.stage.findOne('.table-body');

      // The palette's document shadow, never the minimap black a view card
      // sits on at a fraction of its alpha.
      expect(body?.getAttr('shadowColor')).toBe(theme.tableShadow);
      expect(body?.getAttr('shadowColor')).not.toBe(theme.minimapShadow);
      expect(body?.getAttr('shadowOpacity')).toBe(1);
      expect(scene.stage.find('.table-glow')).toHaveLength(0);
    } finally {
      scene.destroy();
    }
  });
});

describe('the groups of an exported document', () => {
  const GROUP: GroupSeed = { id: 'g-1', color: '#1e3a8a', x: -600, y: -400 };
  const MEMBER: TableSeed = { ...TABLE, groupId: GROUP.id };

  const drawGroups = async (show?: number) => {
    const scene = await renderDocumentScene({
      doc: createDoc({ tables: [MEMBER], groups: [GROUP], show }),
      theme,
      toWidth,
    });

    try {
      return {
        layer: scene.stage
          .findOne<Container>('.export-scene')!
          .getChildren()
          .map(node => node.name()),
        band: scene.stage.findOne('.table-header-band')?.getAttr('fill'),
        name: scene.stage
          .findOne<Container>('.tableName')
          ?.findOne('.cell-text')
          ?.getAttr('fill'),
        x: scene.box.x,
      };
    } finally {
      scene.destroy();
    }
  };

  it('draws each group behind everything, and its members in its color', async () => {
    const drawn = await drawGroups();

    expect(drawn.layer.slice(0, 3)).toEqual([
      'export-background',
      'table-group',
      'relationship-group',
    ]);
    expect(drawn.band).toBe('#1e3a8a');
    expect(drawn.name).toBe('#ffffff');
    expect(drawn.x).toBe(GROUP.x - EXPORT_MARGIN);
  });

  it('draws no group, no tint and no room for one while the document hides them', async () => {
    const drawn = await drawGroups(Show.relationship | Show.hideTableGroup);

    expect(drawn.layer).not.toContain('table-group');
    expect(drawn.band).toBe(theme.tableHeaderBackground);
    expect(drawn.name).toBe(theme.active);
    expect(drawn.x).toBe(DEFAULT_MEMO.x - EXPORT_MARGIN);
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

  it('draws a document saved zoomed out at 100%, one image pixel per scene unit', async () => {
    const box = expectedBox();
    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ zoomLevel: ZOOMED_OUT }),
        theme,
        toWidth,
      })
    );

    // The box the image holds is the whole document whatever the zoom, and the
    // zoom the editor was at decides nothing about the pixels it is drawn with.
    expect([image.width, image.height]).toEqual([box.width, box.height]);
  });

  it('draws the same image whatever zoom the editor is at', async () => {
    const plain = await createDocumentPng({ doc: createDoc(), theme, toWidth });
    const zoomed = await createDocumentPng({
      doc: createDoc({ zoomLevel: ZOOMED_OUT }),
      theme,
      toWidth,
    });

    expect(await bytesOf(zoomed)).toEqual(await bytesOf(plain));
  });

  it('says nothing about resolution for a document saved zoomed out', async () => {
    const reductions: unknown[] = [];

    await createDocumentPng({
      doc: createDoc({ zoomLevel: ZOOMED_OUT }),
      theme,
      toWidth,
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
        askedWidth: Math.floor(box.width * 2),
        askedHeight: Math.floor(box.height * 2),
        width: image.width,
        height: image.height,
      },
    ]);
    // The dialog states these very pixels, and warns, before the file exists.
    expect(getExportSize(box, 2)).toEqual({
      ...reductions[0],
      reduced: true,
    });
  });

  it('draws a document wider than any canvas, and reports the pixels it asked for', async () => {
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
        askedWidth: Math.floor(box.width),
        askedHeight: Math.floor(box.height),
        width: image.width,
        height: image.height,
      },
    ]);
    expect(Number.isFinite(reductions[0].askedWidth)).toBe(true);
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
      expect(reduction?.askedWidth).toBe(Math.floor(box.width * pixelRatio));
      expect(image.at(middle.x, middle.y)).toBe(theme.memoBackground);
      expect(image.at(image.width - 2, 1)).toBe(theme.canvasBackground);
    } finally {
      Konva.pixelRatio = before;
    }
  });

  it('draws every scene unit with as many pixels as the scale asks for, whatever the zoom', async () => {
    const box = expectedBox();
    const image = await decode(
      await createDocumentPng({
        doc: createDoc({ zoomLevel: ZOOMED_OUT }),
        theme,
        toWidth,
        pixelRatio: 3,
      })
    );

    expect([image.width, image.height]).toEqual([
      Math.round(box.width * 3),
      Math.round(box.height * 3),
    ]);
    const size = getExportSize(box, 3);
    expect([size.width, size.height]).toEqual([image.width, image.height]);
    expect(size.reduced).toBe(false);
  });

  it('paints no background once the canvas colour is made transparent', async () => {
    const blob = await createDocumentPng({
      doc: createDoc(),
      theme: { ...theme, canvasBackground: TRANSPARENT_BACKGROUND },
      toWidth,
    });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);

    const alphaAt = (x: number, y: number) =>
      context.getImageData(x, y, 1, 1).data[3];

    expect(alphaAt(10, 10)).toBe(0);
    // The memo still paints itself over the space the background left.
    expect(alphaAt(EXPORT_MARGIN + 120, EXPORT_MARGIN + 100)).toBe(255);
  });

  it('paints the palette it was handed rather than one it looked up', async () => {
    const repainted: Theme = { ...theme, canvasBackground: '#123456' };

    const image = await decode(
      await createDocumentPng({ doc: createDoc(), theme: repainted, toWidth })
    );

    expect(image.at(10, 10)).toBe('#123456');
  });
});

describe('createDocumentPreview', () => {
  it('draws the export no longer than the side it is given, and measures the export box', async () => {
    const box = expectedBox();
    const preview = await createDocumentPreview({
      doc: createDoc(),
      theme,
      toWidth,
      maxSide: 200,
    });
    const image = await decode(preview.blob);

    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(200);
    expect(Math.max(image.width, image.height)).toBeGreaterThanOrEqual(199);
    expect([preview.documentWidth, preview.documentHeight]).toEqual([
      box.width,
      box.height,
    ]);
    expect(image.at(1, 1)).toBe(theme.canvasBackground);
  });

  it('previews a document saved zoomed out at the size its export takes at 100%', async () => {
    const box = expectedBox();
    const preview = await createDocumentPreview({
      doc: createDoc({ zoomLevel: ZOOMED_OUT }),
      theme,
      toWidth,
      maxSide: 100_000,
    });
    const image = await decode(preview.blob);

    // A side larger than the box caps nothing, so the preview is the png itself.
    expect([image.width, image.height]).toEqual([box.width, box.height]);
    expect([preview.width, preview.height]).toEqual([box.width, box.height]);
  });

  it('draws a document far longer than it is thick, its short side kept at a pixel', async () => {
    const memos = [
      DEFAULT_MEMO,
      { id: 'm-far', x: 400_000, y: 0, width: 240, height: 160 },
    ];
    const box = expectedBox({ memos });
    const maxSide = 960;

    const preview = await createDocumentPreview({
      doc: createDoc({ memos }),
      theme,
      toWidth,
      maxSide,
    });
    const image = await decode(preview.blob);

    // Capped by its long side alone, the box is under a pixel thick, which a canvas truncates to none.
    expect(box.height * (maxSide / box.width)).toBeLessThan(1);
    expect(image.width).toBeLessThanOrEqual(maxSide);
    expect(image.width).toBeGreaterThanOrEqual(maxSide - 1);
    expect(image.height).toBe(1);
    expect([preview.documentWidth, preview.documentHeight]).toEqual([
      box.width,
      box.height,
    ]);
  });
});
