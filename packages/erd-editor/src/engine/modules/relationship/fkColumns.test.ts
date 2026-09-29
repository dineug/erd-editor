import { describe, expect, it } from 'vite-plus/test';

import {
  toForeignKeyActions,
  toForeignKeyNames,
} from '@/engine/modules/relationship/fkColumns';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import { Column } from '@/internal-types';
import { createColumn } from '@/utils/collection/tableColumn.entity';

function makeColumn(value: Partial<Column>): Column {
  return createColumn(value as any);
}

const unnamed = { startTableName: '', endColumnNames: [] };

describe('toForeignKeyNames', () => {
  it('joins the start table name and the key name with an underscore', () => {
    expect(toForeignKeyNames('user', ['id'], [])).toEqual(['user_id']);
  });

  it('prefixes every member of a composite key', () => {
    expect(toForeignKeyNames('order', ['id', 'code'], [])).toEqual([
      'order_id',
      'order_code',
    ]);
  });

  it('keeps the table name as written, neither case converted nor singular', () => {
    expect(toForeignKeyNames('Users', ['ID'], [])).toEqual(['Users_ID']);
    expect(toForeignKeyNames('order item', ['id'], [])).toEqual([
      'order item_id',
    ]);
  });

  it('keeps a key name that already starts with the table name and an underscore', () => {
    expect(toForeignKeyNames('user', ['user_id'], [])).toEqual(['user_id']);
    expect(toForeignKeyNames('User', ['user_id'], [])).toEqual(['user_id']);
    expect(toForeignKeyNames('user', ['USER_CODE'], [])).toEqual(['USER_CODE']);
  });

  it('keeps a key name equal to the table name', () => {
    expect(toForeignKeyNames('user', ['user'], [])).toEqual(['user']);
    expect(toForeignKeyNames('user', ['USER'], [])).toEqual(['USER']);
  });

  it('prefixes a key name that only begins with the table name', () => {
    expect(toForeignKeyNames('user', ['username'], [])).toEqual([
      'user_username',
    ]);
    expect(toForeignKeyNames('user', ['userId'], [])).toEqual(['user_userId']);
  });

  it('falls back to the key name for a blank table name', () => {
    expect(toForeignKeyNames('', ['id'], [])).toEqual(['id']);
    expect(toForeignKeyNames('   ', ['id'], [])).toEqual(['id']);
  });

  it('trims the table name and the key name', () => {
    expect(toForeignKeyNames('  user ', [' id  '], [])).toEqual(['user_id']);
    expect(toForeignKeyNames('', [' id '], [])).toEqual(['id']);
  });

  it('leaves a key with no name without one, never a bare prefix', () => {
    expect(toForeignKeyNames('user', [''], [])).toEqual(['']);
    expect(toForeignKeyNames('user', ['  '], [])).toEqual(['']);
  });

  it('numbers a name the end table already holds, from 2', () => {
    expect(toForeignKeyNames('user', ['id'], ['id', 'user_id'])).toEqual([
      'user_id_2',
    ]);
    expect(
      toForeignKeyNames('user', ['id'], ['user_id', 'user_id_2', 'user_id_3'])
    ).toEqual(['user_id_4']);
  });

  it('compares the names it must stay clear of without case or padding', () => {
    expect(toForeignKeyNames('user', ['id'], [' USER_ID '])).toEqual([
      'user_id_2',
    ]);
    expect(toForeignKeyNames('user', ['id'], ['User_Id_2', 'user_id'])).toEqual(
      ['user_id_3']
    );
  });

  it('numbers a copied key name on a blank table name as well', () => {
    expect(toForeignKeyNames('', ['id'], ['id'])).toEqual(['id_2']);
  });

  it('numbers a key already named after the table when the table holds it', () => {
    expect(toForeignKeyNames('user', ['user_id'], ['user_id'])).toEqual([
      'user_id_2',
    ]);
  });

  it('keeps the composite members apart from each other', () => {
    expect(toForeignKeyNames('user', ['id', 'ID'], [])).toEqual([
      'user_id',
      'user_ID_2',
    ]);
    expect(toForeignKeyNames('user', ['id', 'id_2'], ['user_id'])).toEqual([
      'user_id_2',
      'user_id_2_2',
    ]);
  });

  it('lets a member that keeps its name claim it before a prefixed one, in either order', () => {
    expect(toForeignKeyNames('user', ['id', 'user_id'], [])).toEqual([
      'user_id_2',
      'user_id',
    ]);
    expect(toForeignKeyNames('user', ['user_id', 'id'], [])).toEqual([
      'user_id',
      'user_id_2',
    ]);
  });

  it('numbers a kept member only for the end table, never for a prefixed one', () => {
    expect(toForeignKeyNames('user', ['id', 'user_id'], ['user_id'])).toEqual([
      'user_id_3',
      'user_id_2',
    ]);
  });

  it('never numbers an empty name, however many the end table holds', () => {
    expect(toForeignKeyNames('user', ['', 'id'], ['', ''])).toEqual([
      '',
      'user_id',
    ]);
  });
});

