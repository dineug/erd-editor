/** @jsxHost konva */

// AC-1, AC-2, AC-3, AC-5, AC-27, AC-44 and AC-45: what a table draws inside a
// view, and what it refuses. The show mode picks the rows, the box is measured
// for them, the type cell lights where the view does, and no cell is edited.

import { createRef, useProvider } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  moveScenePointer,
  stepTransitions,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { TRANSITION_MS } from '@/components/erd/canvas/highlightTransition';
import { mixColor } from '@/components/erd/canvas/mixColor';
import { columnCellHit } from '@/components/erd/canvas/sceneHit';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  DOCUMENT_CARD_SHADOW_BLUR,
  DOCUMENT_CARD_SHADOW_OFFSET_Y,
  SCENE_CODE_FONT_FAMILY,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  SCENE_FONT_WEIGHT,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
  TRANSPARENT,
  VIEW_CARD_GLOW_BLUR,
  VIEW_CARD_GLOW_OPACITY,
  VIEW_CARD_SHADOW_BLUR,
  VIEW_CARD_SHADOW_OFFSET_X,
  VIEW_CARD_SHADOW_OFFSET_Y,
  VIEW_CARD_SHADOW_OPACITY,
  VIEW_HEADER_FONT_WEIGHT,
} from '@/components/erd/canvas/sceneTokens';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import {
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  HEADER_ICON_HEIGHT,
  TABLE_BORDER,
  TABLE_COLOR_WIDTH,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_HEIGHT,
  TABLE_HEADER_ICON_SIZE,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_TABLE_HEADER_BUTTON_SIZE,
  VIEW_TABLE_HEADER_FONT_SIZE,
  VIEW_TABLE_HEADER_HEIGHT,
  VIEW_TABLE_HEADER_ICON_GAP,
  VIEW_TABLE_HEADER_ICON_SIZE,
  VIEW_TABLE_MIN_WIDTH,
} from '@/constants/layout';
import { CanvasType, ColumnUIKey, RelationshipType } from '@/constants/schema';
import {
  changeViewportAction,
  editTableAction,
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import {
  FocusType,
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { getReachedTableIds } from '@/konva/scene/viewLayout';
import type { Theme } from '@/themes/tokens';
import { calcTableHeight, viewHeaderNameWidth } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

const WIDTH = 1000;
const HEIGHT = 800;

/** Where the view stands the five tables, two rows of boxes across the stage. */
const VIEW_POINTS: Record<string, Point> = {
  a: { x: 60, y: 80 },
  b: { x: 320, y: 80 },
  c: { x: 620, y: 80 },
  d: { x: 60, y: 420 },
  e: { x: 620, y: 420 },
};

/** The forty columns AC-1 asks a name only box to draw none of. */
const WIDE_COLUMNS = Array.from({ length: 40 }, (_, index) => `d${index}`);

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * A chain a - b - c with d hanging off a and e hanging off both b and c, a
 * primary key on four of them, a foreign key where the first link ends, and
 * one row that ends a link without carrying a flag.
 */
function seedDocument(app: AppContext) {
  const { store } = app;
  const link = (
    id: string,
    start: [string, string[]],
    end: [string, string[]]
  ) =>
    addRelationshipAction({
      id,
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: start[0], columnIds: start[1] },
      end: { tableId: end[0], columnIds: end[1] },
    });

  store.dispatchSync(
    ...Object.keys(VIEW_POINTS).map((id, index) =>
      addTableAction({ id, ui: { x: index * 400, y: 0, zIndex: index + 1 } })
    ),
    addColumnAction({ id: 'a_pk', tableId: 'a' }),
    addColumnAction({ id: 'a_plain', tableId: 'a' }),
    addColumnAction({ id: 'b_pk', tableId: 'b' }),
    addColumnAction({ id: 'b_fk', tableId: 'b' }),
    addColumnAction({ id: 'b_ref', tableId: 'b' }),
    addColumnAction({ id: 'b_plain', tableId: 'b' }),
    addColumnAction({ id: 'c_pk', tableId: 'c' }),
    addColumnAction({ id: 'c_fk', tableId: 'c' }),
    addColumnAction({ id: 'e_pk', tableId: 'e' }),
    ...WIDE_COLUMNS.map(id => addColumnAction({ id, tableId: 'd' })),
    changeColumnPrimaryKeyAction({ tableId: 'a', id: 'a_pk', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 'b', id: 'b_pk', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 'c', id: 'c_pk', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 'e', id: 'e_pk', value: true }),
    changeColumnDataTypeAction({ tableId: 'b', id: 'b_pk', value: 'int' }),
    changeColumnDataTypeAction({ tableId: 'c', id: 'c_pk', value: 'int' }),
    changeColumnDataTypeAction({ tableId: 'e', id: 'e_pk', value: 'int' }),
    link('r1', ['a', []], ['b', ['b_fk']]),
    link('r2', ['b', ['b_ref']], ['c', ['c_fk']]),
    link('r3', ['a', []], ['d', []]),
    // e is two hops from a either way, so it is shown and left dark until a
    // hover on c reaches it, which is the half of the highlight rule that
    // needs a card the light does not reach.
    link('r4', ['b', []], ['e', []]),
    link('r5', ['c', []], ['e', []])
  );

  // The foreign key bit is written by the column hook a landed relationship
  // wakes, not by an action of its own, so the fixture sets it as that hook does.
  for (const id of ['b_fk', 'c_fk']) {
    const column = store.state.collections.tableColumnEntities[id];
    column.ui.keys = column.ui.keys | ColumnUIKey.foreignKey;
  }
}

type Mounted = { app: AppContext; stage: Stage };

/**
 * The scene the way a root mounts one: a shell of its own carrying the source,
 * with the Stage container inside it. One store seeds both, since the provider
 * is the only thing that decides which coordinate system a leaf is drawn from.
 */
async function mountScene(
  source: GeometrySource,
  sceneTheme: Theme = createTestTheme()
): Promise<Mounted> {
  const app = createTestAppContext();
  seedDocument(app);
  app.store.dispatchSync(
    changeViewportAction({ width: WIDTH, height: HEIGHT }),
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow }),
    viewOpenAction({ kind: ViewKind.flow }),
    viewChangeShowModeAction({ value: ShowMode.keysOnly, kind: ViewKind.flow }),
    viewSetLayoutAction({ kind: ViewKind.flow, positions: VIEW_POINTS })
  );

  const $root = document.createElement('div');
  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append($root, shell);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(shell as any, sceneSourceContext, source);
  const scene = renderScene({
    app,
    container,
    scene: <CanvasScene root={createRef<HTMLDivElement>($root)} />,
    width: WIDTH,
    height: HEIGHT,
    theme: sceneTheme,
  });

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    scene.destroy();
    provider.destroy();
    shell.remove();
    $root.remove();
  });

  return { app, stage: scene.stage };
}

/**
 * The view standing on no centers, so it shows what its layout placed and
 * lights only what a hover reaches.
 */
const mountViewScene = () => mountScene('flow');

/** The same store and the same leaves under the document provider, which is the ERD tab's own. */
const mountDocumentScene = (sceneTheme?: Theme) =>
  mountScene('document', sceneTheme);

