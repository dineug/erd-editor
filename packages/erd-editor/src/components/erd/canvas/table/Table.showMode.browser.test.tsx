/** @jsxHost konva */

// AC-1, AC-2, AC-3, AC-5, AC-27 and AC-45: what a table draws inside a view,
// and what it refuses. The show mode picks the rows, the box is measured for
// them, the type cell lights only where the view does, and no cell is edited.

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
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { TABLE_BORDER } from '@/constants/layout';
import { ColumnUIKey, RelationshipType } from '@/constants/schema';
import {
  changeViewportAction,
  editTableAction,
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { calcTableHeight } from '@/utils/calcTable';

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
    // e is two hops out either way, so it is shown and left dark until a
    // hover on c reaches it. That is the half of the highlight rule the
    // centres cannot show, since every neighbour of a centre is lit already.
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
 * The scene as the Focus overlay mounts one: a shell of its own carrying the
 * source, with the Stage container inside it.
 */
async function mountViewScene(): Promise<Mounted> {
  const app = createTestAppContext();
  seedDocument(app);
  app.store.dispatchSync(
    changeViewportAction({ width: WIDTH, height: HEIGHT }),
    viewOpenAction({ kind: ViewKind.focus, centerIds: ['a'] }),
    viewChangeHopAction({ value: 2 }),
    viewSetLayoutAction({ kind: ViewKind.focus, positions: VIEW_POINTS })
  );

  const $root = document.createElement('div');
  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append($root, shell);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(shell as any, sceneSourceContext, 'focus');
  const scene = renderScene({
    app,
    container,
    scene: <CanvasScene root={createRef<HTMLDivElement>($root)} />,
    width: WIDTH,
    height: HEIGHT,
    theme: createTestTheme(),
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

const settle = async () => {
  await flush();
  await whenDrawn();
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

/** Where the pointer lands to hover one table, in the stage's own coordinates. */
const hoverTable = async (stage: Stage, id: string) => {
  await whenPainted();
  const box = tableOf(stage, id).getClientRect({ relativeTo: stage });
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
      calcTableHeight(table, 0) - TABLE_BORDER
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
        calcTableHeight(table, 0) - TABLE_BORDER
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
  it('draws it on the centers and their neighbours alone', async () => {
    const { stage } = await mountViewScene();

    // Lit: the centre a, b across the first link and d across the third. The
    // second hop, c and e, is shown at hop two and left dark.
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

    app.store.dispatchSync(
      viewChangeShowModeAction({ value: ShowMode.allFields })
    );
    await settle();

    // d hangs off the centre and carries no key row, so the key row mode has
    // nowhere to show that it is lit; every field gives it forty places.
    expect(typeOpacityOf(stage, 'd')).toEqual(WIDE_COLUMNS.map(() => 1));
    expect(typeOpacityOf(stage, 'c')).toEqual([0, 0]);
  });

  it('lights the hovered table and what it reaches, at the same width', async () => {
    const { stage } = await mountViewScene();
    const dark = bodyOf(stage, 'c').width();

    await hoverTable(stage, 'c');

    expect(typeOpacityOf(stage, 'c')).toEqual([1, 1]);
    expect(bodyOf(stage, 'c').width()).toBe(dark);
    // e is nobody's neighbour among the centres, so it is lit here by the
    // hover's own hop and by nothing else.
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