describe('toForeignKeyActions', () => {
  it('returns nothing for no start columns', () => {
    expect(toForeignKeyActions([], 't2', [], unnamed)).toEqual([]);
  });

  it('adds a NOT NULL copy per start column under the id at the same index', () => {
    const startColumns = [
      makeColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'int',
        default: '0',
        comment: 'pk',
        options: 1,
      }),
      makeColumn({
        id: 'c2',
        tableId: 't1',
        name: 'code',
        dataType: 'char(2)',
        default: "'kr'",
        comment: '',
      }),
    ];

    expect(
      toForeignKeyActions(startColumns, 't2', ['f1', 'f2'], {
        startTableName: 'country',
        endColumnNames: ['id', 'name'],
      })
    ).toEqual([
      addColumnAction({ id: 'f1', tableId: 't2' }),
      changeColumnNotNullAction({ id: 'f1', tableId: 't2', value: true }),
      changeColumnNameAction({ id: 'f1', tableId: 't2', value: 'country_id' }),
      changeColumnDataTypeAction({ id: 'f1', tableId: 't2', value: 'int' }),
      changeColumnDefaultAction({ id: 'f1', tableId: 't2', value: '0' }),
      changeColumnCommentAction({ id: 'f1', tableId: 't2', value: 'pk' }),
      addColumnAction({ id: 'f2', tableId: 't2' }),
      changeColumnNotNullAction({ id: 'f2', tableId: 't2', value: true }),
      changeColumnNameAction({
        id: 'f2',
        tableId: 't2',
        value: 'country_code',
      }),
      changeColumnDataTypeAction({
        id: 'f2',
        tableId: 't2',
        value: 'char(2)',
      }),
      changeColumnDefaultAction({ id: 'f2', tableId: 't2', value: "'kr'" }),
      changeColumnCommentAction({ id: 'f2', tableId: 't2', value: '' }),
    ]);
  });

  it('numbers the name on a self reference, where the key itself is taken', () => {
    const actions = toForeignKeyActions(
      [makeColumn({ id: 'c1', tableId: 't1', name: 'id' })],
      't1',
      ['f1'],
      { startTableName: '', endColumnNames: ['id'] }
    );

    expect(actions[2]).toEqual(
      changeColumnNameAction({ id: 'f1', tableId: 't1', value: 'id_2' })
    );
  });

  it('marks the copy NOT NULL even when the start column allows null', () => {
    const actions = toForeignKeyActions(
      [makeColumn({ id: 'c1', tableId: 't1', options: 0 })],
      't1',
      ['f1'],
      unnamed
    );

    expect(actions[1]).toEqual(
      changeColumnNotNullAction({ id: 'f1', tableId: 't1', value: true })
    );
  });
});
