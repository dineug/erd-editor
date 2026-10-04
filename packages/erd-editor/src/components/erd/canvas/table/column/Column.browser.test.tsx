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
  flush,
  movePointer,
  moveScenePointer,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  getSceneFontMetrics,
  SCENE_CODE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  TABLE_INSET,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import { getColumnCellSlots } from '@/components/erd/canvas/table/cellLayout';
import Column from '@/components/erd/canvas/table/column/Column';
import {
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  INPUT_MARGIN_RIGHT,
} from '@/constants/layout';
import {
  ColumnOption,
  ColumnType,
  ColumnUIKey,
  Show,
} from '@/constants/schema';
import {
  dragstartColumnAction,
  focusColumnAction,
  hoverColumnMapAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeColumnOrderAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import type { Column as ColumnEntity } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { bHas } from '@/utils/bit';
import type { ColumnWidth } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

type SceneProps = {
  source?: GeometrySource;
  widthAlternateKey?: number;
  alternateKey?: string;
  selected?: boolean;
  hovered?: boolean;
  ghost?: boolean;
  focusName?: boolean;
  editName?: boolean;
  sharedFocusName?: string | null;
  sharedFocusDataType?: string | null;
  editorFocused?: boolean;
  preview?: boolean;
  onDragstart?: (columnId: string, event: SceneMouseEvent) => void;
  onDragend?: () => void;
};

type SetupOptions = {
  props?: SceneProps;
  prepare?: (app: AppContext) => void;
};

type Fixture = {
  app: AppContext;
  column: ColumnEntity;
  widths: ColumnWidth;
  width: number;
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

async function setup({ props = {}, prepare }: SetupOptions = {}) {
  const app = createTestAppContext();
  const { store } = app;

  prepare?.(app);
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  const table = store.state.collections.tableEntities[tableId];
  store.dispatchSync(addColumnAction$(tableId));
  const column =
    store.state.collections.tableColumnEntities[table.columnIds[0]];

  const container = document.createElement('div');
  document.body.append(container);
  const theme = createTestTheme();
  const widths = getTableWidths(store.state, table);
  const rect = getTableRect(store.state, table);

  const scene = (next: SceneProps): DOMTemplateLiterals => (
    <k-layer name="scene">
      <Column
        column={column}
        source={next.source ?? 'document'}
        y={0}
        width={rect.width}
        selected={next.selected ?? false}
        hovered={next.hovered}
        ghost={next.ghost}
        widthName={widths.name}
        widthDataType={widths.dataType}
        widthDefault={widths.default}
        widthComment={widths.comment}
        widthAlternateKey={next.widthAlternateKey}
        alternateKey={next.alternateKey}
        focusName={next.focusName ?? false}
        focusDataType={false}
        focusNotNull={false}
        focusDefault={false}
        focusComment={false}
        focusUnique={false}
        focusAutoIncrement={false}
        sharedFocusName={next.sharedFocusName ?? null}
        sharedFocusDataType={next.sharedFocusDataType ?? null}
        sharedFocusNotNull={null}
        sharedFocusDefault={null}
        sharedFocusComment={null}
        sharedFocusUnique={null}
        sharedFocusAutoIncrement={null}
        editorFocused={next.editorFocused}
        editName={next.editName ?? false}
        editDataType={false}
        editDefault={false}
        editComment={false}
        preview={next.preview}
        onDragstart={next.onDragstart}
        onDragend={next.onDragend}
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

  const fixture: Fixture = {
    app,
    column,
    widths,
    width: rect.width,
    theme,
    stage: rendered.stage,
    rerender: async (next: SceneProps) => {
      renderKonva(rendered.stage, scene(next));
      await flush();
      await whenDrawn();
    },
  };

  return fixture;
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const rowOf = (stage: Stage) => stage.findOne<Group>('.column-row') as Group;

const named = <T extends KonvaNode>(root: Group, name: string) =>
  root.findOne<T>(`.${name}`) as T;

const textOf = (root: Group, cell: string) =>
  named<Text>(named<Group>(root, cell), 'cell-text');

/**
 * The row's box, once konva has painted the hit graph a pointer is tested
 * against. Returned in the stage content's own coordinates, which is what
 * moveScenePointer takes.
 */
const hoverable = async (stage: Stage) => {
  await whenPainted();
  return rowOf(stage).getClientRect({ relativeTo: stage });
};

const strokesOf = (root: Group, name: string) =>
  named<Group>(root, name)
    .find('Path')
    .map(node => node.getAttr('stroke'));

describe('the column row carries the scene conventions', () => {
  it('takes the id, the name and the kind an ancestor walk reads', async () => {
    const { stage, column } = await setup();
    const row = rowOf(stage);

    expect(row.id()).toBe(`column-${column.id}`);
    expect(row.name()).toBe('column-row');
    expect(row.getAttr('kind')).toBe('column-row');
  });

  it('spans the table box inside its border and one row tall', async () => {
    const { stage } = await setup();
    const background = named<Rect>(rowOf(stage), 'column-row-background');

    expect(background.height()).toBe(COLUMN_HEIGHT);
    expect(background.fill()).toBe(TRANSPARENT);
  });
});

describe('what the row background says about state', () => {
  it('takes the hover colour while the pointer is over it', async () => {
    const { stage, theme, rerender } = await setup();

    await rerender({ hovered: true });

    expect(named<Rect>(rowOf(stage), 'column-row-background').fill()).toBe(
      theme.columnHover
    );
  });

  it('takes the hover colour for a column the editor is hovering', async () => {
    const { app, stage, column, theme } = await setup();

    app.store.dispatchSync(hoverColumnMapAction({ columnIds: [column.id] }));
    await settle();

    expect(named<Rect>(rowOf(stage), 'column-row-background').fill()).toBe(
      theme.columnHover
    );
  });

  it('lifts a selected row a step under the pointer rather than dropping to the hover', async () => {
    const { stage, theme, rerender } = await setup();

    await rerender({ hovered: true, selected: true });

    expect(named<Rect>(rowOf(stage), 'column-row-background').fill()).toBe(
      theme.columnSelectHover
    );
  });

  it('halves the row while the column is being dragged', async () => {
    const { app, stage, column } = await setup();

    expect(rowOf(stage).opacity()).toBe(1);

    app.store.dispatchSync(
      dragstartColumnAction({
        tableId: column.tableId,
        columnIds: [column.id],
      })
    );
    await settle();

    expect(rowOf(stage).opacity()).toBe(0.5);
  });

  it('hides the row asked to stand in as a ghost', async () => {
    const { stage, rerender } = await setup();

    expect(rowOf(stage).visible()).toBe(true);

    await rerender({ ghost: true });

    expect(rowOf(stage).visible()).toBe(false);
  });
});

describe('the cells a row lays out', () => {
  it('follows the column order and drops what the show bits hide', async () => {
    const { stage } = await setup();

    expect(
      rowOf(stage)
        .find('.column-col')
        .map(node => node.name())
    ).toEqual([
      'column-col column-key',
      'column-col columnName',
      'column-col columnDataType',
      'column-col columnNotNull',
      'column-col columnDefault',
      'column-col columnComment',
    ]);
  });

  it('shows the two option cells once their show bits are on', async () => {
    const { stage } = await setup({
      prepare: app => {
        app.store.dispatchSync(
          changeShowAction({ show: Show.columnUnique, value: true })
        );
        app.store.dispatchSync(
          changeShowAction({ show: Show.columnAutoIncrement, value: true })
        );
      },
    });

    expect(
      rowOf(stage)
        .find('.column-col')
        .map(node => node.name())
    ).toEqual([
      'column-col column-key',
      'column-col columnName',
      'column-col columnDataType',
      'column-col columnNotNull',
      'column-col columnUnique',
      'column-col columnAutoIncrement',
      'column-col columnDefault',
      'column-col columnComment',
    ]);
  });

  it('walks the cells across by their own width and one gap', async () => {
    const { stage, widths } = await setup();
    const row = rowOf(stage);
    const start = TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT;
    const step = (width: number) => width + INPUT_MARGIN_RIGHT;

    expect(named<Group>(row, 'columnName').x()).toBe(start);
    expect(named<Group>(row, 'columnDataType').x()).toBe(
      start + step(widths.name)
    );
    expect(named<Group>(row, 'columnNotNull').x()).toBe(
      start + step(widths.name) + step(widths.dataType)
    );
    expect(named<Group>(row, 'columnDefault').x()).toBe(
      start +
        step(widths.name) +
        step(widths.dataType) +
        step(COLUMN_NOT_NULL_WIDTH)
    );
  });

  it('keeps the delete icon at the right edge of the row content', async () => {
    const { stage, width } = await setup();
    const icon = named<Group>(rowOf(stage), 'column-remove');

    expect(icon.x()).toBe(width - TABLE_INSET - COLUMN_DELETE_WIDTH);
    expect(icon.getAttr('kind')).toBe('icon');
  });

  it('hides the delete icon until the row is hovered', async () => {
    const { stage, theme, rerender } = await setup();

    expect(strokesOf(rowOf(stage), 'column-remove')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);

    await rerender({ hovered: true });

    expect(strokesOf(rowOf(stage), 'column-remove')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);
  });

  it('paints it once konva reports the pointer over the row', async () => {
    const { stage, theme } = await setup();
    const box = await hoverable(stage);

    moveScenePointer(stage, box.x + 8, box.y + box.height / 2);
    await settle();

    expect(strokesOf(rowOf(stage), 'column-remove')).toEqual([
      theme.foreground,
      theme.foreground,
    ]);

    moveScenePointer(stage, box.x + box.width + 60, box.y + box.height + 60);
    await settle();

    expect(strokesOf(rowOf(stage), 'column-remove')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);
  });
});

describe('what a cell draws', () => {
  it('falls back to the placeholder string and colour while empty', async () => {
    const { stage, theme } = await setup();
    const text = textOf(rowOf(stage), 'columnName');

    expect(text.text()).toBe('column');
    expect(text.fill()).toBe(theme.placeholder);
  });

  it('underlines the focused cell and hides the text while it is edited', async () => {
    const { stage, theme, rerender } = await setup();

    await rerender({ focusName: true });
    const focused = named<Group>(rowOf(stage), 'columnName');

    expect((focused.findOne('.cell-focus-border') as Rect).fill()).toBe(
      theme.focus
    );

    const border = focused.findOne('.cell-focus-border') as Rect;

    await rerender({ focusName: true, editName: true });
    const edited = named<Group>(rowOf(stage), 'columnName');
    const editedBorder = edited.findOne('.cell-focus-border') as Rect;

    // The same rect keeps running under the editor, only recoloured: a dom
    // underline over a canvas one rasterises to a different thickness.
    expect(editedBorder.fill()).toBe(theme.inputActive);
    expect(editedBorder.y()).toBe(border.y());
    expect(editedBorder.height()).toBe(border.height());
    expect((edited.findOne('.cell-text') as Text).visible()).toBe(false);
  });

  it('greys the focus underline while the editor itself is unfocused', async () => {
    const { stage, theme, rerender } = await setup();

    await rerender({ focusName: true, editorFocused: false });
    const cell = named<Group>(rowOf(stage), 'columnName');

    expect((cell.findOne('.cell-focus-border') as Rect).fill()).toBe(
      theme.placeholder
    );
  });

  it('underlines a cell a peer is focused on, in the peer colour', async () => {
    const { stage, rerender } = await setup();

    await rerender({ sharedFocusName: '#abcdef' });
    const border = named<Group>(rowOf(stage), 'columnName').findOne<Rect>(
      '.cell-shared-focus-border'
    ) as Rect;

    expect(border.fill()).toBe('#abcdef');
  });

  it('marks no cell while every shared focus prop is false', async () => {
    const { stage } = await setup();

    expect(rowOf(stage).find('.cell-shared-focus-border')).toEqual([]);
  });

  it('keeps a local focus and a remote focus on their own cells', async () => {
    const { stage, rerender } = await setup();

    await rerender({ focusName: true, sharedFocusDataType: '#abcdef' });
    const name = named<Group>(rowOf(stage), 'columnName');
    const dataType = named<Group>(rowOf(stage), 'columnDataType');

    expect(name.findOne('.cell-focus-border')).toBeTruthy();
    expect(name.findOne('.cell-shared-focus-border')).toBeUndefined();
    expect(dataType.findOne('.cell-focus-border')).toBeUndefined();
    expect((dataType.findOne('.cell-shared-focus-border') as Rect).fill()).toBe(
      '#abcdef'
    );
  });

  it('spells the not null cell out of the column options', async () => {
    const { app, stage, column } = await setup();

    expect(textOf(rowOf(stage), 'columnNotNull').text()).toBe('NULL');

    app.store.dispatchSync(
      toggleColumnValueAction$(
        FocusType.columnNotNull,
        column.tableId,
        column.id
      )
    );
    await settle();

    expect(textOf(rowOf(stage), 'columnNotNull').text()).toBe('N-N');
  });

  it('greys an unchecked option cell and lights a checked one', async () => {
    const { app, stage, column, theme } = await setup({
      prepare: app => {
        app.store.dispatchSync(
          changeShowAction({ show: Show.columnUnique, value: true })
        );
      },
    });

    expect(textOf(rowOf(stage), 'columnUnique').text()).toBe('UQ');
    expect(textOf(rowOf(stage), 'columnUnique').fill()).toBe(theme.placeholder);

    app.store.dispatchSync(
      toggleColumnValueAction$(
        FocusType.columnUnique,
        column.tableId,
        column.id
      )
    );
    await settle();

    expect(textOf(rowOf(stage), 'columnUnique').fill()).toBe(theme.active);
  });
});

describe('the key cell', () => {
  it('paints nothing while a column is neither key', async () => {
    const { stage } = await setup();

    expect(strokesOf(rowOf(stage), 'column-key')).toEqual([TRANSPARENT]);
  });

  it('takes one colour per combination of the key bits', async () => {
    const { app, stage, column, theme } = await setup();
    const ui = app.store.state.collections.tableColumnEntities[column.id].ui;

    ui.keys = ColumnUIKey.primaryKey;
    await settle();
    expect(strokesOf(rowOf(stage), 'column-key')).toEqual([theme.keyPK]);

    ui.keys = ColumnUIKey.foreignKey;
    await settle();
    expect(strokesOf(rowOf(stage), 'column-key')).toEqual([theme.keyFK]);

    ui.keys = ColumnUIKey.primaryKey | ColumnUIKey.foreignKey;
    await settle();
    expect(strokesOf(rowOf(stage), 'column-key')).toEqual([theme.keyPFK]);
  });
});

describe('the alternate key mark', () => {
  const markOf = (stage: Stage) =>
    rowOf(stage).findOne<Text>('.column-alternate-key');

  /** The right edge of every cell the row draws, in the order it lays them out. */
  const cellEnds = ({ app, widths }: Fixture) =>
    getColumnCellSlots(app.store.state, widths).map(
      slot => slot.x + slot.width
    );

  it('draws none while the table keeps no room for one', async () => {
    const { stage } = await setup({ props: { alternateKey: 'AK1.1' } });

    expect(markOf(stage)).toBeUndefined();
  });

  it('stands one margin past the last cell in the code face, the cells where they were', async () => {
    const fixture = await setup({
      props: { widthAlternateKey: 34, alternateKey: 'AK1.2' },
    });
    const { stage, theme } = fixture;
    const mark = markOf(stage) as Text;
    const row = rowOf(stage);

    expect(mark.text()).toBe('AK1.2');
    expect(mark.x()).toBe(Math.max(...cellEnds(fixture)) + INPUT_MARGIN_RIGHT);
    expect(mark.width()).toBe(34);
    expect(mark.fontFamily()).toBe(SCENE_CODE_FONT_FAMILY);
    expect(mark.fontSize()).toBe(SCENE_FONT_SIZE);
    expect(mark.fill()).toBe(theme.foreground);
    expect(mark.listening()).toBe(false);
    expect(row.getChildren().indexOf(mark)).toBeGreaterThan(
      row.getChildren().indexOf(named<Group>(row, 'columnComment'))
    );
    expect(named<Group>(row, 'columnName').x()).toBe(
      TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT
    );
  });

  /** The baseline konva draws a middle aligned line on, down from the row. */
  const baselineOf = (row: Group, text: Text) => {
    const { ascent, descent } = getSceneFontMetrics(text.fontFamily());

    return (
      text.getAbsolutePosition(row).y +
      text.height() / 2 +
      (ascent - descent) / 2
    );
  };

  it('sits on the baseline of the cell text before it, in its own face', async () => {
    const { stage } = await setup({
      props: { widthAlternateKey: 34, alternateKey: 'AK1.2' },
    });
    const row = rowOf(stage);
    const mark = markOf(stage) as Text;
    const comment = named<Text>(
      named<Group>(row, 'columnComment'),
      'cell-text'
    );

    expect(comment.fontFamily()).not.toBe(mark.fontFamily());
    expect(baselineOf(row, mark)).toBe(baselineOf(row, comment));
    expect(Number.isInteger(baselineOf(row, mark))).toBe(true);
  });

  it('stays last when the settings order the comment first', async () => {
    const fixture = await setup({
      props: { widthAlternateKey: 34, alternateKey: 'AK1.1' },
      prepare: ({ store }) => {
        store.dispatchSync(
          changeColumnOrderAction({
            value: ColumnType.columnComment,
            target: ColumnType.columnName,
          })
        );
      },
    });
    const row = rowOf(fixture.stage);
    const mark = markOf(fixture.stage) as Text;

    expect(fixture.app.store.state.settings.columnOrder[0]).toBe(
      ColumnType.columnComment
    );
    expect(named<Group>(row, 'columnComment').x()).toBe(
      TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT
    );
    expect(mark.x()).toBe(Math.max(...cellEnds(fixture)) + INPUT_MARGIN_RIGHT);
  });

  it('keeps the room empty in a row that is in no key', async () => {
    const { stage } = await setup({ props: { widthAlternateKey: 34 } });

    expect((markOf(stage) as Text).text()).toBe('');
  });

  it('is never drawn by a view', async () => {
    const { stage } = await setup({
      props: { source: 'flow', widthAlternateKey: 34, alternateKey: 'AK1.1' },
    });

    expect(markOf(stage)).toBeUndefined();
  });
});

describe('what the key cell hovers', () => {
  it('does not hover anything while the column has no key', async () => {
    const { app, stage } = await setup();

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mouseenter');
    await settle();

    expect(app.store.state.editor.hoverColumnMap).toEqual({});
  });

  it('hovers the column once it owns a key', async () => {
    const { app, stage, column } = await setup();
    app.store.state.collections.tableColumnEntities[column.id].ui.keys =
      ColumnUIKey.primaryKey;
    await settle();

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mouseenter');
    await settle();

    expect(Object.keys(app.store.state.editor.hoverColumnMap)).toEqual([
      column.id,
    ]);
  });

  it('clears the hover map on mouseleave', async () => {
    const { app, stage, column } = await setup();
    app.store.state.collections.tableColumnEntities[column.id].ui.keys =
      ColumnUIKey.primaryKey;
    await settle();

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mouseenter');
    await settle();
    fireScenePointer(named(rowOf(stage), 'column-key'), 'mouseleave');
    await settle();

    expect(app.store.state.editor.hoverColumnMap).toEqual({});
  });

  it('paints the row while the pointer is over the row itself', async () => {
    const { stage, theme } = await setup();
    const background = named<Rect>(rowOf(stage), 'column-row-background');

    fireScenePointer(rowOf(stage), 'mouseenter');
    await settle();
    expect(background.fill()).toBe(theme.columnHover);

    fireScenePointer(rowOf(stage), 'mouseleave');
    await settle();
    expect(background.fill()).toBe(TRANSPARENT);
  });
});

describe('what a column pointer start owns', () => {
  it('removes the column from its table when clicked', async () => {
    const { app, stage, column } = await setup();

    fireScenePointer(named(rowOf(stage), 'column-remove'), 'click');
    await settle();

    const table = app.store.state.collections.tableEntities[column.tableId];
    expect(table.columnIds).not.toContain(column.id);
  });

  it('keeps the column through a right click on its remove button', async () => {
    const { app, stage, column } = await setup();

    fireScenePointer(named(rowOf(stage), 'column-remove'), 'click', {
      button: 2,
    });
    await settle();

    const table = app.store.state.collections.tableEntities[column.tableId];
    expect(table.columnIds).toContain(column.id);
  });

  it('focuses the cell a mousedown lands on', async () => {
    const { app, stage, column } = await setup();

    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown');
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.columnId).toBe(column.id);
    expect(focusTable?.focusType).toBe(FocusType.columnName);
  });

  it('appends to the column selection when the mod key is held', async () => {
    const { app, stage, column } = await setup();
    const { store } = app;

    store.dispatchSync(addColumnAction$(column.tableId));
    const secondId = store.state.collections.tableEntities[
      column.tableId
    ].columnIds.find(id => id !== column.id) as string;
    store.dispatchSync(
      focusColumnAction({
        tableId: column.tableId,
        columnId: secondId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown', {
      ctrlKey: true,
      metaKey: true,
    });
    await settle();

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      secondId,
      column.id,
    ]);
  });

  it('selects the range when the shift key is held', async () => {
    const { app, stage, column } = await setup();
    const { store } = app;

    store.dispatchSync(addColumnAction$(column.tableId));
    const secondId = store.state.collections.tableEntities[
      column.tableId
    ].columnIds.find(id => id !== column.id) as string;
    store.dispatchSync(
      focusColumnAction({
        tableId: column.tableId,
        columnId: secondId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown', {
      shiftKey: true,
    });
    await settle();

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      column.id,
      secondId,
    ]);
  });
});

describe('what a right press on a row focuses', () => {
  const RIGHT = { button: 2 };

  /**
   * A second column in the same table, focused, with the drawn row's column
   * selected beside it or not: the state a context menu is opened over.
   */
  async function setupSelection(selectDrawn: boolean, props: SceneProps = {}) {
    const fixture = await setup({ props });
    const { store } = fixture.app;
    const { column } = fixture;

    store.dispatchSync(addColumnAction$(column.tableId));
    const secondId = store.state.collections.tableEntities[
      column.tableId
    ].columnIds.find(id => id !== column.id) as string;
    const focus = (columnId: string, $mod: boolean) =>
      store.dispatchSync(
        focusColumnAction({
          tableId: column.tableId,
          columnId,
          focusType: FocusType.columnDataType,
          $mod,
          shiftKey: false,
        })
      );

    if (selectDrawn) focus(column.id, false);
    focus(secondId, selectDrawn);
    await settle();

    return { ...fixture, secondId };
  }

  it('keeps a selection the row is in, and moves the focus onto its cell', async () => {
    const { app, stage, column, secondId } = await setupSelection(true);

    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown', RIGHT);
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.columnId).toBe(column.id);
    expect(focusTable?.focusType).toBe(FocusType.columnName);
    expect(focusTable?.selectColumnIds).toEqual([column.id, secondId]);
  });

  it('selects a row outside the selection alone, whatever key is held', async () => {
    const { app, stage, column } = await setupSelection(false);

    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown', {
      ...RIGHT,
      ctrlKey: true,
      metaKey: true,
      shiftKey: true,
    });
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.columnId).toBe(column.id);
    expect(focusTable?.selectColumnIds).toEqual([column.id]);
  });

  it('focuses the row from its key, leaving no focus on the column before', async () => {
    const { app, stage, column } = await setupSelection(false);

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mousedown', RIGHT);
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.columnId).toBe(column.id);
    expect(focusTable?.focusType).toBe(FocusType.columnName);
    expect(focusTable?.selectColumnIds).toEqual([column.id]);
  });

  it('focuses the row from between two cells or its key mark, keeping the selection', async () => {
    const { app, stage, column, secondId } = await setupSelection(true, {
      widthAlternateKey: 34,
      alternateKey: 'AK1.1',
    });

    fireScenePointer(
      named(rowOf(stage), 'column-row-background'),
      'mousedown',
      RIGHT
    );
    await settle();

    expect(app.store.state.editor.focusTable).toMatchObject({
      columnId: column.id,
      focusType: FocusType.columnName,
      selectColumnIds: [column.id, secondId],
    });

    // Focused already, the row keeps the cell it was focused on.
    app.store.state.editor.focusTable!.focusType = FocusType.columnDataType;
    fireScenePointer(
      named(rowOf(stage), 'column-alternate-key'),
      'mousedown',
      RIGHT
    );
    await settle();

    expect(app.store.state.editor.focusTable).toMatchObject({
      columnId: column.id,
      focusType: FocusType.columnDataType,
      selectColumnIds: [column.id, secondId],
    });
  });

  it('leaves the focus where it was on a left press outside the cells', async () => {
    const { app, stage, secondId } = await setupSelection(false);

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mousedown', {
      button: 0,
    });
    releasePointer();
    await settle();

    expect(app.store.state.editor.focusTable?.columnId).toBe(secondId);
  });

  it('treats a Ctrl press outside the cells as a left press, as a macOS Ctrl+click is', async () => {
    const { app, stage, secondId } = await setupSelection(false);

    for (const name of ['column-key', 'column-row-background']) {
      fireScenePointer(named(rowOf(stage), name), 'mousedown', {
        button: 0,
        ctrlKey: true,
      });
      releasePointer();
      await settle();

      expect(app.store.state.editor.focusTable).toMatchObject({
        columnId: secondId,
        selectColumnIds: [secondId],
      });
    }
  });

  it('keeps the cell a right press focused, which the row then leaves alone', async () => {
    const { app, stage, column } = await setupSelection(false);

    fireScenePointer(named(rowOf(stage), 'columnDataType'), 'mousedown', RIGHT);
    await settle();

    expect(app.store.state.editor.focusTable).toMatchObject({
      columnId: column.id,
      focusType: FocusType.columnDataType,
      selectColumnIds: [column.id],
    });
  });

  it('focuses nothing in a view', async () => {
    const { app, stage, secondId } = await setupSelection(false, {
      source: 'flow',
    });

    fireScenePointer(named(rowOf(stage), 'column-key'), 'mousedown', RIGHT);
    fireScenePointer(named(rowOf(stage), 'columnName'), 'mousedown', RIGHT);
    await settle();

    expect(app.store.state.editor.focusTable?.columnId).toBe(secondId);
  });
});