/**
 * The ticker on a clock these cases wind. Vitest gives the file its own module
 * registry, so installing it here reaches every case in it and no other file.
 */
const transitions = stepTransitions();

const commit = async () => {
  await flush();
  await whenDrawn();
};

/**
 * A commit, the whole of the highlight transition, then the commit that writes
 * it. Every case but the ones that measure the walk reads the highlight where
 * it lands rather than partway along.
 */
const settle = async () => {
  await commit();
  transitions.settle();
  await commit();
};

const tableOf = (stage: Stage, id: string) =>
  stage.findOne<Container>(`#table-${id}`) as Container;

const rowIdsOf = (stage: Stage, id: string) =>
  tableOf(stage, id)
    .find('.column-row')
    .map(node => node.getAttr('id'));

const typeOpacityOf = (stage: Stage, id: string) =>
  tableOf(stage, id)
    .find('.columnDataType')
    .map(node => node.opacity());

const typeListeningOf = (stage: Stage, id: string) =>
  tableOf(stage, id)
    .find('.columnDataType')
    .map(node => node.listening());

const bodyOf = (stage: Stage, id: string) =>
  tableOf(stage, id).findOne<KonvaNode>('.table-body') as KonvaNode;

/** One cell of a table, by the focus type its group carries in its name. */
const cellOf = (stage: Stage, id: string, focusType: string) =>
  tableOf(stage, id).findOne<Container>(`.${focusType}`) as Container;

const cellTextOf = (cell: Container) =>
  cell.findOne<KonvaNode>('.cell-text') as KonvaNode;

/** The focus underline under one cell, or null where the source draws none. */
const underlineOf = (stage: Stage, id: string, focusType: string) =>
  cellOf(stage, id, focusType).findOne<KonvaNode>('.cell-focus-border') ?? null;

const glowOf = (stage: Stage, id: string) =>
  tableOf(stage, id).find('.table-glow');

/** The theme the mounts above hand the scene, read again for the paints it names. */
const theme = createTestTheme();

/** Enters and leaves the pointer on one card, which is what the view lights by. */
const enterTable = async (stage: Stage, id: string) => {
  fireScenePointer(tableOf(stage, id), 'mouseenter');
  await settle();
};

const leaveTable = async (stage: Stage, id: string) => {
  fireScenePointer(tableOf(stage, id), 'mouseleave');
  await settle();
};

/**
 * Where the pointer lands to hover one table, in the stage's own coordinates.
 * The shadow a view card casts is left out of the rect, since it reaches past
 * the card and no hit test answers for the ground under it.
 */
const hoverTable = async (stage: Stage, id: string) => {
  await whenPainted();
  const box = tableOf(stage, id).getClientRect({
    relativeTo: stage,
    skipShadow: true,
  });
  moveScenePointer(stage, box.x + box.width / 2, box.y + box.height - 4);
  await settle();
};

describe('the rows a view draws', () => {
  it('keeps the key rows and drops the rest', async () => {
    const { stage } = await mountViewScene();

    // The primary key, the foreign key, and the row that ends a link without
    // carrying a flag; b_plain is in none of those and is not drawn.
    expect(rowIdsOf(stage, 'b')).toEqual([
      'column-b_pk',
      'column-b_fk',
      'column-b_ref',
    ]);
  });

  it('draws a table with no key row as its header alone', async () => {
    const { app, stage } = await mountViewScene();
    const table = app.store.state.collections.tableEntities.d;

    expect(table.columnIds).toHaveLength(WIDE_COLUMNS.length);
    expect(rowIdsOf(stage, 'd')).toEqual([]);
    expect(bodyOf(stage, 'd').height()).toBe(
      calcTableHeight(table, 0, 'flow') - TABLE_BORDER
    );
  });

  it('draws no row at all in name only, whatever the table holds', async () => {
    const { app, stage } = await mountViewScene();

    app.store.dispatchSync(
      viewChangeShowModeAction({ value: ShowMode.nameOnly })
    );
    await settle();

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const table = app.store.state.collections.tableEntities[id];
      expect(rowIdsOf(stage, id)).toEqual([]);
      expect(bodyOf(stage, id).height()).toBe(
        calcTableHeight(table, 0, 'flow') - TABLE_BORDER
      );
    }
  });

  it('takes every row back in all fields', async () => {
    const { app, stage } = await mountViewScene();

    app.store.dispatchSync(
      viewChangeShowModeAction({ value: ShowMode.allFields })
    );
    await settle();

    expect(rowIdsOf(stage, 'b')).toEqual([
      'column-b_pk',
      'column-b_fk',
      'column-b_ref',
      'column-b_plain',
    ]);
  });
});

describe('the type cell a view lights', () => {
  it('draws it on the hovered table and its neighbours alone', async () => {
    const { stage } = await mountViewScene();

    await hoverTable(stage, 'a');

    // Lit: a under the pointer, b across the first link and d across the
    // third. What the hover does not reach, c and e, is shown and left dark.
    expect(typeOpacityOf(stage, 'a')).toEqual([1]);
    expect(typeOpacityOf(stage, 'b')).toEqual([1, 1, 1]);
    expect(typeOpacityOf(stage, 'c')).toEqual([0, 0]);
    expect(typeOpacityOf(stage, 'e')).toEqual([0]);
    // A cell drawn at nothing takes no press either, so the dark half of a
    // view cannot be focused through what it does not show.
    expect(typeListeningOf(stage, 'c')).toEqual([false, false]);
    expect(typeListeningOf(stage, 'b')).toEqual([true, true, true]);
  });

  it('lights a neighbour whose only rows every field brings back', async () => {
    const { app, stage } = await mountViewScene();
    await hoverTable(stage, 'a');

    app.store.dispatchSync(
      viewChangeShowModeAction({ value: ShowMode.allFields })
    );
    await settle();

    // d hangs off the hovered table and carries no key row, so the key row
    // mode has nowhere to show that it is lit; every field gives it forty places.
    expect(typeOpacityOf(stage, 'd')).toEqual(WIDE_COLUMNS.map(() => 1));
    expect(typeOpacityOf(stage, 'c')).toEqual([0, 0]);
  });

  it('lights the hovered table and what it reaches, at the same width', async () => {
    const { stage } = await mountViewScene();
    const dark = bodyOf(stage, 'c').width();

    await hoverTable(stage, 'c');

    expect(typeOpacityOf(stage, 'c')).toEqual([1, 1]);
    expect(bodyOf(stage, 'c').width()).toBe(dark);
    // e is lit here by the hover's own hop and by nothing else.
    expect(typeOpacityOf(stage, 'e')).toEqual([1]);
  });

  it('puts it out again once the pointer leaves', async () => {
    const { stage } = await mountViewScene();

    await hoverTable(stage, 'c');
    expect(typeOpacityOf(stage, 'c')).toEqual([1, 1]);

    moveScenePointer(stage, WIDTH - 2, HEIGHT - 2);
    await settle();

    expect(typeOpacityOf(stage, 'c')).toEqual([0, 0]);
    expect(typeOpacityOf(stage, 'e')).toEqual([0]);
  });

  /**
   * AC-23. The type reads as a type: the code face the SQL panels use, the
   * smallest size on the scale, and set against the right edge of its box.
   */
  it('draws the type in the code face at the smallest size, against the right edge', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();
    const cell = cellTextOf(cellOf(view.stage, 'b', 'columnDataType'));

    expect(cell.getAttr('fontFamily')).toBe(SCENE_CODE_FONT_FAMILY);
    expect(cell.getAttr('fontSize')).toBe(SCENE_FONT_SIZE);
    expect(cell.getAttr('align')).toBe('right');
    // The name beside it keeps the text face, so the contrast is the point.
    expect(
      cellTextOf(cellOf(view.stage, 'b', 'columnName')).getAttr('fontFamily')
    ).toBe(SCENE_FONT_FAMILY);

    // AC-61. The ERD's own type cell is the left aligned text face it was.
    const erdCell = cellTextOf(cellOf(document.stage, 'b', 'columnDataType'));
    expect(erdCell.getAttr('fontFamily')).toBe(SCENE_FONT_FAMILY);
    expect(erdCell.getAttr('align')).toBe('left');
  });

  /** AC-16. The table's colour is the one thing of the document header a view card keeps. */
  it('draws the header colour band, and takes no press anywhere on the header', async () => {
    const { app, stage } = await mountViewScene();
    const header = tableOf(stage, 'a');
    const band = header.findOne<KonvaNode>('.table-header-color') as KonvaNode;

    // The colour is what the band is read for and stays drawn; the picker it
    // opens would stand over a view whose colour change the gate drops, which
    // is the one editable thing the header had left.
    expect(band.getAttr('fill')).toBe(
      app.store.state.collections.tableEntities.a.ui.color
    );
    expect(band.listening()).toBe(false);
    expect(header.find('.table-add-column')).toHaveLength(0);
    expect(header.find('.table-remove')).toHaveLength(0);
  });
});

