import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as styles from '@/components/table-view/column/Column.styles';
import Column from '@/components/visualization/table/column/Column';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import { ColumnType, NameViewMode, Show } from '@/constants/schema';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import {
  changeColumnOrderAction,
  changeShowAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { createI18n } from '@/i18n/translate';
import type { Column as ColumnEntity } from '@/internal-types';

const TABLE_ID = 't1';
const COLUMN_ID = 'c1';

const WIDTH_NAME = 60;
const WIDTH_DATA_TYPE = 70;
const WIDTH_DEFAULT = 80;
const WIDTH_COMMENT = 90;

let app: AppContext;
let column: ColumnEntity;
let mounted: Mounted | null = null;

function columnTemplate(entity: ColumnEntity) {
  return html`
    <${Column}
      column=${entity}
      widthName=${WIDTH_NAME}
      widthDataType=${WIDTH_DATA_TYPE}
      widthDefault=${WIDTH_DEFAULT}
      widthComment=${WIDTH_COMMENT}
    />
  `;
}

const rootOf = (m: Mounted) =>
  m.container.querySelector('.column-row') as HTMLElement;

/** The key icon also carries column-col, so exclude it from the cell list. */
const cellsOf = (m: Mounted) =>
  Array.from(
    m.container.querySelectorAll('.column-row > .column-col:not(.icon)')
  ) as HTMLElement[];

const cellTexts = (m: Mounted) =>
  cellsOf(m).map(cell => cell.textContent?.trim().replace(/\s+/g, ' ') ?? '');

function showAll() {
  app.store.dispatchSync(
    changeShowAction({ show: Show.columnUnique, value: true }),
    changeShowAction({ show: Show.columnAutoIncrement, value: true })
  );
}

beforeEach(() => {
  app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
  );
  column = app.store.state.collections.tableColumnEntities[COLUMN_ID];
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('visualization Column', () => {
  describe('alternate key mark', () => {
    const markOf = (m: Mounted) =>
      m.container.querySelector('[data-alternate-key]') as HTMLElement | null;

    it('draws none while the table keeps no room for one', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      expect(markOf(mounted)).toBeNull();
    });

    const marked = () => html`
      <${Column}
        column=${column}
        widthName=${WIDTH_NAME}
        widthDataType=${WIDTH_DATA_TYPE}
        widthDefault=${WIDTH_DEFAULT}
        widthComment=${WIDTH_COMMENT}
        widthAlternateKey=${37}
        alternateKey=${'AK1.2'}
      />
    `;

    it('draws the mark last, after every cell, in the room the table keeps', async () => {
      mounted = await mountAndFlush(marked(), app);
      const mark = markOf(mounted) as HTMLElement;

      expect(rootOf(mounted).lastElementChild).toBe(mark);
      expect(cellTexts(mounted).at(-2)).toBe('comment');
      expect(mark.textContent).toBe('AK1.2');
      expect(mark.style.width).toBe('37px');
      expect(mark.style.fontFamily).toBe('var(--code-font-family)');
    });

    it('stays last when the settings order the comment first', async () => {
      app.store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnComment,
          target: ColumnType.columnName,
        })
      );
      mounted = await mountAndFlush(marked(), app);

      expect(cellTexts(mounted)[0]).toBe('comment');
      expect(rootOf(mounted).lastElementChild).toBe(markOf(mounted));
    });

    it('leaves the room empty in a row that is in no key', async () => {
      mounted = await mountAndFlush(
        html`
          <${Column}
            column=${column}
            widthName=${WIDTH_NAME}
            widthDataType=${WIDTH_DATA_TYPE}
            widthDefault=${WIDTH_DEFAULT}
            widthComment=${WIDTH_COMMENT}
            widthAlternateKey=${37}
          />
        `,
        app
      );

      expect((markOf(mounted) as HTMLElement).textContent).toBe('');
    });
  });

  describe('root element', () => {
    it('renders the row with the shared canvas column styling and its id', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const root = rootOf(mounted);

      expect(root).toBeTruthy();
      expect(root.classList.contains('column-row')).toBe(true);
      expect(root.classList.contains(String(styles.root))).toBe(true);
      expect(root.getAttribute('data-id')).toBe(COLUMN_ID);
      expect(root.hasAttribute('data-selected')).toBe(false);
    });

    it('renders the key icon as the first child of the row', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const first = rootOf(mounted).firstElementChild as HTMLElement;

      expect(first.classList.contains('icon')).toBe(true);
      expect(first.classList.contains('column-col')).toBe(true);
      expect(first.classList.contains('pk')).toBe(false);
    });

    it('flags the key icon as a primary key once the column owns one', async () => {
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);

      expect(
        (rootOf(mounted).firstElementChild as HTMLElement).classList.contains(
          'pk'
        )
      ).toBe(true);
    });
  });

  describe('column order', () => {
    it('renders the default visible cells in the configured order', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      expect(cellTexts(mounted)).toEqual([
        'column',
        'dataType',
        'NULL',
        'default',
        'comment',
      ]);
    });

    it('inserts the unique and auto increment cells when they are shown', async () => {
      showAll();
      mounted = await mountAndFlush(columnTemplate(column), app);

      expect(cellTexts(mounted)).toEqual([
        'column',
        'dataType',
        'NULL',
        'UQ',
        'AI',
        'default',
        'comment',
      ]);
    });

    it('drops every optional cell when its show flag is turned off', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      expect(cellTexts(mounted)).toHaveLength(5);

      app.store.dispatchSync(
        changeShowAction({ show: Show.columnDataType, value: false }),
        changeShowAction({ show: Show.columnNotNull, value: false }),
        changeShowAction({ show: Show.columnDefault, value: false }),
        changeShowAction({ show: Show.columnComment, value: false })
      );
      await flush();

      expect(cellTexts(mounted)).toEqual(['column']);
    });
  });

  describe('cell contents', () => {
    it('sizes each editable cell from its width prop', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const inputs = Array.from(
        rootOf(mounted).querySelectorAll('.edit-input')
      ) as HTMLElement[];

      expect(inputs.map(input => input.style.width)).toEqual([
        `${WIDTH_NAME}px`,
        `${WIDTH_DATA_TYPE}px`,
        `${WIDTH_DEFAULT}px`,
        `${WIDTH_COMMENT}px`,
      ]);
    });

    it('sizes the not null, unique and auto increment cells from the layout constants', async () => {
      showAll();
      mounted = await mountAndFlush(columnTemplate(column), app);
      const [, , notNull, unique, autoIncrement] = cellsOf(mounted).map(
        cell => cell.firstElementChild as HTMLElement
      );

      expect(notNull.style.width).toBe(`${COLUMN_NOT_NULL_WIDTH}px`);
      expect(notNull.getAttribute('title')).toBe('Not Null');
      expect(unique.style.width).toBe(`${COLUMN_UNIQUE_WIDTH}px`);
      expect(unique.getAttribute('title')).toBe('Unique');
      expect(autoIncrement.style.width).toBe(
        `${COLUMN_AUTO_INCREMENT_WIDTH}px`
      );
      expect(autoIncrement.getAttribute('title')).toBe('Auto Increment');
    });

    it('renders the placeholder while the column values are empty', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const nameCell = cellsOf(mounted)[0].firstElementChild as HTMLElement;

      expect(nameCell.classList.contains('placeholder')).toBe(true);
      expect(nameCell.textContent?.trim()).toBe('column');
    });

    it('draws the placeholders and titles in the language the element shows, following a switch', async () => {
      const i18n = createTestI18n('en');
      const provider = provideI18n(document.body, i18n);

      try {
        showAll();
        mounted = await mountAndFlush(columnTemplate(column), app);

        Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
        await flush();

        expect(cellTexts(mounted)).toEqual([
          'ko:column',
          'ko:dataType',
          'NULL',
          'UQ',
          'AI',
          'ko:default',
          'ko:comment',
        ]);
        const [, , notNull, unique, autoIncrement] = cellsOf(mounted).map(
          cell => cell.firstElementChild as HTMLElement
        );
        expect(notNull.getAttribute('title')).toBe('ko:Not Null');
        expect(unique.getAttribute('title')).toBe('ko:Unique');
        expect(autoIncrement.getAttribute('title')).toBe('ko:Auto Increment');
      } finally {
        provider.destroy();
      }
    });

    it('re-renders the name cell when the column name changes in the store', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);

      app.store.dispatchSync(
        changeColumnNameAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: 'user_id',
        })
      );
      await flush();

      const nameCell = cellsOf(mounted)[0].firstElementChild as HTMLElement;
      expect(nameCell.textContent?.trim()).toBe('user_id');
      expect(nameCell.classList.contains('placeholder')).toBe(false);
    });

    it('renders the not null cell from the column options', async () => {
      app.store.dispatchSync(
        changeColumnNotNullAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);

      expect(cellTexts(mounted)[2]).toBe('N-N');
    });

    it('checks the unique and auto increment cells from the column options', async () => {
      showAll();
      app.store.dispatchSync(
        changeColumnUniqueAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        }),
        changeColumnAutoIncrementAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(columnTemplate(column), app);
      const [, , , unique, autoIncrement] = cellsOf(mounted).map(
        cell => cell.firstElementChild as HTMLElement
      );

      expect(unique.classList.contains('checked')).toBe(true);
      expect(autoIncrement.classList.contains('checked')).toBe(true);
    });

    it('leaves the unique and auto increment cells unchecked by default', async () => {
      showAll();
      mounted = await mountAndFlush(columnTemplate(column), app);
      const [, , , unique, autoIncrement] = cellsOf(mounted).map(
        cell => cell.firstElementChild as HTMLElement
      );

      expect(unique.classList.contains('checked')).toBe(false);
      expect(autoIncrement.classList.contains('checked')).toBe(false);
    });

    it('renders the data type cell read only, without an input', async () => {
      mounted = await mountAndFlush(columnTemplate(column), app);
      const dataTypeCell = cellsOf(mounted)[1];

      expect(dataTypeCell.querySelector('input')).toBeNull();
      expect(dataTypeCell.querySelector('.edit-input')).toBeTruthy();
    });
  });

  describe('name views', () => {
    const WIDTH_LOGICAL_NAME = 50;
    const WIDTH_DOMAIN = 40;

    const viewTemplate = () => html`
      <${Column}
        column=${column}
        widthName=${WIDTH_NAME}
        widthDataType=${WIDTH_DATA_TYPE}
        widthDefault=${WIDTH_DEFAULT}
        widthComment=${WIDTH_COMMENT}
        widthLogicalName=${WIDTH_LOGICAL_NAME}
        widthDomain=${WIDTH_DOMAIN}
      />
    `;

    const switchTo = (mode: (typeof NameViewMode)[keyof typeof NameViewMode]) =>
      app.store.dispatchSync(
        toNameViewModeAction(app.store.state, mode, false)
      );

    // A member_id INT row linking the Identifier domain, no other cell shown.
    beforeEach(() => {
      app.store.dispatchSync(
        changeColumnNameAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: 'member_id',
        }),
        changeColumnDataTypeAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: 'INT',
        }),
        addDictionaryAction({
          kind: 'domain',
          id: 'd1',
          values: { name: 'Identifier', dataType: 'INT' },
        }),
        changeColumnDomainAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: 'd1',
        }),
        changeShowAction({ show: Show.columnNotNull, value: false }),
        changeShowAction({ show: Show.columnDefault, value: false }),
        changeShowAction({ show: Show.columnComment, value: false })
      );
    });

    it('draws the logical name in the name cell and the domain in the type cell in the logical view', async () => {
      app.store.dispatchSync(
        changeColumnLogicalNameAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: 'Member ID',
        })
      );
      switchTo(NameViewMode.logical);
      mounted = await mountAndFlush(viewTemplate(), app);

      expect(cellTexts(mounted)).toEqual(['Member ID', 'Identifier']);
      expect(
        (cellsOf(mounted)[0].firstElementChild as HTMLElement).style.width
      ).toBe(`${WIDTH_NAME}px`);
    });

    it('dims the name standing in for a blank logical name in the logical view', async () => {
      switchTo(NameViewMode.logical);
      mounted = await mountAndFlush(viewTemplate(), app);
      const nameCell = cellsOf(mounted)[0].firstElementChild as HTMLElement;

      expect(nameCell.textContent?.trim()).toBe('member_id');
      expect(nameCell.classList.contains('placeholder')).toBe(true);
    });

    it('adds the logical name cell before the name in the view of both, the type kept', async () => {
      switchTo(NameViewMode.both);
      mounted = await mountAndFlush(viewTemplate(), app);
      const [logicalName] = cellsOf(mounted).map(
        cell => cell.firstElementChild as HTMLElement
      );

      expect(cellTexts(mounted)).toEqual(['logical', 'member_id', 'INT']);
      expect(logicalName.classList.contains('placeholder')).toBe(true);
      expect(logicalName.style.width).toBe(`${WIDTH_LOGICAL_NAME}px`);
    });

    it('shows the domain cell under its bit in every view, the logical type cell then keeping the type', async () => {
      app.store.dispatchSync(
        changeShowAction({ show: Show.columnDomain, value: true })
      );
      switchTo(NameViewMode.logical);
      mounted = await mountAndFlush(viewTemplate(), app);

      expect(cellTexts(mounted)).toEqual(['member_id', 'INT', 'Identifier']);
      expect(
        (cellsOf(mounted)[2].firstElementChild as HTMLElement).style.width
      ).toBe(`${WIDTH_DOMAIN}px`);

      switchTo(NameViewMode.physical);
      await flush();
      expect(cellTexts(mounted)).toEqual(['member_id', 'INT', 'Identifier']);
    });

    it('leaves the domain cell empty for a column linking no domain', async () => {
      app.store.dispatchSync(
        changeColumnDomainAction({
          id: COLUMN_ID,
          tableId: TABLE_ID,
          value: '',
        }),
        changeShowAction({ show: Show.columnDomain, value: true })
      );
      mounted = await mountAndFlush(viewTemplate(), app);

      expect(cellTexts(mounted)).toEqual(['member_id', 'INT', '']);
    });
  });
});