// P4-41 and P4-40: the row owns the gesture on itself and the cells own their
// own edit entry, so both are asserted through the store and through the one
// callback pair the scene keeps.

describe('the row reports its own drag to the table that owns the order', () => {
  it('hands the start and the end to the table once the pointer moves', async () => {
    const onDragstart = vi.fn();
    const onDragend = vi.fn();
    const { stage, column } = await setup({
      props: { onDragstart, onDragend },
    });

    fireScenePointer(rowOf(stage), 'mousedown', { button: 0 });
    expect(onDragstart).not.toHaveBeenCalled();

    movePointer(24, 0);
    await settle();
    expect(onDragstart).toHaveBeenCalledTimes(1);
    expect(onDragstart.mock.calls[0][0]).toBe(column.id);

    // A second move is the same drag, not a second start.
    movePointer(48, 0);
    await settle();
    expect(onDragstart).toHaveBeenCalledTimes(1);

    releasePointer();
    await settle();
    expect(onDragend).toHaveBeenCalledTimes(1);
  });

  it('never starts a drag from a press that does not move', async () => {
    const onDragstart = vi.fn();
    const onDragend = vi.fn();
    const { stage } = await setup({ props: { onDragstart, onDragend } });

    fireScenePointer(rowOf(stage), 'mousedown', { button: 0 });
    releasePointer();
    await settle();

    expect(onDragstart).not.toHaveBeenCalled();
    expect(onDragend).not.toHaveBeenCalled();
  });

  it('never starts a drag from a row with no id, or from another button', async () => {
    const onDragstart = vi.fn();
    const { stage, rerender } = await setup({ props: { onDragstart } });

    fireScenePointer(rowOf(stage), 'mousedown', { button: 2 });
    movePointer(24, 0);
    await settle();
    releasePointer();

    await rerender({ preview: true, onDragstart });
    expect(rowOf(stage).id()).toBe('');

    fireScenePointer(rowOf(stage), 'mousedown', { button: 0 });
    movePointer(24, 0);
    await settle();
    releasePointer();

    expect(onDragstart).not.toHaveBeenCalled();
  });
});

