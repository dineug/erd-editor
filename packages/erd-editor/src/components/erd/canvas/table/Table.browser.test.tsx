/** @jsxHost konva */

import { type DOMTemplateLiterals } from '@dineug/r-html';
import { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  fireSceneTouch,
  flush,
  movePointer,
  moveScenePointer,
  moveTouch,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  HEADER_COLOR_HEIGHT,
  TABLE_INSET,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import Table from '@/components/erd/canvas/table/Table';
import { INPUT_MARGIN_RIGHT, TABLE_BORDER } from '@/constants/layout';
import { Show } from '@/constants/schema';
import {
  dragendColumnAction,
  editTableAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import {
  FocusType,
  SelectType,
  type SharedFocus,
} from '@/engine/modules/editor/state';
import {
  changeMaxWidthCommentAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { Tag } from '@/engine/tag';
import type { Table as TableEntity } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

type SceneProps = {
  hovered?: boolean;
  hoveredColumnId?: string | null;
  ghostColumnId?: string | null;
  editorFocused?: boolean;
  visible?: boolean;
};

type SetupOptions = {
  columns?: number;
  props?: SceneProps;
  prepare?: (app: AppContext) => void;
};

type Fixture = {
  app: AppContext;
  table: TableEntity;
  theme: Theme;
  stage: Stage;
  rerender: (props: SceneProps) => Promise<void>;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function setup({
  columns = 0,
  props = {},
  prepare,
}: SetupOptions = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  prepare?.(app);
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  const table = store.state.collections.tableEntities[tableId];

  for (let i = 0; i < columns; i++) {
    store.dispatchSync(addColumnAction$(tableId));
  }

  // Adding a table selects and focuses it, which is a state every test that
  // means to assert one dispatches for itself. The fixture is the table at rest.
  store.dispatchSync(unselectAllAction(), focusTableEndAction());

  const container = document.createElement('div');
  document.body.append(container);
  const theme = createTestTheme();

  const scene = (next: SceneProps): DOMTemplateLiterals => (
    <k-layer name="scene">
      <Table
        table={table}
        hovered={next.hovered}
        hoveredColumnId={next.hoveredColumnId}
        ghostColumnId={next.ghostColumnId}
        editorFocused={next.editorFocused}
        visible={next.visible}
      />
    </k-layer>
  );

  const rendered = renderScene({
    app,
    container,
    scene: scene(props),
    width: 900,
    height: 700,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return {
    app,
    table,
    theme,
    stage: rendered.stage,
    rerender: async (next: SceneProps) => {
      renderKonva(rendered.stage, scene(next));
      await flush();
      await whenDrawn();
    },
  };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const rootOf = (stage: Stage) => stage.findOne<Group>('.table') as Group;

const named = <T extends KonvaNode>(root: Group, name: string) =>
  root.findOne<T>(`.${name}`) as T;

/**
 * The table's box, once konva has painted the hit graph a pointer is tested
 * against. Returned in the stage content's own coordinates, which is what
 * moveScenePointer takes.
 */
const hoverable = async (stage: Stage) => {
  await whenPainted();
  return rootOf(stage).getClientRect({ relativeTo: stage });
};

const strokesOf = (root: Group, name: string) =>
  named<Group>(root, name)
    .find('Path')
    .map(node => node.getAttr('stroke'));

const trackFocus = (
  app: AppContext,
  focus: SharedFocus | null,
  editorId = 'remote-1'
) => {
  app.store.dispatchSync({
    ...sharedFocusTrackerAction({ focus }),
    tags: Tag.shared,
    meta: { editorId },
  });
};

const trackSelection = (
  app: AppContext,
  selectedIds: string[],
  editorId = 'remote-2'
) => {
  app.store.dispatchSync({
    ...sharedSelectionTrackerAction({ selectedIds }),
    tags: Tag.shared,
    meta: { editorId },
  });
};

const ringOf = (stage: Stage) => rootOf(stage).findOne<Rect>('.table-ring');

const focusOn = (
  tableId: string,
  focusType: SharedFocus['focusType'] = FocusType.tableName
): SharedFocus => ({
  tableId,
  columnId: null,
  focusType,
});

describe('the table group carries the scene conventions', () => {
  it('takes the id, the name and the kind an ancestor walk reads', async () => {
    const { stage, table } = await setup();
    const root = rootOf(stage);

    expect(root.id()).toBe(`table-${table.id}`);
    expect(root.name()).toBe('table');
    expect(root.getAttr('kind')).toBe('table');
  });

  it('sits where the table box metrics put it', async () => {
    const { app, stage, table } = await setup({ columns: 2 });
    const rect = getTableRect(app.store.state, table);
    const root = rootOf(stage);
    const body = named<Rect>(root, 'table-body');

    expect(root.x()).toBe(rect.x);
    expect(root.y()).toBe(rect.y);
    expect(body.width()).toBe(rect.width - TABLE_BORDER);
    expect(body.height()).toBe(rect.height - TABLE_BORDER);
  });

  it('writes no zIndex, leaving the sibling order to carry it', async () => {
    const { stage } = await setup({ columns: 1 });
    const root = rootOf(stage);
    const written = [root, ...root.find('Group'), ...root.find('Rect')].filter(
      node => Object.hasOwn(node.attrs, 'zIndex')
    );

    expect(written).toEqual([]);
  });
});

describe('the table body and its rings', () => {
  it('paints the theme background and the resting border', async () => {
    const { stage, theme } = await setup();
    const body = named<Rect>(rootOf(stage), 'table-body');

    expect(body.fill()).toBe(theme.tableBackground);
    expect(body.stroke()).toBe(theme.tableBorder);
  });

  it('switches the border to the select colour once selected', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(selectTableAction$(table.id, false));
    await settle();

    expect(named<Rect>(rootOf(stage), 'table-body').stroke()).toBe(
      theme.tableSelect
    );
  });

  it('greys the select border while the editor itself is unfocused', async () => {
    const { app, stage, table, theme, rerender } = await setup();

    app.store.dispatchSync(selectTableAction$(table.id, false));
    await settle();
    await rerender({ editorFocused: false });

    expect(named<Rect>(rootOf(stage), 'table-body').stroke()).toBe(
      theme.placeholder
    );
  });

  it('leaves the ring off until a peer focuses or selects the table', async () => {
    const { stage } = await setup();

    expect(rootOf(stage).findOne('.table-ring')).toBeUndefined();
  });

  it('rings the box in the peer colour for a shared focus', async () => {
    const { app, stage, table } = await setup();

    trackFocus(app, {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await settle();

    expect(named<Rect>(rootOf(stage), 'table-ring').stroke()).toBeTruthy();
  });

  it('rings the box for a shared selection too', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, [table.id]);
    await settle();

    expect(named<Rect>(rootOf(stage), 'table-ring').stroke()).toBeTruthy();
  });

  it('ignores a remote focus that names another table', async () => {
    const { app, stage } = await setup();

    trackFocus(app, focusOn('some-other-table'));
    await settle();

    expect(ringOf(stage)).toBeUndefined();
    expect(
      named<Group>(rootOf(stage), 'tableName').findOne(
        '.cell-shared-focus-border'
      )
    ).toBeUndefined();
  });

  it('never moves the local focus', async () => {
    const { app, table } = await setup();
    const before = app.store.state.editor.focusTable;

    trackFocus(app, focusOn(table.id));
    await settle();

    expect(app.store.state.editor.focusTable).toBe(before);
  });

  it('clears the marker when the remote editor drops its focus', async () => {
    const { app, stage, table } = await setup();

    trackFocus(app, focusOn(table.id));
    await settle();
    expect(ringOf(stage)).toBeTruthy();

    trackFocus(app, null);
    await settle();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('gives two peers their own colors for a shared focus', async () => {
    const { app, stage, table } = await setup();

    trackFocus(app, focusOn(table.id), 'peer-a');
    await settle();
    const first = (ringOf(stage) as Rect).stroke();

    trackFocus(app, null, 'peer-a');
    trackFocus(app, focusOn(table.id), 'peer-b');
    await settle();

    expect(first).toBeTruthy();
    expect((ringOf(stage) as Rect).stroke()).not.toBe(first);
  });

  it('leaves the shell unmarked while the peer selects another entity', async () => {
    const { app, stage } = await setup();

    trackSelection(app, ['some-other-entity']);
    await settle();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('marks the shell when the peer selection holds several ids', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, ['some-other-entity', table.id]);
    await settle();

    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
  });

  it('follows a peer that widens its selection onto this table', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, ['some-other-entity']);
    await settle();
    expect(ringOf(stage)).toBeUndefined();

    trackSelection(app, ['some-other-entity', table.id]);
    await settle();

    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
  });

  it('clears the marker when the peer selection empties', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, [table.id]);
    await settle();
    expect(ringOf(stage)).toBeTruthy();

    trackSelection(app, []);
    await settle();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('gives two peers their own colors for a shared selection', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, [table.id], 'peer-a');
    await settle();
    const first = (ringOf(stage) as Rect).stroke();

    trackSelection(app, [], 'peer-a');
    trackSelection(app, [table.id], 'peer-b');
    await settle();

    expect(first).toBeTruthy();
    expect((ringOf(stage) as Rect).stroke()).not.toBe(first);
  });

  it('never writes a peer selection into the local selection map', async () => {
    const { app, table } = await setup();

    trackSelection(app, [table.id]);
    await settle();

    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('carries a local selection, a peer selection and a peer focus at once', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(selectTableAction$(table.id, false));
    trackSelection(app, [table.id], 'peer-a');
    trackFocus(app, focusOn(table.id, FocusType.tableComment), 'peer-b');
    await settle();

    const root = rootOf(stage);

    expect(named<Rect>(root, 'table-body').stroke()).toBe(theme.tableSelect);
    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
    expect(
      named<Group>(root, 'tableComment').findOne('.cell-shared-focus-border')
    ).toBeTruthy();
    expect(app.store.state.editor.selectedMap).toEqual({
      [table.id]: SelectType.table,
    });
  });
});

describe('the table header', () => {
  it('draws the colour bar with the table colour and its own kind', async () => {
    const { app, stage, table } = await setup();

    app.store.dispatchSync(
      changeTableColorAction({ id: table.id, color: '#ff00aa', prevColor: '' })
    );
    await settle();

    const bar = named<Rect>(rootOf(stage), 'table-header-color');

    expect(bar.fill()).toBe('#ff00aa');
    expect(bar.getAttr('kind')).toBe('table-header-color');
    expect(bar.height()).toBe(HEADER_COLOR_HEIGHT);
  });

  it('hides the header icons until the table is hovered', async () => {
    const { stage, theme, rerender } = await setup();
    const root = rootOf(stage);

    expect(strokesOf(root, 'table-add-column')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);

    await rerender({ hovered: true });

    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);
    expect(strokesOf(rootOf(stage), 'table-remove')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);
  });

  it('paints the icons once konva reports the pointer over the table', async () => {
    const { stage, theme } = await setup();
    const box = await hoverable(stage);

    moveScenePointer(stage, box.x + box.width / 2, box.y + 4);
    await settle();

    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);
    expect(strokesOf(rootOf(stage), 'table-remove')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);
  });

  it('drops them again once that pointer moves off the table', async () => {
    const { stage } = await setup();
    const box = await hoverable(stage);

    moveScenePointer(stage, box.x + box.width / 2, box.y + 4);
    await settle();

    expect(strokesOf(rootOf(stage), 'table-add-column')).not.toContain(
      TRANSPARENT
    );

    moveScenePointer(stage, box.x + box.width + 60, box.y + box.height + 60);
    await settle();

    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);
    expect(strokesOf(rootOf(stage), 'table-remove')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);
  });

  it('names both header cells after the focus type they stand for', async () => {
    const { stage } = await setup();
    const root = rootOf(stage);

    expect(named<Group>(root, 'tableName').getAttr('kind')).toBe(
      'input-padding'
    );
    expect(root.findOne('.tableComment')).toBeTruthy();
  });

  it('drops the comment cell when its show bit is off', async () => {
    const { stage } = await setup({
      prepare: app => {
        app.store.dispatchSync(
          changeShowAction({ show: Show.tableComment, value: false })
        );
      },
    });
    const root = rootOf(stage);

    expect(root.findOne('.tableComment')).toBeUndefined();
    expect(root.findOne('.tableName')).toBeTruthy();
  });

  it('places the comment cell one name width and one gap along', async () => {
    const { stage, table } = await setup();
    const comment = named<Group>(rootOf(stage), 'tableComment');

    expect(comment.x()).toBe(table.ui.widthName + INPUT_MARGIN_RIGHT);
  });

  it.each([
    [-1, 120],
    [100, 100],
    [200, 120],
  ])(
    'clamps the comment cell width with maxWidthComment %i',
    async (maxWidthComment, expected) => {
      const { app, stage, table } = await setup({
        prepare: app => {
          app.store.dispatchSync(
            changeMaxWidthCommentAction({ value: maxWidthComment })
          );
        },
      });

      app.store.dispatchSync(
        changeTableCommentAction({ id: table.id, value: 'abcdefghijkl' })
      );
      await settle();

      const text = named<Text>(
        named<Group>(rootOf(stage), 'tableComment'),
        'cell-text'
      );

      expect(table.ui.widthComment).toBe(120);
      expect(text.width()).toBe(expected);
    }
  );
});

describe('a table kept off screen', () => {
  it('hides its whole group while visible is off, and shows it again', async () => {
    const { stage, rerender } = await setup({ props: { visible: false } });

    expect(rootOf(stage).visible()).toBe(false);

    await rerender({ visible: true });

    expect(rootOf(stage).visible()).toBe(true);
  });

  it('is visible with the prop left out', async () => {
    const { stage } = await setup();

    expect(rootOf(stage).visible()).toBe(true);
  });
});

describe('the header cell text', () => {
  it('falls back to the placeholder string and colour while empty', async () => {
    const { stage, theme } = await setup();
    const text = named<Text>(
      named<Group>(rootOf(stage), 'tableName'),
      'cell-text'
    );

    expect(text.text()).toBe('table');
    expect(text.fill()).toBe(theme.placeholder);
  });

  it('shows the value in the active colour once the table is named', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(
      changeTableNameAction({ id: table.id, value: 'users' })
    );
    await settle();

    const text = named<Text>(
      named<Group>(rootOf(stage), 'tableName'),
      'cell-text'
    );

    expect(text.text()).toBe('users');
    expect(text.fill()).toBe(theme.active);
  });

  it('underlines the focused cell in the focus colour', async () => {
    const { app, stage, table, theme } = await setup();

    expect(
      named<Group>(rootOf(stage), 'tableName').findOne('.cell-focus-border')
    ).toBeUndefined();

    app.store.dispatchSync(
      focusTableAction({ tableId: table.id, focusType: FocusType.tableName })
    );
    await settle();

    const border = named<Group>(rootOf(stage), 'tableName').findOne<Rect>(
      '.cell-focus-border'
    ) as Rect;

    expect(border.fill()).toBe(theme.focus);
  });

  it('keeps that underline under the editor, recoloured rather than redrawn', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(
      focusTableAction({ tableId: table.id, focusType: FocusType.tableName })
    );
    await settle();

    const cell = () =>
      named<Group>(rootOf(stage), 'tableName').findOne<Rect>(
        '.cell-focus-border'
      ) as Rect;
    const focused = { y: cell().y(), height: cell().height() };

    app.store.dispatchSync(editTableAction());
    await settle();

    // A dom underline over a canvas one rasterises to a different thickness,
    // so the editor paints none and this rect runs on in the editing colour.
    expect(cell().fill()).toBe(theme.inputActive);
    expect(cell().y()).toBe(focused.y);
    expect(cell().height()).toBe(focused.height);
  });

  it('underlines a cell a peer is focused on, in the peer colour', async () => {
    const { app, stage, table } = await setup();

    trackFocus(app, {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableComment,
    });
    await settle();

    const root = rootOf(stage);

    expect(
      named<Group>(root, 'tableComment').findOne('.cell-shared-focus-border')
    ).toBeTruthy();
    expect(
      named<Group>(root, 'tableName').findOne('.cell-shared-focus-border')
    ).toBeUndefined();
  });
});

