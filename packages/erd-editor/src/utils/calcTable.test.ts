import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_HEIGHT } from '@/constants/layout';
import { Show } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import {
  calcTableHeight,
  calcTableWidths,
  recalculateTableWidth,
} from '@/utils/calcTable';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

type StateOptions = {
  show?: number;
  maxWidthComment?: number;
  tables?: Table[];
  columns?: Column[];
};

function createState({
  show = 0,
  maxWidthComment = -1,
  tables = [],
  columns = [],
}: StateOptions = {}): RootState {
  const schema = schemaV3Parser({});
  schema.settings.show = show;
  schema.settings.maxWidthComment = maxWidthComment;
  schema.doc.tableIds = tables.map(table => table.id);

  for (const table of tables) {
    schema.collections.tableEntities[table.id] = table;
  }
  for (const column of columns) {
    schema.collections.tableColumnEntities[column.id] = column;
  }

  return { ...schema, editor: createEditor(), lww: {} };
}

describe('calcTableWidths', () => {
  it('falls back to the default column width when nothing is shown', () => {
    const table = createTable({ id: 'table-1' });
    const state = createState({ show: 0, tables: [table] });

    // 12 + 8 + 60 + 8 + 12 = 100 -> 1 + 8 + 100 + 8 + 1
    expect(calcTableWidths(table, state)).toEqual({
      width: 118,
      name: 0,
      comment: 0,
      dataType: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('adds the table comment width when the table comment is shown', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });
    const state = createState({ show: Show.tableComment, tables: [table] });

    // (100 + 8) + (70 + 8) = 186 -> 1 + 8 + 186 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(204);
  });

  it('clamps the table comment width to maxWidthComment', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });

    expect(
      calcTableWidths(
        table,
        createState({
          show: Show.tableComment,
          maxWidthComment: 65,
          tables: [table],
        })
      ).width
    ).toBe(199);
  });

  it('keeps the table comment width when maxWidthComment is larger', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });

    expect(
      calcTableWidths(
        table,
        createState({
          show: Show.tableComment,
          maxWidthComment: 100,
          tables: [table],
        })
      ).width
    ).toBe(204);
  });

  it('collects the max width of every shown column field', () => {
    const columns = [
      createColumn({
        id: 'column-1',
        tableId: 'table-1',
        ui: {
          widthName: 80,
          widthComment: 70,
          widthDataType: 90,
          widthDefault: 60,
        },
      }),
      createColumn({
        id: 'column-2',
        tableId: 'table-1',
        ui: {
          widthName: 60,
          widthComment: 120,
          widthDataType: 60,
          widthDefault: 100,
        },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'column-2'],
    });
    const show =
      Show.columnComment |
      Show.columnDataType |
      Show.columnDefault |
      Show.columnNotNull |
      Show.columnAutoIncrement |
      Show.columnUnique;
    const state = createState({ show, tables: [table], columns });

    expect(calcTableWidths(table, state)).toEqual({
      width: 568,
      name: 80,
      comment: 120,
      dataType: 90,
      default: 100,
      notNull: 35,
      autoIncrement: 15,
      unique: 22,
    });
  });

  it('leaves hidden column fields at zero even when the column has a width', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      ui: {
        widthName: 80,
        widthComment: 200,
        widthDataType: 90,
        widthDefault: 300,
      },
    });
    const table = createTable({ id: 'table-1', columnIds: ['column-1'] });
    const state = createState({
      show: Show.columnDataType,
      tables: [table],
      columns: [column],
    });

    expect(calcTableWidths(table, state)).toEqual({
      width: 236,
      name: 80,
      comment: 0,
      dataType: 90,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('clamps the column comment width to maxWidthComment', () => {
    const columns = [
      createColumn({
        id: 'column-1',
        tableId: 'table-1',
        ui: { widthName: 60, widthComment: 70 },
      }),
      createColumn({
        id: 'column-2',
        tableId: 'table-1',
        ui: { widthName: 60, widthComment: 120 },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'column-2'],
    });
    const state = createState({
      show: Show.columnComment,
      maxWidthComment: 100,
      tables: [table],
      columns,
    });

    expect(calcTableWidths(table, state).comment).toBe(100);
  });

  it('uses the flag widths for the boolean columns even without any column', () => {
    const table = createTable({ id: 'table-1' });
    const show =
      Show.columnNotNull | Show.columnUnique | Show.columnAutoIncrement;
    const state = createState({ show, tables: [table] });

    expect(calcTableWidths(table, state)).toEqual({
      width: 214,
      name: 0,
      comment: 0,
      dataType: 0,
      default: 0,
      notNull: 35,
      autoIncrement: 15,
      unique: 22,
    });
  });

  it('ignores column ids that are not in the collection', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      ui: { widthName: 200 },
    });
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'missing'],
    });
    const state = createState({
      show: 0,
      tables: [table],
      columns: [column],
    });

    // 12 + 8 + 12 + (200 + 8) = 240 -> 1 + 8 + 240 + 8 + 1
    expect(calcTableWidths(table, state)).toEqual({
      width: 258,
      name: 200,
      comment: 0,
      dataType: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('lets a wide table name win over the column widths', () => {
    const column = createColumn({ id: 'column-1', tableId: 'table-1' });
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1'],
      ui: { widthName: 500 },
    });
    const state = createState({
      show: 0,
      tables: [table],
      columns: [column],
    });

    // (500 + 8) -> 1 + 8 + 508 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(526);
  });
});

describe('calcTableHeight', () => {
  it('returns only the chrome for a table without columns', () => {
    expect(calcTableHeight(createTable())).toBe(56);
  });

  it('adds one column height per column id', () => {
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      56 + 3 * COLUMN_HEIGHT
    );
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      128
    );
  });
});

describe('recalculateTableWidth', () => {
  it('recomputes every width of the tables listed in the doc', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      name: 'created_at',
      dataType: 'timestamp',
      default: '',
      comment: 'x',
    });
    const table = createTable({
      id: 'table-1',
      name: 'users',
      comment: 'user table',
      columnIds: ['column-1'],
    });
    const state = createState({ tables: [table], columns: [column] });
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    recalculateTableWidth(state, context);

    // 'users' -> 50, clamped to the 60 minimum
    expect(table.ui.widthName).toBe(60);
    expect(table.ui.widthComment).toBe(100);
    expect(column.ui.widthName).toBe(100);
    expect(column.ui.widthDataType).toBe(90);
    expect(column.ui.widthDefault).toBe(60);
    expect(column.ui.widthComment).toBe(60);
  });

  it('leaves tables that are not referenced by the doc untouched', () => {
    const listed = createTable({ id: 'table-1', name: 'a-very-long-name' });
    const unlisted = createTable({
      id: 'table-2',
      name: 'another-very-long-name',
    });
    const state = createState({ tables: [listed, unlisted] });
    state.doc.tableIds = ['table-1'];
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    recalculateTableWidth(state, context);

    expect(listed.ui.widthName).toBe(160);
    expect(unlisted.ui.widthName).toBe(60);
  });

  it('skips table ids that have no entity and column ids that have no entity', () => {
    const table = createTable({
      id: 'table-1',
      name: 'wide-table-name',
      columnIds: ['missing-column'],
    });
    const state = createState({ tables: [table] });
    state.doc.tableIds = ['table-1', 'missing-table'];
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    expect(() => recalculateTableWidth(state, context)).not.toThrow();
    expect(table.ui.widthName).toBe(150);
  });
});