describe('the cell a double click opens', () => {
  it.each([
    ['columnName', FocusType.columnName],
    ['columnDataType', FocusType.columnDataType],
    ['columnDefault', FocusType.columnDefault],
    ['columnComment', FocusType.columnComment],
  ])('starts editing the %s cell on double click', async (name, focusType) => {
    const { app, stage, column } = await setup({
      prepare: ({ store }) => {
        store.dispatchSync(
          changeShowAction({ show: Show.columnDefault, value: true }),
          changeShowAction({ show: Show.columnComment, value: true })
        );
      },
    });

    const cell = named<Group>(rowOf(stage), name);
    fireScenePointer(cell, 'mousedown');
    fireScenePointer(cell, 'dblclick', { detail: 2 });
    await settle();

    const { focusTable } = app.store.state.editor;
    expect(focusTable?.columnId).toBe(column.id);
    expect(focusTable?.focusType).toBe(focusType);
    expect(focusTable?.edit).toBe(true);
  });

  it.each([
    ['columnNotNull', ColumnOption.notNull],
    ['columnUnique', ColumnOption.unique],
    ['columnAutoIncrement', ColumnOption.autoIncrement],
  ])('toggles %s on double click instead of editing it', async (name, bit) => {
    const { app, stage, column } = await setup({
      prepare: ({ store }) => {
        store.dispatchSync(
          changeShowAction({ show: Show.columnUnique, value: true }),
          changeShowAction({ show: Show.columnAutoIncrement, value: true })
        );
      },
    });

    const cell = named<Group>(rowOf(stage), name);
    fireScenePointer(cell, 'mousedown');
    fireScenePointer(cell, 'dblclick', { detail: 2 });
    await settle();

    const stored = app.store.state.collections.tableColumnEntities[column.id];
    expect(bHas(stored.options, bit)).toBe(true);
    expect(app.store.state.editor.focusTable?.edit).toBe(false);
  });
});