describe('the column rows a table holds', () => {
  it('draws one row per column, in document order, at the metrics y', async () => {
    const { app, stage, table } = await setup({ columns: 3 });
    const root = rootOf(stage);
    const rows = root.find('.column-row');

    expect(rows.map(row => row.id())).toEqual(
      table.columnIds.map(id => `column-${id}`)
    );

    const rect = getTableRect(app.store.state, table);
    expect(rows.map(row => row.y())).toEqual(
      table.columnIds.map(
        (_, index) => getColumnRect(app.store.state, table, index).y - rect.y
      )
    );
  });

  it('insets the header by a border and a padding on both axes', async () => {
    const { stage } = await setup({ columns: 1 });
    const header = named<Group>(rootOf(stage), 'table-header');

    expect(header.x()).toBe(TABLE_INSET);
    expect(header.y()).toBe(TABLE_INSET);
  });

  it('appends a column dragged in from another table as a hidden row', async () => {
    const { app, stage, table, rerender } = await setup({ columns: 1 });
    const { store } = app;

    store.dispatchSync(addTableAction$());
    const otherId = store.state.doc.tableIds.find(
      id => id !== table.id
    ) as string;
    store.dispatchSync(addColumnAction$(otherId));
    const ghostId = store.state.collections.tableEntities[otherId].columnIds[0];
    await settle();

    await rerender({ ghostColumnId: ghostId });
    const root = rootOf(stage);
    const ghost = root.findOne(`#column-${ghostId}`) as Group;

    expect(root.find('.column-row')).toHaveLength(2);
    expect(ghost.visible()).toBe(false);
  });
});