describe('the card a view draws', () => {
  /** AC-17. The card sits on a shadow a dark document, whose palette casts none, never draws. */
  it('casts a shadow under the card, and casts none in a document that casts none', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene({
      ...createTestTheme(),
      tableShadow: TRANSPARENT,
    });
    const card = bodyOf(view.stage, 'a');

    expect(card.getAttr('shadowColor')).toBe(theme.minimapShadow);
    expect(card.getAttr('shadowBlur')).toBe(VIEW_CARD_SHADOW_BLUR);
    expect(card.getAttr('shadowOffsetX')).toBe(VIEW_CARD_SHADOW_OFFSET_X);
    expect(card.getAttr('shadowOffsetY')).toBe(VIEW_CARD_SHADOW_OFFSET_Y);
    expect(card.getAttr('shadowOpacity')).toBe(VIEW_CARD_SHADOW_OPACITY);
    // The stroke is left out of it, or the border would double the shadow.
    expect(card.getAttr('shadowForStrokeEnabled')).toBe(false);

    // No colour and no blur is konva for a shape that casts nothing at all.
    const plain = bodyOf(document.stage, 'a');
    expect(plain.getAttr('shadowColor')).toBeUndefined();
    expect(plain.getAttr('shadowBlur')).toBe(0);
    // AC-61. No glow either: the document card has no light to wear one for.
    expect(glowOf(document.stage, 'a')).toHaveLength(0);
  });

  it('casts the document shadow under a document table where the palette gives one', async () => {
    const document = await mountDocumentScene();
    const body = bodyOf(document.stage, 'a');

    expect(body.getAttr('shadowColor')).toBe(theme.tableShadow);
    expect(body.getAttr('shadowBlur')).toBe(DOCUMENT_CARD_SHADOW_BLUR);
    expect(body.getAttr('shadowOffsetY')).toBe(DOCUMENT_CARD_SHADOW_OFFSET_Y);
    expect(body.getAttr('shadowOpacity')).toBe(1);
    expect(body.getAttr('shadowForStrokeEnabled')).toBe(false);
  });

  /**
   * AC-18. A lit card takes the accent as its border and wears a glow beside
   * it, both in the one accent the particles and the lit connectors already use.
   */
  it('gives a lit card the accent border and a glow, and leaves an unlit one plain', async () => {
    const { stage } = await mountViewScene();

    expect(bodyOf(stage, 'a').getAttr('stroke')).toBe(theme.tableBorder);
    expect(glowOf(stage, 'a')).toHaveLength(0);

    await enterTable(stage, 'a');

    const glow = glowOf(stage, 'a')[0] as KonvaNode;
    expect(bodyOf(stage, 'a').getAttr('stroke')).toBe(theme.accentColor9);
    expect(glow).toBeDefined();
    expect(glow.getAttr('stroke')).toBe(theme.accentColor9);
    expect(glow.getAttr('shadowColor')).toBe(theme.accentColor9);
    expect(glow.getAttr('shadowBlur')).toBe(VIEW_CARD_GLOW_BLUR);
    expect(glow.getAttr('shadowOpacity')).toBe(VIEW_CARD_GLOW_OPACITY);
    // Stroke only, so nothing has to be reordered under the card body.
    expect(glow.getAttr('shadowForStrokeEnabled')).toBe(true);
    expect(glow.getAttr('fill')).toBeUndefined();

    // c is two hops from a, so it stays the plain card the bare view draws.
    expect(bodyOf(stage, 'c').getAttr('stroke')).toBe(theme.tableBorder);
    expect(glowOf(stage, 'c')).toHaveLength(0);

    await leaveTable(stage, 'a');

    expect(bodyOf(stage, 'a').getAttr('stroke')).toBe(theme.tableBorder);
    expect(glowOf(stage, 'a')).toHaveLength(0);
  });

  /** AC-19. Nothing a view shows is dimmed, whatever the hover lights. */
  it('leaves every card it shows at full opacity while one is hovered', async () => {
    const { stage } = await mountViewScene();

    await enterTable(stage, 'a');

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect({ id, opacity: tableOf(stage, id).opacity() }).toEqual({
        id,
        opacity: 1,
      });
    }
  });
});

const rowBackgroundOf = (row: Container) =>
  (row.findOne<KonvaNode>('.column-row-background') as KonvaNode).getAttr(
    'fill'
  );

const cornerOf = (row: Container) =>
  (row.findOne<KonvaNode>('.column-row-background') as KonvaNode).getAttr(
    'cornerRadius'
  );

const dividerCountsOf = (stage: Stage, id: string) =>
  rowsOf(stage, id).map(row => row.find('.column-row-divider').length);

