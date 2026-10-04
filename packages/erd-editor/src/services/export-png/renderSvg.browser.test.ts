import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Shape } from 'konva/lib/Shape';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import {
  ColumnOption,
  ColumnUIKey,
  Direction,
  ReferentialAction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { createDocumentSvg } from '@/services/export-png';
import { renderDocumentScene } from '@/services/export-png/documentScene';
import { TRANSPARENT_BACKGROUND } from '@/services/export-png/exportTheme';
import { renderDocumentSvg } from '@/services/export-png/renderSvg';
import {
  SVG_NODE_KINDS,
  SVG_SKIPPED_ATTRIBUTES,
  SVG_WRITTEN_ATTRIBUTES,
  type SvgNodeKind,
  toSceneSvg,
} from '@/services/export-png/sceneSvg';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';
import { createText } from '@/utils/text';

// The svg of a whole document: the scene the png draws, read off its nodes,
// sized by the zoom alone and holding nothing konva paints only to be hit.

const theme: Theme = createTestTheme();

/** The editor's own measure, the one a worker reproduces before it draws. */
const { toWidth } = createText();

const meta = () => ({ updateAt: 0, createAt: 0 });

type ColumnSeed = {
  id: string;
  tableId: string;
  name: string;
  dataType: string;
  options?: number;
  keys?: number;
};

const column = ({
  id,
  tableId,
  name,
  dataType,
  options = 0,
  keys = 0,
}: ColumnSeed) => ({
  id,
  tableId,
  name,
  dataType,
  default: '',
  comment: '',
  options,
  ui: {
    keys,
    widthName: toWidth(name),
    widthDataType: toWidth(dataType),
    widthDefault: toWidth(''),
    widthComment: toWidth(''),
  },
  meta: meta(),
});

const table = (id: string, name: string, x: number, columnIds: string[]) => ({
  id,
  name,
  comment: '',
  columnIds,
  seqColumnIds: columnIds,
  ui: {
    x,
    y: 40,
    zIndex: 2,
    widthName: toWidth(name),
    widthComment: toWidth(''),
    color: '#ff8800',
  },
  meta: meta(),
});

/**
 * Two related tables, a connector that takes a referential action label and a
 * ring at its parent end, and a memo of two lines: every node kind the export
 * scene draws, and every hit box it lays.
 */
function createDoc(zoomLevel = 1, memoValue = 'first line\nsecond line') {
  return JSON.stringify({
    version: '3.0.0',
    settings: {
      width: 2000,
      height: 2000,
      originX: 0,
      originY: 0,
      zoomLevel,
      databaseName: 'svg',
    },
    doc: {
      tableIds: ['users', 'orders'],
      relationshipIds: ['users_orders'],
      indexIds: [],
      memoIds: ['memo'],
    },
    collections: {
      tableEntities: {
        users: table('users', 'users', 40, ['users_id']),
        orders: table('orders', 'orders', 480, ['orders_id', 'orders_user']),
      },
      tableColumnEntities: {
        users_id: column({
          id: 'users_id',
          tableId: 'users',
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
          keys: ColumnUIKey.primaryKey,
        }),
        orders_id: column({
          id: 'orders_id',
          tableId: 'orders',
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
          keys: ColumnUIKey.primaryKey,
        }),
        orders_user: column({
          id: 'orders_user',
          tableId: 'orders',
          name: 'user_id',
          dataType: 'INT',
          keys: ColumnUIKey.foreignKey,
        }),
      },
      relationshipEntities: {
        users_orders: {
          id: 'users_orders',
          identification: false,
          relationshipType: RelationshipType.ZeroN,
          startRelationshipType: StartRelationshipType.ring,
          onDelete: ReferentialAction.cascade,
          onUpdate: ReferentialAction.none,
          start: {
            tableId: 'users',
            columnIds: ['users_id'],
            x: 0,
            y: 0,
            direction: Direction.right,
          },
          end: {
            tableId: 'orders',
            columnIds: ['orders_user'],
            x: 0,
            y: 0,
            direction: Direction.left,
          },
          meta: meta(),
        },
      },
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {
        memo: {
          id: 'memo',
          value: memoValue,
          ui: {
            x: 40,
            y: 320,
            width: 200,
            height: 80,
            zIndex: 3,
            color: '#00aaff',
          },
          meta: meta(),
        },
      },
    },
  });
}

function parse(svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(parsed.querySelector('parsererror')).toBeNull();
  return parsed.documentElement as unknown as SVGSVGElement;
}

const texts = (root: Element) =>
  Array.from(root.querySelectorAll('text')).map(text => text.textContent);

/** The box the export of that document holds, as the png measures it. */
async function exportBox(doc: string) {
  const scene = await renderDocumentScene({ doc, theme, toWidth });
  const { box, zoomLevel } = scene;
  scene.destroy();
  return { box, zoomLevel };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the svg of a document', () => {
  it('is the export box as the viewBox, sized by the zoom with no scale', async () => {
    const doc = createDoc(0.8);
    const { box } = await exportBox(doc);

    const root = parse(await renderDocumentSvg({ doc, theme, toWidth }));

    expect(root.getAttribute('viewBox')).toBe(
      [box.x, box.y, box.width, box.height].join(' ')
    );
    expect(Number(root.getAttribute('width'))).toBeCloseTo(box.width * 0.8, 3);
    expect(Number(root.getAttribute('height'))).toBeCloseTo(
      box.height * 0.8,
      3
    );
  });

  it('draws at the zoom it is handed over the one the document saved', async () => {
    const doc = createDoc(1);
    const { box } = await exportBox(doc);

    const root = parse(
      await renderDocumentSvg({ doc, theme, toWidth, zoomLevel: 1.5 })
    );

    expect(Number(root.getAttribute('width'))).toBeCloseTo(box.width * 1.5, 3);
  });

  it('holds the tables, the rows, the label and the memo as text', async () => {
    const root = parse(
      await renderDocumentSvg({ doc: createDoc(), theme, toWidth })
    );
    const memo = root.querySelector('[clip-path] text');

    expect(texts(root)).toEqual(
      expect.arrayContaining(['users', 'orders', 'user_id', 'D:C'])
    );
    expect(
      Array.from(memo?.querySelectorAll('tspan') ?? []).map(
        span => span.textContent
      )
    ).toEqual(['first line', 'second line']);
  });

  it('paints the canvas colour across the box, under everything else', async () => {
    const doc = createDoc();
    const { box } = await exportBox(doc);

    const root = parse(await renderDocumentSvg({ doc, theme, toWidth }));
    const background = Array.from(root.children).find(
      element => element.tagName === 'rect'
    );

    expect(background?.getAttribute('fill')).toBe(theme.canvasBackground);
    expect(background?.getAttribute('transform')).toBe(
      `translate(${box.x} ${box.y})`
    );
    expect(background?.getAttribute('width')).toBe(String(box.width));
  });

  it('leaves the canvas out with the background off, label box and all', async () => {
    const bare = { ...theme, canvasBackground: TRANSPARENT_BACKGROUND };

    const svg = await renderDocumentSvg({
      doc: createDoc(),
      theme: bare,
      toWidth,
    });
    const root = parse(svg);

    expect(svg).not.toContain(TRANSPARENT_BACKGROUND);
    expect(root.querySelector('rect')?.getAttribute('fill')).not.toBe(
      theme.canvasBackground
    );
    expect(texts(root)).toContain('D:C');
  });

  it('draws the dashed route and the ring the connector carries', async () => {
    const root = parse(
      await renderDocumentSvg({ doc: createDoc(), theme, toWidth })
    );
    const route = root.querySelector('path[stroke-dasharray]');

    expect(route?.getAttribute('stroke-dasharray')).toBe('10 10');
    expect(route?.getAttribute('stroke')).toBe(theme.keyFK);
    expect(root.querySelector('circle[fill="none"]')).not.toBeNull();
  });

  it('holds no hit box, no shadow and no font but the names of its faces', async () => {
    const svg = await renderDocumentSvg({ doc: createDoc(), theme, toWidth });
    const root = parse(svg);

    expect(svg).not.toContain('transparent');
    expect(
      root.querySelector('filter, style, image, foreignObject')
    ).toBeNull();
    expect(svg).not.toContain('@font-face');
    expect(svg).not.toContain('shadow');
  });

  it('draws a table by its name alone at a zoom that does', async () => {
    const root = parse(
      await renderDocumentSvg({ doc: createDoc(0.5), theme, toWidth })
    );
    const names = Array.from(root.querySelectorAll('text')).filter(
      text => text.getAttribute('font-weight') === 'bold'
    );

    expect(names.map(name => name.textContent).sort()).toEqual([
      'orders',
      'users',
    ]);
    expect(
      names.every(name => name.getAttribute('text-anchor') === 'middle')
    ).toBe(true);
    expect(texts(root)).not.toContain('user_id');
    expect(texts(root)).not.toContain('D:C');
  });
});

