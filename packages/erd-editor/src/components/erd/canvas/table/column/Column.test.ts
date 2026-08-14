import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Column from '@/components/erd/canvas/table/column/Column';
import * as styles from '@/components/erd/canvas/table/column/Column.styles';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import { ColumnOption, Show } from '@/constants/schema';
import {
  dragstartColumnAction,
  focusColumnAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Column as ColumnEntity } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { simpleShortcutToString } from '@/utils/keyboard-shortcut';

type TemplateOptions = {
  selected?: boolean;
  focusName?: boolean;
  focusDataType?: boolean;
  focusNotNull?: boolean;
  focusDefault?: boolean;
  focusComment?: boolean;
  focusUnique?: boolean;
  focusAutoIncrement?: boolean;
  editName?: boolean;
  editDataType?: boolean;
  editDefault?: boolean;
  editComment?: boolean;
  draggable?: boolean;
  ghost?: boolean;
  onDragstart?: (event: DragEvent) => void;
  onDragend?: (event: DragEvent) => void;
};

const TABLE_ID = 't1';
const COLUMN_ID = 'c1';

function columnTemplate(column: ColumnEntity, options: TemplateOptions = {}) {
  const {
    selected = false,
    focusName = false,
    focusDataType = false,
    focusNotNull = false,
    focusDefault = false,
    focusComment = false,
    focusUnique = false,
    focusAutoIncrement = false,
    editName = false,
    editDataType = false,
    editDefault = false,
    editComment = false,
    draggable = true,
    ghost = false,
    onDragstart,
    onDragend,
  } = options;

  return html`
    <${Column}
      column=${column}
      selected=${selected}
      widthName=${60}
      widthDataType=${70}
      widthDefault=${80}
      widthComment=${90}
      focusName=${focusName}
      focusDataType=${focusDataType}
      focusNotNull=${focusNotNull}
      focusDefault=${focusDefault}
      focusComment=${focusComment}
      focusUnique=${focusUnique}
      focusAutoIncrement=${focusAutoIncrement}
      editName=${editName}
      editDataType=${editDataType}
      editDefault=${editDefault}
      editComment=${editComment}
      draggable=${draggable}
      ghost=${ghost}
      .onDragstart=${onDragstart}
      .onDragend=${onDragend}
    />
  `;
}

function seedColumn(app: AppContext, id = COLUMN_ID): ColumnEntity {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } })
  );
  store.dispatchSync(addColumnAction({ id, tableId: TABLE_ID }));
  return store.state.collections.tableColumnEntities[id];
}

function showAll(app: AppContext) {
  app.store.dispatchSync(
    changeShowAction({ show: Show.columnUnique, value: true }),
    changeShowAction({ show: Show.columnAutoIncrement, value: true })
  );
}

const colOf = (mounted: Mounted, type: string) =>
  mounted.container.querySelector(
    `.column-col[data-type="${type}"]`
  ) as HTMLElement | null;

const rootOf = (mounted: Mounted) =>
  mounted.container.querySelector('.column-row') as HTMLElement;

const mousedown = (el: Element, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ...init }));

const dblclick = (el: Element) =>
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

let app: AppContext;
let column: ColumnEntity;
let mounted: Mounted | null = null;