describe('the header buttons a table owns', () => {
  it('emits openColorPicker with the pointer position and the current color', async () => {
    const { app, stage, table } = await setup();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });

    fireScenePointer(named(rootOf(stage), 'table-header-color'), 'click', {
      clientX: 120,
      clientY: 45,
    });

    expect(openColorPicker).toHaveBeenCalledWith({
      type: 'openColorPicker',
      payload: { x: 120, y: 45, color: table.ui.color },
    });
  });

  it('adds a column when the plus button is clicked', async () => {
    const { app, stage, table } = await setup();

    fireScenePointer(named(rootOf(stage), 'table-add-column'), 'click');
    await settle();

    expect(table.columnIds).toHaveLength(1);
  });

  it('removes the table when the xmark button is clicked', async () => {
    const { app, stage, table } = await setup();

    fireScenePointer(named(rootOf(stage), 'table-remove'), 'click');
    await settle();

    expect(app.store.state.doc.tableIds).not.toContain(table.id);
  });

  it('reveals the header icons once the pointer is over the table itself', async () => {
    const { stage, theme } = await setup();

    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);

    fireScenePointer(rootOf(stage), 'mouseenter');
    await settle();
    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);

    fireScenePointer(rootOf(stage), 'mouseleave');
    await settle();
    expect(strokesOf(rootOf(stage), 'table-add-column')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);
  });
});