describe('the rows a view card rules and tints', () => {
  /** AC-20. A line runs under every row of a view card but the last. */
  it('rules a divider under every view row but the last, and none in the document', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();

    // The view shows three of b's rows and the document all four.
    expect(dividerCountsOf(view.stage, 'b')).toEqual([1, 1, 0]);
    expect(
      (
        rowsOf(view.stage, 'b')[0].findOne('.column-row-divider') as KonvaNode
      ).getAttr('stroke')
    ).toBe(theme.tableBorder);
    expect(dividerCountsOf(document.stage, 'b')).toEqual([0, 0, 0, 0]);
  });

  /**
   * A card draws no padding under its rows, so the last one meets the bottom
   * border and takes the corners the card is rounded by. A square tint there
   * would stand outside the body it is drawn in.
   */
  it('ends the card at its last row, on the corners the card is rounded by', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();

    for (const [{ stage }, rowHeight] of [
      [view, VIEW_COLUMN_HEIGHT],
      [document, COLUMN_HEIGHT],
    ] as const) {
      const rows = rowsOf(stage, 'b');
      const last = rows[rows.length - 1];

      expect(last.y() + rowHeight).toBe(bodyOf(stage, 'b').height());
      expect(cornerOf(last)).toEqual([
        0,
        0,
        TABLE_CORNER_RADIUS,
        TABLE_CORNER_RADIUS,
      ]);
      expect(new Set(rows.slice(0, -1).map(cornerOf))).toEqual(new Set([0]));
    }
  });

  /** AC-21 and AC-22. The tint marks a relationship row, and a hover lifts it a step rather than replacing it. */
  it('tints the rows a relationship ends at and lets a hover lift the tint', async () => {
    const { stage } = await mountViewScene();
    // The tint is one of the paints the highlight brings up, so the card is
    // lit for it: b is where the two ends of two links land.
    await enterTable(stage, 'b');
    const [pk, fk, ref] = rowsOf(stage, 'b');

    // b_pk carries a key and no link; b_fk and b_ref are each one end of one.
    expect(rowBackgroundOf(pk)).toBe(TRANSPARENT);
    expect(rowBackgroundOf(fk)).toBe(theme.accentColor3);
    expect(rowBackgroundOf(ref)).toBe(theme.accentColor3);

    fireScenePointer(pk, 'mouseenter');
    fireScenePointer(fk, 'mouseenter');
    await settle();

    expect(rowBackgroundOf(pk)).toBe(theme.columnHover);
    expect(rowBackgroundOf(fk)).toBe(theme.accentColor4);
  });

  /**
   * AC-22 as Step 29 settles it. The tint is one of the five paints the light
   * brings up, so a card the light has not reached rests plain and the rows a
   * link ends at are the rows the bare view already drew.
   */
  it('rests a card untinted until the light reaches it', async () => {
    const { stage } = await mountViewScene();

    expect(rowsOf(stage, 'b').map(rowBackgroundOf)).toEqual([
      TRANSPARENT,
      TRANSPARENT,
      TRANSPARENT,
    ]);

    await enterTable(stage, 'b');

    expect(rowsOf(stage, 'b').map(rowBackgroundOf)).toEqual([
      TRANSPARENT,
      theme.accentColor3,
      theme.accentColor3,
    ]);
  });

  /** AC-61. The ERD row is the one it was: no tint, whatever a link ends on it. */
  it('tints no row in the document, where a relationship row is plain', async () => {
    const { stage } = await mountDocumentScene();

    expect(rowsOf(stage, 'b').map(rowBackgroundOf)).toEqual(
      rowsOf(stage, 'b').map(() => TRANSPARENT)
    );
  });

  /**
   * A view is read only and the ERD tab's column selection is no mark its
   * reader made, so the row carries the hover and never the selection fill.
   * The document card beside it, on the same selection, still paints it.
   */
  it('paints no selection on a view row, and keeps the hover it has', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();
    const select = focusColumnAction({
      tableId: 'b',
      columnId: 'b_pk',
      focusType: FocusType.columnName,
      $mod: false,
      shiftKey: false,
    });

    view.app.store.dispatchSync(select);
    document.app.store.dispatchSync(select);
    await settle();

    const [viewRow] = rowsOf(view.stage, 'b');
    const [documentRow] = rowsOf(document.stage, 'b');
    expect(documentRow.getAttr('id')).toBe(viewRow.getAttr('id'));
    expect(rowBackgroundOf(documentRow)).toBe(theme.columnSelect);
    expect(rowBackgroundOf(viewRow)).toBe(TRANSPARENT);

    fireScenePointer(viewRow, 'mouseenter');
    await settle();

    expect(rowBackgroundOf(rowsOf(view.stage, 'b')[0])).toBe(theme.columnHover);
  });

  /**
   * The other half of the same rule. The focus underline is the ERD tab's mark
   * on the document, so a view draws none of it however the document came to
   * hold one, header cell and row cell alike.
   */
  it('draws no focus underline on a view card, where the document draws one', async () => {
    const view = await mountViewScene();
    const documentScene = await mountDocumentScene();
    const focus = focusColumnAction({
      tableId: 'b',
      columnId: 'b_pk',
      focusType: FocusType.columnName,
      $mod: false,
      shiftKey: false,
    });

    view.app.store.dispatchSync(focus);
    documentScene.app.store.dispatchSync(focus);
    await settle();

    expect(
      underlineOf(documentScene.stage, 'b', FocusType.columnName)
    ).not.toBeNull();
    expect(underlineOf(view.stage, 'b', FocusType.columnName)).toBeNull();

    view.app.store.dispatchSync(
      focusTableAction({ tableId: 'b', focusType: FocusType.tableName })
    );
    documentScene.app.store.dispatchSync(
      focusTableAction({ tableId: 'b', focusType: FocusType.tableName })
    );
    await settle();

    expect(
      underlineOf(documentScene.stage, 'b', FocusType.tableName)
    ).not.toBeNull();
    expect(underlineOf(view.stage, 'b', FocusType.tableName)).toBeNull();
  });

  /**
   * And nothing inside a view puts one there. Pressing a card selects it in
   * either source, but only the document carries the press on down onto the
   * cell it landed on, and only the document draws the underline that focus is.
   */
  it('moves no cell focus when a cell of a view card is pressed', async () => {
    const view = await mountViewScene();
    const documentScene = await mountDocumentScene();

    fireScenePointer(
      cellOf(documentScene.stage, 'b', FocusType.columnName),
      'mousedown'
    );
    fireScenePointer(
      cellOf(view.stage, 'b', FocusType.columnName),
      'mousedown'
    );
    await settle();

    expect(documentScene.app.store.state.editor.focusTable).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'b_pk',
    });
    expect(view.app.store.state.editor.focusTable).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
    });

    expect(underlineOf(view.stage, 'b', FocusType.columnName)).toBeNull();
    expect(underlineOf(view.stage, 'b', FocusType.tableName)).toBeNull();
  });
});

/** The route node of one connector, by the id its group carries beside its name. */
const routeNodeOf = (stage: Stage, id: string) =>
  (stage.findOne<Container>(`.${id}`) as Container).findOne<KonvaNode>(
    '.relationship-route'
  ) as KonvaNode;

/** The colour that node is drawn in. */
const routeOf = (stage: Stage, id: string) =>
  routeNodeOf(stage, id).getAttr('stroke');

/**
 * AC-28's colour half. The reference draws every edge one neutral and tells
 * the two kinds apart nowhere, so a view does neither, and the document keeps
 * the pair of colours and the dash the identifying bit has always picked.
 */