beforeEach(() => {
  app = createTestAppContext();
  column = seedColumn(app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('Column', () => {
  describe('root element', () => {
    it('renders the row with its identity attributes', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const root = rootOf(mounted);

      expect(root).toBeTruthy();
      expect(root.classList.contains('column-row')).toBe(true);
      expect(root.classList.contains(String(styles.root))).toBe(true);
      expect(root.getAttribute('data-id')).toBe(COLUMN_ID);
      expect(root.getAttribute('data-table-id')).toBe(TABLE_ID);
      expect(root.getAttribute('draggable')).toBe('true');
      expect(root.hasAttribute('data-selected')).toBe(false);
      expect(root.hasAttribute('data-hover')).toBe(false);
      expect(root.hasAttribute('data-dragging')).toBe(false);
      expect(root.hasAttribute('data-ghost')).toBe(false);
    });

    it('marks the row as selected and as a drag ghost from its props', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { selected: true, ghost: true }),
        app
      );
      const root = rootOf(mounted);

      expect(root.hasAttribute('data-selected')).toBe(true);
      expect(root.hasAttribute('data-ghost')).toBe(true);
    });

    it('renders draggable="false" when the row is not draggable', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { draggable: false }),
        app
      );

      expect(rootOf(mounted).getAttribute('draggable')).toBe('false');
    });

    it('reflects the hover state coming from the editor store', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      expect(rootOf(mounted).hasAttribute('data-hover')).toBe(false);

      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: COLUMN_ID,
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      app.store.state.editor.hoverColumnMap[COLUMN_ID] = true;
      await flush();

      expect(rootOf(mounted).hasAttribute('data-hover')).toBe(true);
    });

    it('reflects the dragging state coming from the editor store', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      app.store.dispatchSync(
        dragstartColumnAction({ tableId: TABLE_ID, columnIds: [COLUMN_ID] })
      );
      await flush();

      expect(rootOf(mounted).hasAttribute('data-dragging')).toBe(true);
    });

    it('forwards the native dragstart and dragend events', async () => {
      const onDragstart = vi.fn();
      const onDragend = vi.fn();
      mounted = await mountAndFlush(
        columnTemplate(column, { onDragstart, onDragend }),
        app
      );
      const root = rootOf(mounted);

      root.dispatchEvent(new Event('dragstart', { bubbles: true }));
      root.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(onDragstart).toHaveBeenCalledTimes(1);
      expect(onDragend).toHaveBeenCalledTimes(1);
    });
  });

  describe('column order', () => {
    it('renders only the visible columns in the configured order', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      const types = Array.from(
        mounted.container.querySelectorAll('.column-col[data-type]')
      ).map(el => el.getAttribute('data-type'));

      expect(types).toEqual([
        'columnName',
        'columnDataType',
        'columnNotNull',
        'columnDefault',
        'columnComment',
      ]);
    });

    it('adds the unique and auto increment cells when they are shown', async () => {
      showAll(app);
      mounted = await mountAndFlush(columnTemplate(column), app);

      const types = Array.from(
        mounted.container.querySelectorAll('.column-col[data-type]')
      ).map(el => el.getAttribute('data-type'));

      expect(types).toEqual([
        'columnName',
        'columnDataType',
        'columnNotNull',
        'columnUnique',
        'columnAutoIncrement',
        'columnDefault',
        'columnComment',
      ]);
    });

    it('drops a cell again when its show flag is turned off', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      expect(colOf(mounted, 'columnComment')).toBeTruthy();

      app.store.dispatchSync(
        changeShowAction({ show: Show.columnComment, value: false }),
        changeShowAction({ show: Show.columnDataType, value: false }),
        changeShowAction({ show: Show.columnDefault, value: false }),
        changeShowAction({ show: Show.columnNotNull, value: false })
      );
      await flush();

      const types = Array.from(
        mounted.container.querySelectorAll('.column-col[data-type]')
      ).map(el => el.getAttribute('data-type'));

      expect(types).toEqual(['columnName']);
    });

    it('renders the unique and auto increment cells with their fixed widths', async () => {
      showAll(app);
      mounted = await mountAndFlush(columnTemplate(column), app);

      const unique = colOf(mounted, 'columnUnique')?.firstElementChild as
        | HTMLElement
        | undefined;
      const autoIncrement = colOf(mounted, 'columnAutoIncrement')
        ?.firstElementChild as HTMLElement | undefined;

      expect(unique?.textContent?.trim()).toBe('UQ');
      expect(unique?.getAttribute('title')).toBe('Unique');
      expect(unique?.style.width).toBe(`${COLUMN_UNIQUE_WIDTH}px`);
      expect(autoIncrement?.textContent?.trim()).toBe('AI');
      expect(autoIncrement?.getAttribute('title')).toBe('Auto Increment');
      expect(autoIncrement?.style.width).toBe(
        `${COLUMN_AUTO_INCREMENT_WIDTH}px`
      );
    });

    it('renders the not null cell from the column options', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const notNull = colOf(mounted, 'columnNotNull')
        ?.firstElementChild as HTMLElement;

      expect(notNull.textContent?.trim()).toBe('NULL');
      expect(notNull.getAttribute('title')).toBe('Not Null');
    });

    it('renders the editable cells with their placeholders and widths', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      const name = colOf(mounted, 'columnName')
        ?.firstElementChild as HTMLElement;
      const comment = colOf(mounted, 'columnComment')
        ?.firstElementChild as HTMLElement;
      const columnDefault = colOf(mounted, 'columnDefault')
        ?.firstElementChild as HTMLElement;

      expect(name.textContent?.trim()).toBe('column');
      expect(name.style.width).toBe('60px');
      expect(columnDefault.textContent?.trim()).toBe('default');
      expect(columnDefault.style.width).toBe('80px');
      expect(comment.textContent?.trim()).toBe('comment');
      expect(comment.style.width).toBe('90px');
    });
  });

  describe('focus', () => {
    const cases: Array<[string, FocusType]> = [
      ['columnName', FocusType.columnName],
      ['columnDataType', FocusType.columnDataType],
      ['columnNotNull', FocusType.columnNotNull],
      ['columnUnique', FocusType.columnUnique],
      ['columnAutoIncrement', FocusType.columnAutoIncrement],
      ['columnDefault', FocusType.columnDefault],
      ['columnComment', FocusType.columnComment],
    ];

    for (const [dataType, focusType] of cases) {
      it(`focuses ${focusType} on mousedown of the ${dataType} cell`, async () => {
        showAll(app);
        mounted = await mountAndFlush(columnTemplate(column), app);

        mousedown(colOf(mounted, dataType) as HTMLElement);
        await flush();

        expect(app.store.state.editor.focusTable).toMatchObject({
          tableId: TABLE_ID,
          columnId: COLUMN_ID,
          focusType,
        });
      });
    }

    it('appends to the column selection when the mod key is held', async () => {
      const other = app.store.state.collections.tableColumnEntities['c2'] as
        | ColumnEntity
        | undefined;
      expect(other).toBeUndefined();

      app.store.dispatchSync(addColumnAction({ id: 'c2', tableId: TABLE_ID }));
      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: 'c2',
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);

      mousedown(colOf(mounted, 'columnName') as HTMLElement, {
        ctrlKey: true,
        metaKey: true,
      });
      await flush();

      expect(app.store.state.editor.focusTable?.selectColumnIds).toEqual([
        'c2',
        COLUMN_ID,
      ]);
    });

    it('selects the range when the shift key is held', async () => {
      app.store.dispatchSync(addColumnAction({ id: 'c2', tableId: TABLE_ID }));
      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: COLUMN_ID,
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      const second = app.store.state.collections.tableColumnEntities['c2'];
      mounted = await mountAndFlush(columnTemplate(second), app);

      mousedown(colOf(mounted, 'columnName') as HTMLElement, {
        shiftKey: true,
      });
      await flush();

      expect(app.store.state.editor.focusTable?.selectColumnIds).toEqual([
        COLUMN_ID,
        'c2',
      ]);
    });
  });

  describe('edit', () => {
    async function focusAndDblclick(dataType: string) {
      mousedown(colOf(mounted as Mounted, dataType) as HTMLElement);
      await flush();
      dblclick(colOf(mounted as Mounted, dataType) as HTMLElement);
      await flush();
    }

    it.each(['columnName', 'columnDataType', 'columnDefault', 'columnComment'])(
      'starts editing the %s cell on double click',
      async dataType => {
        mounted = await mountAndFlush(columnTemplate(column), app);

        await focusAndDblclick(dataType);

        expect(app.store.state.editor.focusTable).toMatchObject({
          columnId: COLUMN_ID,
          edit: true,
        });
      }
    );

    it.each([
      ['columnNotNull', ColumnOption.notNull],
      ['columnUnique', ColumnOption.unique],
      ['columnAutoIncrement', ColumnOption.autoIncrement],
    ])('toggles %s on double click', async (dataType, option) => {
      showAll(app);
      mounted = await mountAndFlush(columnTemplate(column), app);

      await focusAndDblclick(dataType);

      const stored = app.store.state.collections.tableColumnEntities[COLUMN_ID];
      expect(bHas(stored.options, option as number)).toBe(true);
      expect(app.store.state.editor.focusTable?.edit).toBe(false);
    });

    it('writes the input value back to the column name', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { editName: true }),
        app
      );
      const input = colOf(mounted, 'columnName')?.querySelector(
        'input'
      ) as HTMLInputElement;

      expect(input).toBeTruthy();
      input.value = 'user_id';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      expect(
        app.store.state.collections.tableColumnEntities[COLUMN_ID].name
      ).toBe('user_id');
    });

    it('writes the input value back to the column default and comment', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { editDefault: true, editComment: true }),
        app
      );

      const defaultInput = colOf(mounted, 'columnDefault')?.querySelector(
        'input'
      ) as HTMLInputElement;
      const commentInput = colOf(mounted, 'columnComment')?.querySelector(
        'input'
      ) as HTMLInputElement;

      defaultInput.value = 'now()';
      defaultInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      commentInput.value = 'pk';
      commentInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      const stored = app.store.state.collections.tableColumnEntities[COLUMN_ID];
      expect(stored.default).toBe('now()');
      expect(stored.comment).toBe('pk');
    });

    it('writes the input value back to the column data type', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { editDataType: true }),
        app
      );
      const input = colOf(mounted, 'columnDataType')?.querySelector(
        'input'
      ) as HTMLInputElement;

      input.value = 'int';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      expect(
        app.store.state.collections.tableColumnEntities[COLUMN_ID].dataType
      ).toBe('int');
    });

    it('ends the edit session when the input blurs', async () => {
      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: COLUMN_ID,
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      mounted = await mountAndFlush(
        columnTemplate(column, { editName: true }),
        app
      );
      app.store.state.editor.focusTable!.edit = true;

      const input = colOf(mounted, 'columnName')?.querySelector(
        'input'
      ) as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('blur'));
      await flush();

      expect(app.store.state.editor.focusTable?.edit).toBe(false);
    });

    it('ignores an input event without a target element', async () => {
      mounted = await mountAndFlush(
        columnTemplate(column, { editName: true }),
        app
      );
      const input = colOf(mounted, 'columnName')?.querySelector(
        'input'
      ) as HTMLInputElement;

      input.value = 'ignored';
      const event = new InputEvent('input', { bubbles: true });
      Object.defineProperty(event, 'target', {
        configurable: true,
        get: () => null,
      });
      input.dispatchEvent(event);
      await flush();

      expect(
        app.store.state.collections.tableColumnEntities[COLUMN_ID].name
      ).toBe('');
    });
  });

  describe('column key hover', () => {
    const keyIcon = (m: Mounted) =>
      m.container.querySelector('.column-col.icon') as HTMLElement;

    it('does not hover anything while the column has no key', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      keyIcon(mounted).dispatchEvent(new MouseEvent('mouseenter'));
      await flush();

      expect(app.store.state.editor.hoverColumnMap).toEqual({});
    });

    it('hovers the column once it owns a key', async () => {
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);

      keyIcon(mounted).dispatchEvent(new MouseEvent('mouseenter'));
      await flush();

      expect(app.store.state.editor.hoverColumnMap).toEqual({
        [COLUMN_ID]: true,
      });
    });

    it('clears the hover map on mouseleave', async () => {
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);

      keyIcon(mounted).dispatchEvent(new MouseEvent('mouseenter'));
      await flush();
      keyIcon(mounted).dispatchEvent(new MouseEvent('mouseleave'));
      await flush();

      expect(app.store.state.editor.hoverColumnMap).toEqual({});
    });
  });

  describe('remove button', () => {
    const removeIcon = (m: Mounted) =>
      m.container.querySelector(
        `.icon.${String(styles.iconButton)}`
      ) as HTMLElement;

    it('titles the remove button with the removeColumn shortcut', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const title = removeIcon(mounted).getAttribute('title');

      expect(title).toBe(
        simpleShortcutToString(app.keyBindingMap.removeColumn[0]?.shortcut)
      );
      expect(title).not.toBe('');
    });

    it('retitles the remove button when the key binding changes', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      app.keyBindingMap.removeColumn = [
        { shortcut: 'Alt+KeyQ', preventDefault: true },
      ];
      await flush();

      expect(removeIcon(mounted).getAttribute('title')).toBe(
        simpleShortcutToString('Alt+KeyQ')
      );
    });

    it('removes the column from its table when clicked', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      expect(
        app.store.state.collections.tableEntities[TABLE_ID].columnIds
      ).toEqual([COLUMN_ID]);

      removeIcon(mounted).dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
      await flush();

      expect(
        app.store.state.collections.tableEntities[TABLE_ID].columnIds
      ).toEqual([]);
    });
  });
});