describe('the attributes konva holds for the export scene', () => {
  /** Every node under the Stage, the layers included, with what konva keeps for each. */
  function attributesOf(
    stage: KonvaNode & { find: (s: () => boolean) => KonvaNode[] }
  ) {
    return stage
      .find(() => true)
      .flatMap(node =>
        Object.keys(node.getAttrs()).map(attribute => ({
          kind: node.getClassName(),
          attribute,
        }))
      );
  }

  it.each([1, 0.5])(
    'are all written or skipped by name, at zoom %s',
    async zoomLevel => {
      const scene = await renderDocumentScene({
        doc: createDoc(zoomLevel),
        theme,
        toWidth,
      });
      const found = attributesOf(scene.stage);
      scene.destroy();

      const kinds = new Set(found.map(({ kind }) => kind));
      const unhandled = found
        .filter(
          ({ kind, attribute }) =>
            !(
              SVG_WRITTEN_ATTRIBUTES[kind as SvgNodeKind]?.includes(
                attribute
              ) || SVG_SKIPPED_ATTRIBUTES.includes(attribute)
            )
        )
        .map(({ kind, attribute }) => `${kind}.${attribute}`);

      expect(
        [...kinds].every(kind => SVG_NODE_KINDS.includes(kind as SvgNodeKind))
      ).toBe(true);
      expect([...new Set(unhandled)]).toEqual([]);
    }
  );
});