describe('the colour a view rests a connector at', () => {
  const identify = (mounted: Mounted, id: string) => {
    mounted.app.store.state.collections.relationshipEntities[
      id
    ].identification = true;
  };

  it('paints both kinds one neutral, solid, where the document tells them apart', async () => {
    const view = await mountViewScene();
    const documentScene = await mountDocumentScene();
    identify(view, 'r2');
    identify(documentScene, 'r2');
    await settle();

    expect(routeOf(view.stage, 'r1')).toBe(theme.visualizationRelationship);
    expect(routeOf(view.stage, 'r2')).toBe(theme.visualizationRelationship);
    expect(routeNodeOf(view.stage, 'r1').getAttr('dash')).toEqual([]);
    expect(routeNodeOf(view.stage, 'r2').getAttr('dash')).toEqual([]);

    expect(routeOf(documentScene.stage, 'r1')).toBe(theme.keyFK);
    expect(routeOf(documentScene.stage, 'r2')).toBe(theme.keyPFK);
    expect(routeNodeOf(documentScene.stage, 'r1').getAttr('dash')).toEqual([
      10, 10,
    ]);
    expect(routeNodeOf(documentScene.stage, 'r2').getAttr('dash')).toEqual([]);
  });

  it('carries that one neutral into every cardinality decoration it draws', async () => {
    const { stage } = await mountViewScene();
    const group = stage.findOne<Container>('.r1') as Container;
    const painted = group
      .getChildren()
      .filter(node => node.name() !== 'relationship-hit-area');

    // The route, the four decoration lines and the cardinality shape. Counted
    // so that moving them into a sub group empties the loop instead of
    // quietly narrowing it to the route alone.
    expect(painted.length).toBeGreaterThan(5);
    for (const node of painted) {
      expect(node.getAttr('stroke')).toBe(theme.visualizationRelationship);
    }
  });

  it('walks that neutral to the accent, and never the kind colour', async () => {
    const { stage } = await mountViewScene();

    await enterTable(stage, 'b');

    expect(routeOf(stage, 'r1')).toBe(theme.accentColor9);
    expect(
      new Set([theme.visualizationRelationship, theme.keyFK, theme.keyPFK]).size
    ).toBe(3);
  });
});

/**
 * AC-35, AC-36 and AC-37 on one fixture. Every paint the highlight owns is
 * scaled by the one number the card computes, so they cannot come up over
 * different spans however the ticker is wound.
 */
describe('the time a highlight takes', () => {
  it('brings the border, the glow, the type cell, the tint and the connector up over three hundred milliseconds', async () => {
    const { stage } = await mountViewScene();
    // Read before the hover, since the grey a connector rests at is what the
    // walk starts from and the case never assumes which grey that is.
    const grey = routeOf(stage, 'r1');
    const asked = transitions.frames();
    const tintOf = () => rowBackgroundOf(rowsOf(stage, 'b')[1]);

    fireScenePointer(tableOf(stage, 'b'), 'mouseenter');
    await commit();

    // The commit the hover lands on draws the card as it was: the walk starts
    // here rather than a step in.
    expect(typeOpacityOf(stage, 'b')).toEqual([0, 0, 0]);
    expect(bodyOf(stage, 'b').getAttr('stroke')).toBe(theme.tableBorder);
    expect(glowOf(stage, 'b')).toHaveLength(0);
    expect(tintOf()).toBe(TRANSPARENT);
    expect(routeOf(stage, 'r1')).toBe(grey);

    transitions.step(TRANSITION_MS / 2);
    await commit();

    // Ease out puts half the time seven eighths of the way, and the one value
    // is what every paint here is scaled by.
    const half = 0.875;
    const halfStroke = mixColor(theme.tableBorder, theme.accentColor9, half);
    expect(typeOpacityOf(stage, 'b')).toEqual([half, half, half]);
    expect(bodyOf(stage, 'b').getAttr('stroke')).toBe(halfStroke);
    expect(glowOf(stage, 'b')[0].opacity()).toBe(half);
    expect(tintOf()).toBe(
      mixColor(theme.tableBackground, theme.accentColor3, half)
    );
    expect(routeOf(stage, 'r1')).toBe(mixColor(grey, theme.accentColor9, half));
    // Partway is a place of its own, not one of the two ends rounded to.
    expect(
      new Set([theme.tableBorder, halfStroke, theme.accentColor9]).size
    ).toBe(3);
    expect(new Set([grey, routeOf(stage, 'r1'), theme.accentColor9]).size).toBe(
      3
    );

    transitions.step(TRANSITION_MS / 2);
    await commit();

    expect(typeOpacityOf(stage, 'b')).toEqual([1, 1, 1]);
    expect(bodyOf(stage, 'b').getAttr('stroke')).toBe(theme.accentColor9);
    expect(glowOf(stage, 'b')[0].opacity()).toBe(1);
    expect(tintOf()).toBe(theme.accentColor3);
    expect(routeOf(stage, 'r1')).toBe(theme.accentColor9);
    // The counter the document case reads for nothing does rise here, so its
    // zero is a scene that asked for no frame rather than a dead counter.
    expect(transitions.frames()).toBeGreaterThan(asked);
  });

  it('takes the same five back out over the same three hundred', async () => {
    const { stage } = await mountViewScene();
    const grey = routeOf(stage, 'r1');
    const tintOf = () => rowBackgroundOf(rowsOf(stage, 'b')[1]);

    await enterTable(stage, 'b');
    expect(typeOpacityOf(stage, 'b')).toEqual([1, 1, 1]);

    fireScenePointer(tableOf(stage, 'b'), 'mouseleave');
    await commit();
    transitions.step(TRANSITION_MS / 2);
    await commit();

    const half = 1 - 0.875;
    expect(typeOpacityOf(stage, 'b')).toEqual([half, half, half]);
    expect(glowOf(stage, 'b')[0].opacity()).toBe(half);
    expect(bodyOf(stage, 'b').getAttr('stroke')).toBe(
      mixColor(theme.tableBorder, theme.accentColor9, half)
    );
    expect(tintOf()).toBe(
      mixColor(theme.tableBackground, theme.accentColor3, half)
    );
    expect(routeOf(stage, 'r1')).toBe(mixColor(grey, theme.accentColor9, half));

    transitions.step(TRANSITION_MS / 2);
    await commit();

    expect(typeOpacityOf(stage, 'b')).toEqual([0, 0, 0]);
    expect(glowOf(stage, 'b')).toHaveLength(0);
    expect(bodyOf(stage, 'b').getAttr('stroke')).toBe(theme.tableBorder);
    expect(tintOf()).toBe(TRANSPARENT);
    expect(routeOf(stage, 'r1')).toBe(grey);
  });

  /** AC-42's colour half: a connector neither end of which is lit never leaves its grey. */
  it('leaves a connector the light does not reach at the grey it rests on', async () => {
    const { stage } = await mountViewScene();
    const grey = routeOf(stage, 'r5');

    await enterTable(stage, 'b');

    expect(routeOf(stage, 'r1')).toBe(theme.accentColor9);
    expect(routeOf(stage, 'r5')).toBe(grey);
  });

  /**
   * The invariant behind the export worker, which re-renders this table and so
   * carries the ticker: a document scene asks it for no frame, ever.
   */
  it('asks the ticker for no frame in a document scene', async () => {
    const asked = transitions.frames();
    const { stage } = await mountDocumentScene();

    await enterTable(stage, 'b');
    await hoverTable(stage, 'b');
    await leaveTable(stage, 'b');

    expect(transitions.frames()).toBe(asked);
    expect(typeOpacityOf(stage, 'b')).toEqual([1, 1, 1, 1]);
    expect(glowOf(stage, 'b')).toHaveLength(0);
  });
});