describe('the move a table pointer start owns', () => {
  it('selects the table on mousedown and drags it with the pointer', async () => {
    const { app, stage, table } = await setup();
    const startX = table.ui.x;
    const startY = table.ui.y;

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      clientX: 100,
      clientY: 100,
    });
    movePointer(130, 150);
    await settle();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
    expect(table.ui.x).toBe(startX + 30);
    expect(table.ui.y).toBe(startY + 50);
  });

  it('drags from a touch start as well as a pointer one', async () => {
    const { table, stage } = await setup();
    const startX = table.ui.x;

    fireSceneTouch(named(rootOf(stage), 'table-body'), 'touchstart', 10, 10);
    const move = moveTouch(40, 10);
    await settle();

    expect(table.ui.x).toBe(startX + 30);
    expect(move.defaultPrevented).toBe(false);
  });

  it('adds to the selection instead of replacing it when the mod key is held', async () => {
    const { app, stage, table } = await setup();
    const { store } = app;

    store.dispatchSync(addTableAction$());
    const otherId = store.state.doc.tableIds.find(
      id => id !== table.id
    ) as string;
    store.dispatchSync(selectTableAction$(otherId, false));

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      ctrlKey: true,
      metaKey: true,
    });
    await settle();

    expect(store.state.editor.selectedMap[otherId]).toBe(SelectType.table);
    expect(store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('hands an Alt+drag to the duplicate ghost instead of moving the table', async () => {
    const { app, stage, table } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    const startX = table.ui.x;

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      altKey: true,
    });
    movePointer(130, 150);
    await settle();

    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect(table.ui.x).toBe(startX);
  });

  it('never starts a drag from the colour bar, an icon, a header cell or a row', async () => {
    const { app, stage, table } = await setup({ columns: 1 });
    const root = rootOf(stage);
    const startX = table.ui.x;

    for (const name of [
      'table-header-color',
      'table-add-column',
      'tableName',
      'column-row',
    ]) {
      fireScenePointer(named(root, name), 'mousedown', {
        clientX: 0,
        clientY: 0,
      });
      movePointer(80, 0);
      await settle();
      releasePointer();
    }

    expect(table.ui.x).toBe(startX);
    // the blocked areas still select, exactly as they did in the dom scene
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('focuses the cell a header mousedown lands on', async () => {
    const { app, stage, table } = await setup();

    fireScenePointer(named(rootOf(stage), 'tableComment'), 'mousedown');
    await settle();

    expect(app.store.state.editor.focusTable?.tableId).toBe(table.id);
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );
  });

  it('focuses the table name on mousedown and edits it on dblclick', async () => {
    const { app, stage, table } = await setup();
    const cell = named<Group>(rootOf(stage), 'tableName');

    fireScenePointer(cell, 'mousedown');
    await settle();
    expect(app.store.state.editor.focusTable?.edit).toBe(false);

    fireScenePointer(cell, 'dblclick', { detail: 2 });
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.tableId).toBe(table.id);
    expect(focusTable?.focusType).toBe(FocusType.tableName);
    expect(focusTable?.edit).toBe(true);
    // The scene hands the text over to the editor the overlay opens on it.
    expect((named<Group>(cell, 'cell-text') as any).visible()).toBe(false);
  });
});