describe('the svg of a document against the png konva paints', () => {
  /** A preset, whose contrasts and alpha tokens the test theme's near blacks lack. */
  const preset = createTheme({
    appearance: Appearance.light,
    grayColor: GrayColor.gray,
    accentColor: AccentColor.blue,
  });

  function channelsOf(
    draw: (context: CanvasRenderingContext2D) => void,
    width: number,
    height: number
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    draw(context);
    return context.getImageData(0, 0, width, height).data;
  }

  /**
   * The pixels of the png that stand off its corner, the canvas colour, and
   * the pixels the two images set apart, past what an antialiased edge moves.
   */
  function compare(painted: Uint8ClampedArray, written: Uint8ClampedArray) {
    const far = (from: number, to: number) => Math.abs(from - to) > 96;
    let ink = 0;
    let apart = 0;

    for (let index = 0; index < painted.length; index += 4) {
      let standsOff = false;
      let differs = false;

      for (let channel = 0; channel < 4; channel++) {
        const value = painted[index + channel];
        standsOff ||= channel < 3 && far(value, painted[channel]);
        differs ||= far(value, written[index + channel]);
      }

      ink += Number(standsOff);
      apart += Number(differs);
    }

    return { ink, apart };
  }

  it.each([1, 0.5])(
    'sets every table, row, label and memo where konva paints them, at zoom %s',
    async zoomLevel => {
      const scene = await renderDocumentScene({
        doc: createDoc(zoomLevel),
        theme: preset,
        toWidth,
      });
      // The svg leaves the shadows out on purpose, so the png is painted without them.
      scene.stage
        .find<Shape>('Shape')
        .forEach(shape => shape.shadowEnabled(false));
      const svg = toSceneSvg(scene.stage, {
        box: scene.box,
        scale: scene.scale,
        zoomLevel: scene.zoomLevel,
      });
      const width = scene.stage.width();
      const height = scene.stage.height();
      const canvas = scene.stage.toCanvas({ pixelRatio: 1 });
      scene.destroy();

      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();

      // The png at its own size and the svg at the Stage's, which a fractional
      // zoom leaves between two pixels: stretching the png would blur each edge.
      const { ink, apart } = compare(
        channelsOf(context => context.drawImage(canvas, 0, 0), width, height),
        channelsOf(
          context => context.drawImage(image, 0, 0, width, height),
          width,
          height
        )
      );

      expect(ink).toBeGreaterThan(500);
      expect(apart).toBeLessThan(ink * 0.02);
    }
  );
});

describe('the svg in the shared worker', () => {
  it('is written in the worker, to the very text the main thread writes', async () => {
    const warn = vi.spyOn(console, 'warn');
    // A memo body is left empty: its line height is measured off the page,
    // which a worker has none of, so its lines fall where the two realms differ.
    const doc = createDoc(1, '');

    const fromWorker = await createDocumentSvg({ doc, theme, toWidth });
    const onMain = await renderDocumentSvg({ doc, theme, toWidth });

    expect(warn).not.toHaveBeenCalled();
    expect(fromWorker).toBe(onMain);
  });

  it('is written on the main thread when the worker measures differently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const measure = (text: string) => text.length * 7 + 2;

    const svg = await createDocumentSvg({
      doc: createDoc(),
      theme,
      toWidth: measure,
    });

    expect(warn).toHaveBeenCalledWith(
      '[export-png] the worker handed the export back',
      expect.anything()
    );
    expect(parse(svg).querySelector('text')).not.toBeNull();
  });
});