const headerInputsOf = (stage: Stage, id: string) =>
  tableOf(stage, id).findOne<KonvaNode>('.table-header-inputs') as KonvaNode;

const rowsOf = (stage: Stage, id: string) =>
  tableOf(stage, id).find<Container>('.column-row');

const rowBackgroundHeights = (stage: Stage, id: string) =>
  rowsOf(stage, id).map(row =>
    (row.findOne<KonvaNode>('.column-row-background') as KonvaNode).height()
  );

const keyBadgeYs = (stage: Stage, id: string) =>
  rowsOf(stage, id).map(row =>
    (row.findOne<KonvaNode>('.column-key') as KonvaNode).y()
  );

/** The pitch the rows are laid on, which is the gap between one row's top and the next. */
const rowPitches = (stage: Stage, id: string) =>
  rowsOf(stage, id)
    .map(row => row.y())
    .slice(1)
    .map((y, index) => y - rowsOf(stage, id)[index].y());

const bandOf = (stage: Stage, id: string) =>
  tableOf(stage, id).findOne<KonvaNode>('.table-header-band') ?? null;

const headerColorOf = (stage: Stage, id: string) =>
  tableOf(stage, id).findOne<KonvaNode>('.table-header-color') as KonvaNode;

const headerIconOf = (stage: Stage, id: string) =>
  tableOf(stage, id).findOne<KonvaNode>('.table-header-icon') ?? null;

const nameTextOf = (stage: Stage, id: string) =>
  cellTextOf(cellOf(stage, id, 'tableName'));

/**
 * The two pieces of document a reader sets in the ERD tab and a view then has
 * to draw. Written straight onto the entity, the way the fixture writes the
 * foreign key bits, because the view gate drops an edit dispatched over a view.
 */
const paintTable = (
  app: AppContext,
  id: string,
  name: string,
  color: string
) => {
  const table = app.store.state.collections.tableEntities[id];
  table.name = name;
  table.ui.color = color;
};

const nameColumn = (app: AppContext, id: string, name: string) => {
  app.store.state.collections.tableColumnEntities[id].name = name;
};

/**
 * The card a view draws against the reference's node: a muted band across the
 * header carrying a table icon and a larger, muted name, and a minimum width
 * under the whole of it. The document card wears the band and icon at its own sizes.
 */
describe('the header a view card wears', () => {
  it('lays a muted band from the top border down to the first row', async () => {
    const { stage } = await mountViewScene();
    const band = bandOf(stage, 'b');
    const body = bodyOf(stage, 'b');

    expect(band).not.toBeNull();
    expect(band!.getAttr('fill')).toBe(theme.tableHeaderBackground);
    expect(band!.getAttr('fill')).not.toBe(theme.tableBackground);
    expect(band!.y()).toBe(TABLE_BORDER);
    expect(band!.height()).toBe(
      TABLE_BORDER + TABLE_PADDING + VIEW_TABLE_HEADER_HEIGHT - TABLE_BORDER
    );
    expect(band!.width()).toBe(body.width() - TABLE_BORDER);
    expect(band!.getAttr('cornerRadius')).toEqual([
      TABLE_CORNER_RADIUS,
      TABLE_CORNER_RADIUS,
      0,
      0,
    ]);
  });

  /**
   * A card the show mode leaves without a row is its header and nothing else.
   * A band stopping under the header leaves the padding below it painted in the
   * body's colour, which reads as a strip of a second colour along the bottom.
   */
  it('fills a card that draws no row, all four corners with it', async () => {
    const { app, stage } = await mountViewScene();

    const rowless = (id: string) => {
      const band = bandOf(stage, id);
      const body = bodyOf(stage, id);

      expect(rowIdsOf(stage, id)).toEqual([]);
      expect(band!.y()).toBe(TABLE_BORDER);
      expect(band!.height()).toBe(body.height() - TABLE_BORDER);
      expect(band!.getAttr('cornerRadius')).toBe(TABLE_CORNER_RADIUS);
    };

    // d holds forty rows and no key among them, so the keys only mode the view
    // opens on already leaves it with nothing to draw under its header.
    rowless('d');

    app.store.dispatchSync(
      viewChangeShowModeAction({ value: ShowMode.nameOnly })
    );
    await settle();

    for (const id of ['a', 'b', 'c', 'd', 'e']) rowless(id);
  });

  /**
   * The colour a reader painted is document information the view keeps, so it
   * runs down the card's left edge over the band and the rows: the card wears
   * both, rather than one of them standing in for the other.
   */
  it('keeps the colour a reader painted down the left edge, over that band', async () => {
    const { app, stage } = await mountViewScene();
    paintTable(app, 'b', 'users', '#ff0000');
    await settle();

    const table = tableOf(stage, 'b');
    const edge = headerColorOf(stage, 'b');
    const band = bandOf(stage, 'b');
    const box = edge.getClientRect({ relativeTo: table });

    expect(edge.getAttr('fill')).toBe('#ff0000');
    expect(edge.zIndex()).toBeGreaterThan(band!.zIndex());
    expect(box.x).toBeCloseTo(0, 5);
    expect(box.width).toBeCloseTo(TABLE_COLOR_WIDTH, 5);
    expect(box.height).toBeGreaterThan(band!.height());
  });

  it('draws the band on a document card too, over its own header line', async () => {
    const { stage } = await mountDocumentScene();
    const band = bandOf(stage, 'b');

    expect(band).not.toBeNull();
    expect(band!.getAttr('fill')).toBe(theme.tableHeaderBackground);
    expect(band!.height()).toBe(
      TABLE_INSET + TABLE_HEADER_HEIGHT - TABLE_BORDER
    );
    expect(band!.height()).toBe(
      TABLE_HEADER_INPUT_HEIGHT + TABLE_HEADER_BAND_PADDING * 2
    );
  });

  it('stands a table icon before the name, at the size each source draws it', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();
    const icon = headerIconOf(view.stage, 'b');
    const documentIcon = headerIconOf(document.stage, 'b');

    expect(icon).not.toBeNull();
    expect(icon!.scaleX()).toBe(VIEW_TABLE_HEADER_ICON_SIZE / 24);
    expect(icon!.x()).toBe(0);
    expect(icon!.y()).toBe(0);

    // The document centres its smaller icon on the input line the name sits in.
    expect(documentIcon).not.toBeNull();
    expect(documentIcon!.scaleX()).toBe(TABLE_HEADER_ICON_SIZE / 24);
    expect(documentIcon!.x()).toBe(0);
    expect(documentIcon!.y()).toBe(
      (TABLE_HEADER_INPUT_HEIGHT - TABLE_HEADER_ICON_SIZE) / 2
    );
  });

  it('leaves the name room past that icon, and no row cell with it', async () => {
    const { app, stage } = await mountViewScene();
    const table = app.store.state.collections.tableEntities.b;

    expect(cellOf(stage, 'b', 'tableName').x()).toBe(
      VIEW_TABLE_HEADER_ICON_SIZE + VIEW_TABLE_HEADER_ICON_GAP
    );
    expect(nameTextOf(stage, 'b').width()).toBe(
      viewHeaderNameWidth(table.ui.widthName)
    );
  });

  /**
   * The same title on the other axis. The gap under a view header holds it off
   * the first row, so a card drawing no row leaves that gap out: the title is
   * the card's one line of content, inside its padding, on the middle of the box.
   */
  it('centres it up and down on a card that draws no row', async () => {
    const { stage } = await mountViewScene();
    const height = bodyOf(stage, 'd').height() + TABLE_BORDER;
    const above = TABLE_INSET + headerInputsOf(stage, 'd').y();

    expect(rowIdsOf(stage, 'd')).toEqual([]);
    expect(headerIconOf(stage, 'd')!.y()).toBe(0);
    expect(above).toBe(height - above - VIEW_TABLE_HEADER_ICON_SIZE);
  });

  /** The one gap the reference draws between its header and its rows. */
  it('draws the name larger, heavier and muted against the rows', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();
    paintTable(view.app, 'b', 'users', '');
    paintTable(document.app, 'b', 'users', '');
    nameColumn(view.app, 'b_pk', 'id');
    nameColumn(document.app, 'b_pk', 'id');
    await settle();

    const name = nameTextOf(view.stage, 'b');
    const row = cellTextOf(cellOf(view.stage, 'b', 'columnName'));

    expect(name.getAttr('fontSize')).toBe(VIEW_TABLE_HEADER_FONT_SIZE);
    expect(name.getAttr('fontStyle')).toBe(VIEW_HEADER_FONT_WEIGHT);
    expect(name.getAttr('fill')).toBe(theme.foreground);

    expect(row.getAttr('fontSize')).toBe(SCENE_FONT_SIZE);
    expect(row.getAttr('fontStyle')).toBe(SCENE_FONT_WEIGHT);
    expect(row.getAttr('fill')).toBe(theme.active);

    // The document header is the loud one of the two, which is the split this
    // reverses for a view: there the name outranks the rows it stands over.
    const documentName = nameTextOf(document.stage, 'b');
    expect(documentName.getAttr('fontSize')).toBe(SCENE_FONT_SIZE);
    expect(documentName.getAttr('fontStyle')).toBe(SCENE_FONT_WEIGHT);
    expect(documentName.getAttr('fill')).toBe(theme.active);
  });

  it('centres the name and the two buttons on the icon line', async () => {
    const { stage } = await mountViewScene();
    await enterTable(stage, 'b');

    expect(nameTextOf(stage, 'b').y()).toBe(0);
    expect(nameTextOf(stage, 'b').height()).toBe(VIEW_TABLE_HEADER_ICON_SIZE);
    expect(buttonOf(stage, 'b', 'table-related')!.y()).toBe(
      (VIEW_TABLE_HEADER_ICON_SIZE - VIEW_TABLE_HEADER_BUTTON_SIZE) / 2
    );
    expect(buttonOf(stage, 'b', 'table-go-to-erd')!.y()).toBe(
      (VIEW_TABLE_HEADER_ICON_SIZE - VIEW_TABLE_HEADER_BUTTON_SIZE) / 2
    );
  });

  /**
   * The table with no key row is the narrow one: its header alone would leave a
   * cramped box, so the minimum is what it is drawn at while the document card
   * for the same table is measured by its forty columns.
   */
  it('draws no card under the minimum width', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();

    expect(bodyOf(view.stage, 'd').width()).toBe(
      VIEW_TABLE_MIN_WIDTH - TABLE_BORDER
    );
    expect(bodyOf(document.stage, 'd').width()).toBeGreaterThan(
      VIEW_TABLE_MIN_WIDTH
    );
  });
});