// P4-41: the column drag the browser used to run through native dnd. The row
// reports its own gesture and the table judges the drop, because which row a
// drop lands on is a question about the whole sibling order.

type DragFixture = {
  app: AppContext;
  stage: Stage;
  tables: TableEntity[];
};

type DragOptions = { columns?: number; tables?: number };

async function setupDrag({
  columns = 3,
  tables: tableCount = 1,
}: DragOptions = {}): Promise<DragFixture> {
  const app = createTestAppContext();
  const { store } = app;
  const tables: TableEntity[] = [];

  for (let index = 0; index < tableCount; index++) {
    store.dispatchSync(addTableAction$());
    const tableId = store.state.doc.tableIds[index];

    for (let column = 0; column < columns; column++) {
      store.dispatchSync(addColumnAction$(tableId));
    }

    // Spread them apart: addTable staggers by 50px, which would leave the
    // second table under the first and the drop scan picking whichever is on top.
    store.dispatchSync(
      moveToTableAction({ id: tableId, x: 100 + index * 600, y: 100 })
    );
    tables.push(store.state.collections.tableEntities[tableId]);
  }

  store.dispatchSync(unselectAllAction(), focusTableEndAction());

  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        {tables.map(table => (
          <Table table={table} />
        ))}
      </k-layer>
    ),
    width: 1400,
    height: 900,
    theme: createTestTheme(),
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return { app, stage: rendered.stage, tables };
}

