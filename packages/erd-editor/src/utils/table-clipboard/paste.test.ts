import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnType, Show } from '@/constants/schema';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import {
  tablePasteFromHtmlToColumns,
  tablePasteFromTextToColumns,
} from '@/utils/table-clipboard/paste';

const ALL_SHOW =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnAutoIncrement |
  Show.columnPrimaryKey |
  Show.columnUnique |
  Show.columnNotNull |
  Show.relationship;

const FULL_COLUMN_ORDER = [
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnNotNull,
  ColumnType.columnUnique,
  ColumnType.columnAutoIncrement,
  ColumnType.columnDefault,
  ColumnType.columnComment,
];

function createState(
  show: number = ALL_SHOW,
  columnOrder: number[] = FULL_COLUMN_ORDER
): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = show;
  state.settings.columnOrder = columnOrder;
  return state;
}

describe('tablePasteFromTextToColumns', () => {
  it('maps tab separated cells onto the visible column order', () => {
    const columns = tablePasteFromTextToColumns(
      createState(),
      'id\tint\tNOT NULL\tTRUE\tTRUE\t0\tprimary key'
    );

    expect(columns).toHaveLength(1);
    const [column] = columns;
    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(column.default).toBe('0');
    expect(column.comment).toBe('primary key');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column.options, ColumnOption.unique)).toBe(true);
    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(true);
    expect(bHas(column.options, ColumnOption.primaryKey)).toBe(false);
  });

  it('creates one column per line', () => {
    const columns = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      'id\nname\nemail'
    );

    expect(columns.map(column => column.name)).toEqual(['id', 'name', 'email']);
    expect(new Set(columns.map(column => column.id)).size).toBe(3);
  });

  it('trims surrounding whitespace from every cell', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '  id  \t  int  '
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('leaves defaults untouched for empty and missing cells', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(),
      'id\t\tNOT NULL'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('');
    expect(column.default).toBe('');
    expect(column.comment).toBe('');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
  });

  it('skips cells whose column type is hidden by the settings', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(Show.columnComment, FULL_COLUMN_ORDER),
      'id\tsome comment\tint'
    );

    expect(column.name).toBe('id');
    expect(column.comment).toBe('some comment');
    expect(column.dataType).toBe('');
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['Y', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['not null', false],
  ])('treats %s as autoIncrement=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnAutoIncrement]),
      value
    );

    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(expected);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['Yes', true],
    ['y', true],
    ['false', false],
    ['null', false],
  ])('treats %s as unique=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnUnique]),
      value
    );

    expect(bHas(column.options, ColumnOption.unique)).toBe(expected);
  });

  it.each([
    ['NOT NULL', true],
    ['not null', true],
    ['true', true],
    ['1', true],
    ['NULL', false],
    ['nullable', false],
  ])('treats %s as notNull=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnNotNull]),
      value
    );

    expect(bHas(column.options, ColumnOption.notNull)).toBe(expected);
  });

  it('returns a single default column for an empty string', () => {
    const columns = tablePasteFromTextToColumns(createState(), '');

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe('');
    expect(columns[0].options).toBe(0);
  });
});

describe('tablePasteFromHtmlToColumns', () => {
  it('maps td cells positionally when they carry no data-type', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(),
      '<table><tbody><tr><td>id</td><td>int</td><td>NOT NULL</td><td>yes</td><td>1</td><td>0</td><td>pk</td></tr></tbody></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(column.default).toBe('0');
    expect(column.comment).toBe('pk');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column.options, ColumnOption.unique)).toBe(true);
    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(true);
  });

  it('prefers data-type over the positional column order', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><td data-type="columnComment">a comment</td><td data-type="columnName">id</td></tr></table>'
    );

    expect(column.comment).toBe('a comment');
    expect(column.name).toBe('id');
    expect(column.dataType).toBe('');
  });

  it('applies typed cells that sit beyond the visible column order', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td data-type="columnName">id</td><td data-type="columnDataType">int</td><td data-type="columnNotNull">NOT NULL</td></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
  });

  it('maps every known data-type even when nothing is visible', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(0, []),
      '<table><tr>' +
        '<td data-type="columnName">id</td>' +
        '<td data-type="columnDataType">bigint</td>' +
        '<td data-type="columnDefault">nextval()</td>' +
        '<td data-type="columnComment">the pk</td>' +
        '<td data-type="columnAutoIncrement">TRUE</td>' +
        '<td data-type="columnUnique">yes</td>' +
        '<td data-type="columnNotNull">NOT NULL</td>' +
        '</tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('bigint');
    expect(column.default).toBe('nextval()');
    expect(column.comment).toBe('the pk');
    expect(column.options).toBe(
      ColumnOption.autoIncrement | ColumnOption.unique | ColumnOption.notNull
    );
  });

  it('leaves the option bits clear for falsy typed flag cells', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(0, []),
      '<table><tr>' +
        '<td data-type="columnAutoIncrement">FALSE</td>' +
        '<td data-type="columnUnique">no</td>' +
        '<td data-type="columnNotNull">NULL</td>' +
        '</tr></table>'
    );

    expect(column.options).toBe(0);
  });

  it('reads th cells as well as td cells', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><th>id</th><th>int</th></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('creates one column per tr', () => {
    const columns = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td>id</td></tr><tr><td>name</td></tr></table>'
    );

    expect(columns.map(column => column.name)).toEqual(['id', 'name']);
  });

  it('trims the text content of every cell', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><td>\n  id \n</td><td data-type="columnDataType"> int </td></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('ignores unknown data-type values and falls back to the position', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td data-type="columnPrimaryKey">id</td></tr></table>'
    );

    expect(column.name).toBe('id');
  });

  it('returns an empty array when the html has no rows', () => {
    expect(tablePasteFromHtmlToColumns(createState(), '')).toEqual([]);
    expect(
      tablePasteFromHtmlToColumns(createState(), '<div>not a table</div>')
    ).toEqual([]);
  });

  it('produces a default column for a row with no cells', () => {
    const columns = tablePasteFromHtmlToColumns(
      createState(),
      '<table><tr></tr></table>'
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe('');
    expect(columns[0].options).toBe(0);
  });
});