/**
 * AC-15's other half, on the scene rather than in the arithmetic: the source
 * reaches every place a card is drawn from, so a call site that dropped it
 * would draw a view card on the document's own header band and row pitch.
 */
describe('the source the drawn card is measured by', () => {
  it('draws a view card on the view header and the view row', async () => {
    const { stage } = await mountViewScene();

    expect(headerInputsOf(stage, 'b').y()).toBe(0);
    expect(rowBackgroundHeights(stage, 'b')).toEqual([
      VIEW_COLUMN_HEIGHT,
      VIEW_COLUMN_HEIGHT,
      VIEW_COLUMN_HEIGHT,
    ]);
    expect(rowPitches(stage, 'b')).toEqual([
      VIEW_COLUMN_HEIGHT,
      VIEW_COLUMN_HEIGHT,
    ]);
    expect(keyBadgeYs(stage, 'b')).toEqual([
      (VIEW_COLUMN_HEIGHT - VIEW_COLUMN_ICON_SIZE) / 2,
      (VIEW_COLUMN_HEIGHT - VIEW_COLUMN_ICON_SIZE) / 2,
      (VIEW_COLUMN_HEIGHT - VIEW_COLUMN_ICON_SIZE) / 2,
    ]);
  });

  it('runs a document header band from the top border, over the card padding, on the document row', async () => {
    const { stage } = await mountDocumentScene();

    // The header group sits at the inset, so the line climbs back to the border.
    expect(headerInputsOf(stage, 'b').y()).toBe(
      TABLE_BORDER + TABLE_HEADER_BAND_PADDING - TABLE_INSET
    );
    expect(new Set(rowBackgroundHeights(stage, 'b'))).toEqual(
      new Set([COLUMN_HEIGHT])
    );
    expect(new Set(rowPitches(stage, 'b'))).toEqual(new Set([COLUMN_HEIGHT]));
    expect(new Set(keyBadgeYs(stage, 'b'))).toEqual(
      new Set([(COLUMN_HEIGHT - COLUMN_KEY_WIDTH) / 2])
    );
  });

  it('gives a cell the hit box of the source it is drawn from', async () => {
    const view = await mountViewScene();
    const document = await mountDocumentScene();

    expect(
      cellTextOf(cellOf(view.stage, 'b', 'columnName')).getAttr('hitFunc')
    ).toBe(columnCellHit.flow);
    expect(
      cellTextOf(cellOf(document.stage, 'b', 'columnName')).getAttr('hitFunc')
    ).toBe(columnCellHit.document);
  });
});

const buttonOf = (stage: Stage, id: string, name: string) =>
  tableOf(stage, id).findOne<Container>(`.${name}`) ?? null;

/**
 * The press, the lift and the click a reader lands on a header button. Konva
 * names a press for the shape under the pointer and bubbles it from there, so
 * the card behind the button sees it go past, which is half of what it means.
 */
async function pressButton(stage: Stage, id: string, name: string) {
  const at = { clientX: 20, clientY: 20 };
  const shape = buttonOf(stage, id, name)?.getChildren()[0];
  // A press on nothing reads like a button that did nothing, so an unhovered
  // card would pass the cases below for the wrong reason.
  expect(shape).toBeDefined();

  fireScenePointer(shape!, 'mousedown', at);
  await settle();
  fireScenePointer(shape!, 'mouseup', at);
  fireScenePointer(shape!, 'click', at);
  await settle();
}

/** Every action type the store took from now on, which is what AC-60 counts. */
function recordActions(app: AppContext): string[] {
  const types: string[] = [];
  app.store.subscribe(actions => {
    types.push(...actions.map(action => action.type));
  });

  return types;
}