/** The viewport point over the centre of one row of one table. */
function rowPoint(fixture: DragFixture, table: TableEntity, index: number) {
  const rect = getColumnRect(fixture.app.store.state, table, index);
  const origin = fixture.stage.content.getBoundingClientRect();

  return {
    clientX: origin.x + rect.x + rect.width / 2,
    clientY: origin.y + rect.y + rect.height / 2,
  };
}

const rowNode = (fixture: DragFixture, columnId: string) =>
  fixture.stage.findOne<Group>(`#column-${columnId}`) as Group;

const focusColumn = (fixture: DragFixture, table: TableEntity, index: number) =>
  fixture.app.store.dispatchSync(
    focusColumnAction({
      tableId: table.id,
      columnId: table.columnIds[index],
      focusType: FocusType.columnName,
      $mod: false,
      shiftKey: false,
    })
  );

/** Presses a row and moves once, which is what a dragstart used to be. */
async function pressRow(
  fixture: DragFixture,
  table: TableEntity,
  index: number,
  init: MouseEventInit = {}
) {
  const point = rowPoint(fixture, table, index);
  const node = rowNode(fixture, table.columnIds[index]);

  fireScenePointer(node, 'mousedown', { button: 0, ...point, ...init });
  movePointer(point.clientX + 1, point.clientY + 1);
  await settle();
}

/** Moves the pointer onto one row and lets the dragover land. */
async function moveOver(
  fixture: DragFixture,
  table: TableEntity,
  index: number
) {
  const point = rowPoint(fixture, table, index);
  movePointer(point.clientX, point.clientY);
  await settle();
}

const columnIdsOf = (fixture: DragFixture, tableId: string) =>
  fixture.app.store.state.collections.tableEntities[tableId].columnIds;

describe('the column drag the table coordinates', () => {
  it('starts a column drag from a focused column row', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    focusColumn(fixture, table, 1);

    await pressRow(fixture, table, 1);

    const { editor } = fixture.app.store.state;
    expect(editor.draggableColumn).toEqual({
      tableId: table.id,
      columnIds: [table.columnIds[1]],
    });
    expect(editor.draggingColumnMap[table.columnIds[1]]).toBe(true);
  });

  it('drags every selected column when the modifier key is held', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const { store } = fixture.app;

    focusColumn(fixture, table, 0);
    store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[1],
        focusType: FocusType.columnName,
        $mod: true,
        shiftKey: false,
      })
    );

    await pressRow(fixture, table, 1, { metaKey: true, ctrlKey: true });

    expect(store.state.editor.draggableColumn?.columnIds).toEqual([
      table.columnIds[0],
      table.columnIds[1],
    ]);
  });

  it('ignores a dragstart while nothing is focused', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;

    await pressRow(fixture, table, 1);

    expect(fixture.app.store.state.editor.draggableColumn).toBeNull();
  });

  it('ignores a dragstart while only the table header is focused', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    fixture.app.store.dispatchSync(
      focusTableAction({ tableId: table.id, focusType: FocusType.tableName })
    );

    await pressRow(fixture, table, 1);

    expect(fixture.app.store.state.editor.draggableColumn).toBeNull();
  });

  it('ignores a press that is not the primary button', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    focusColumn(fixture, table, 1);

    await pressRow(fixture, table, 1, { button: 2 });

    expect(fixture.app.store.state.editor.draggableColumn).toBeNull();
  });

  it('reorders the columns when one is dragged over another', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const [first, second, third] = table.columnIds;
    focusColumn(fixture, table, 2);

    await pressRow(fixture, table, 2);
    await moveOver(fixture, table, 0);

    expect(columnIdsOf(fixture, table.id)).toEqual([third, first, second]);
  });

  it('ignores a dragover on one of the dragged columns', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const before = [...table.columnIds];
    focusColumn(fixture, table, 1);

    await pressRow(fixture, table, 1);
    await moveOver(fixture, table, 1);

    expect(columnIdsOf(fixture, table.id)).toEqual(before);
  });

  it('ignores a dragover once the drag state has been cleared', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const before = [...table.columnIds];
    focusColumn(fixture, table, 2);

    await pressRow(fixture, table, 2);
    fixture.app.store.dispatchSync(dragendColumnAction());
    await moveOver(fixture, table, 0);

    expect(columnIdsOf(fixture, table.id)).toEqual(before);
  });

  it('leaves the order alone while no column drag is in flight', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const before = [...table.columnIds];

    await moveOver(fixture, table, 0);
    await moveOver(fixture, table, 2);

    expect(columnIdsOf(fixture, table.id)).toEqual(before);
    expect(fixture.app.store.state.editor.draggableColumn).toBeNull();
  });

  it('moves a column into another table without a handshake between them', async () => {
    const fixture = await setupDrag({ tables: 2, columns: 2 });
    const [source, target] = fixture.tables;
    const moved = source.columnIds[0];
    focusColumn(fixture, source, 0);

    await pressRow(fixture, source, 0);
    await moveOver(fixture, target, 1);

    expect(columnIdsOf(fixture, source.id)).not.toContain(moved);
    expect(columnIdsOf(fixture, target.id)).toHaveLength(3);
    // The drag carries on in the table it landed in, under its new id.
    expect(fixture.app.store.state.editor.draggableColumn?.tableId).toBe(
      target.id
    );
  });

  it('keeps a ghost row for a column dragged into another table', async () => {
    const fixture = await setupDrag({ tables: 2, columns: 2 });
    const [source, target] = fixture.tables;
    const moved = source.columnIds[0];
    focusColumn(fixture, source, 0);

    await pressRow(fixture, source, 0);
    await moveOver(fixture, target, 1);

    const ghost = fixture.stage.findOne<Group>(`#column-${moved}`) as Group;
    expect(ghost).toBeTruthy();
    expect(ghost.visible()).toBe(false);
  });

  it('clears the drag state and notifies every table on dragend', async () => {
    const fixture = await setupDrag();
    const [table] = fixture.tables;
    const notified = vi.fn();
    const off = fixture.app.emitter.on({ dragendColumnAll: notified });
    focusColumn(fixture, table, 1);

    await pressRow(fixture, table, 1);
    releasePointer();
    await settle();

    const { editor } = fixture.app.store.state;
    expect(editor.draggableColumn).toBeNull();
    expect(editor.draggingColumnMap).toEqual({});
    expect(notified).toHaveBeenCalledTimes(1);
    off();
  });

  it('drops the ghost row once the drag is over', async () => {
    const fixture = await setupDrag({ tables: 2, columns: 2 });
    const [source, target] = fixture.tables;
    const moved = source.columnIds[0];
    focusColumn(fixture, source, 0);

    await pressRow(fixture, source, 0);
    await moveOver(fixture, target, 1);
    releasePointer();
    await settle();

    expect(fixture.stage.findOne(`#column-${moved}`)).toBeUndefined();
  });
});