describe('the two buttons a view card header carries', () => {
  /** AC-26 and AC-27. Neither button is there until the card is under the pointer. */
  it('shows Related and Go to ERD on the hovered card alone', async () => {
    const { stage } = await mountViewScene();

    expect(buttonOf(stage, 'a', 'table-related')).toBeNull();
    expect(buttonOf(stage, 'a', 'table-go-to-erd')).toBeNull();

    await enterTable(stage, 'a');

    const related = buttonOf(stage, 'a', 'table-related');
    expect(related).not.toBeNull();
    expect(buttonOf(stage, 'a', 'table-go-to-erd')).not.toBeNull();
    expect(related!.scaleX()).toBe(VIEW_TABLE_HEADER_BUTTON_SIZE / 24);
    // The card beside it is not hovered and carries neither.
    expect(buttonOf(stage, 'b', 'table-related')).toBeNull();

    await leaveTable(stage, 'a');

    expect(buttonOf(stage, 'a', 'table-related')).toBeNull();
    expect(buttonOf(stage, 'a', 'table-go-to-erd')).toBeNull();
  });

  /** AC-26. The ERD keeps the add and remove icons the view gave that room to. */
  it('leaves the document header on its add and remove icons', async () => {
    const { stage } = await mountDocumentScene();

    // Hovered, which is the half of the gate the source decides: an unhovered
    // card carries neither button in either scene, so a document card that
    // lost its source branch would still read empty here.
    await enterTable(stage, 'a');
    const header = tableOf(stage, 'a');

    expect(header.find('.table-add-column')).toHaveLength(1);
    expect(header.find('.table-remove')).toHaveLength(1);
    expect(header.find('.table-related')).toHaveLength(0);
    expect(header.find('.table-go-to-erd')).toHaveLength(0);
  });

  /** AC-45. Related narrows the display set to that table and its one hop. */
  it('narrows the view to the table and its one hop on Related', async () => {
    const { app, stage } = await mountViewScene();
    await enterTable(stage, 'a');

    await pressButton(stage, 'a', 'table-related');
    const drawn = () =>
      stage
        .find('.table')
        .map(node => node.id().replace('table-', ''))
        .sort();

    expect(app.store.state.editor.views.flow?.centerIds).toEqual(['a']);
    // a is the center, b across the first link and d across the third; c and
    // e are two hops out and leave the display set with it.
    const reached = getReachedTableIds(app.store.state, ['a']);
    expect(reached).toEqual(['a', 'b', 'd']);
    // No placement loop runs under this scene, so the cards stay on the
    // landing they had until the one for the narrowed set is landed here.
    expect(drawn()).toEqual(['a', 'b', 'c', 'd', 'e']);

    app.store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: Object.fromEntries(reached.map(id => [id, VIEW_POINTS[id]])),
      })
    );
    await settle();

    expect(drawn()).toEqual(['a', 'b', 'd']);
  });

  /**
   * AC-48 and AC-60. Go to ERD swaps the tab, selects the table and scrolls to
   * it, and the tab change with the one scroll is everything the host hears.
   */
  it('swaps to the ERD tab and scrolls to a table the document keeps off screen', async () => {
    const { app, stage } = await mountViewScene();
    await enterTable(stage, 'e');
    const types = recordActions(app);

    await pressButton(stage, 'e', 'table-go-to-erd');

    const { settings, editor } = app.store.state;
    expect(settings.canvasType).toBe(CanvasType.ERD);
    expect(Boolean(editor.selectedMap.e)).toBe(true);
    expect(settings.originX).not.toBe(0);
    expect(types.filter(type => type === 'settings.scrollTo')).toHaveLength(1);
    expect(
      types.filter(
        type => type.startsWith('settings.') || type === 'editor.scrollTo'
      )
    ).toEqual(['settings.changeCanvasType', 'settings.scrollTo']);
    // The view's own placement is untouched: the scroll was the document's.
    expect(app.store.state.editor.views.flow?.originX).toBe(0);
  });

  /** AC-48. A table already on screen is swapped to and never scrolled to. */
  it('swaps to the ERD tab without a scroll for a table already on screen', async () => {
    const { app, stage } = await mountViewScene();
    await enterTable(stage, 'a');
    const types = recordActions(app);

    await pressButton(stage, 'a', 'table-go-to-erd');

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(Boolean(app.store.state.editor.selectedMap.a)).toBe(true);
    expect(types.filter(type => type === 'settings.scrollTo')).toHaveLength(0);
    expect(app.store.state.settings.originX).toBe(0);
  });
});

describe('the cursor a card body wears', () => {
  /** AC-44's other half: the body is what a click pins the light on, so it asks for the hand. */
  it('is the pointer under a view provider, and hands it back on the way out', async () => {
    const { stage } = await mountViewScene();

    fireScenePointer(bodyOf(stage, 'a'), 'mouseenter');
    await settle();
    expect(stage.container().style.cursor).toBe(CURSOR_POINTER);

    fireScenePointer(bodyOf(stage, 'a'), 'mouseleave');
    await settle();
    expect(stage.container().style.cursor).toBe(CURSOR_INHERIT);
  });

  /**
   * AC-61. The two handlers are on a leaf both scenes share, so the view guard
   * is the whole of the separation: drop it and every table on the ERD canvas
   * takes the hand, and a leave stamps over whatever a drag had set.
   */
  it('is left alone under a document provider, which takes no such click', async () => {
    const { stage } = await mountDocumentScene();
    stage.container().style.cursor = 'grab';

    fireScenePointer(bodyOf(stage, 'a'), 'mouseenter');
    await settle();
    expect(stage.container().style.cursor).toBe('grab');

    fireScenePointer(bodyOf(stage, 'a'), 'mouseleave');
    await settle();
    expect(stage.container().style.cursor).toBe('grab');
  });
});

describe('the edits a view refuses', () => {
  it.each([
    ['header', 'tableName'],
    ['column', 'columnName'],
  ])('opens no editor on a double click in a %s cell', async (_, name) => {
    const { app, stage } = await mountViewScene();
    const cell = cellOf(stage, 'a', name);

    fireScenePointer(cell, 'mousedown');
    fireScenePointer(cell, 'dblclick', { detail: 2 });
    await settle();

    // The press still focuses, which is what says the cell answered at all;
    // the pair behind it opens nothing and the text stays where it was.
    expect(app.store.state.editor.focusTable?.edit).toBe(false);
    expect(cellTextOf(cell).visible()).toBe(true);
  });

  it('keeps its header cell drawn while the document edits that cell', async () => {
    const { app, stage } = await mountViewScene();

    app.store.dispatchSync(
      focusTableAction({ tableId: 'a', focusType: FocusType.tableName }),
      editTableAction()
    );
    await settle();

    // The editor is the document overlay's and stands on the document
    // placement, so hiding this copy would leave a hole with no input in it.
    expect(app.store.state.editor.focusTable?.edit).toBe(true);
    expect(cellTextOf(cellOf(stage, 'a', 'tableName')).visible()).toBe(true);
  });

  it('keeps its column cell drawn while the document edits that cell', async () => {
    const { app, stage } = await mountViewScene();

    app.store.dispatchSync(
      focusColumnAction({
        tableId: 'a',
        columnId: 'a_pk',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      }),
      editTableAction()
    );
    await settle();

    expect(app.store.state.editor.focusTable?.edit).toBe(true);
    expect(cellTextOf(cellOf(stage, 'a', 'columnName')).visible()).toBe(true);
  });
});
