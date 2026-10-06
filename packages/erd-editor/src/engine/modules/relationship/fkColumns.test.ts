import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';
import {
  isSingleWord,
  prefixKeyName,
  toForeignKeyActions,
  toForeignKeyNames,
  toNameKey,
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

const unnamed = {
  startTableName: '',
  endColumnNames: [],
  database: Database.MySQL,
};

describe('isSingleWord', () => {
  it('takes a name of letters and digits in one case run as one word', () => {
    for (const name of ['id', 'code', 'uuid', 'ID', 'Id', 'UUID', '아이디']) {
      expect(isSingleWord(name), name).toBe(true);
    }
  });

  it('lets digits join the word they sit in', () => {
    for (const name of [
      'id2',
      'ID2',
      'uuid4',
      '2fa',
      'SHA256',
      'Base64',
      'md5sum',
    ]) {
      expect(isSingleWord(name), name).toBe(true);
    }
  });

  it('reads case across digits, so an acronym running into lower case splits', () => {
    for (const name of ['ID2code', 'SHA256sum']) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('takes a compound in one case with no separator as one word', () => {
    for (const name of ['memberid', 'userid', 'USERID', 'MEMBERID']) {
      expect(isSingleWord(name), name).toBe(true);
    }
  });

  it('splits words at an underscore or any other character but a letter or digit', () => {
    for (const name of [
      'member_id',
      'user_id',
      'order_no',
      'id_2',
      '_id',
      'order no',
      'order-no',
      'order.no',
    ]) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('splits words where the case steps up, or an acronym runs into a word', () => {
    for (const name of [
      'userId',
      'UserID',
      'tenantCode',
      'IDCard',
      'UUIDValue',
      'id2Code',
      'ID2Code',
    ]) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('splits a plural or versioned acronym as camelCase does, but not a capitalized plural', () => {
    for (const name of ['IDs', 'UUIDs', 'PKs', 'UUIDv4', 'IPv6', 'iD']) {
      expect(isSingleWord(name), name).toBe(false);
    }
    expect(isSingleWord('Ids')).toBe(true);
  });

  it('finds no case step inside a script without case, so only a separator splits it', () => {
    for (const name of ['회원아이디', 'ユーザー', '人々', '用户']) {
      expect(isSingleWord(name), name).toBe(true);
    }
    expect(isSingleWord('회원_아이디')).toBe(false);
  });

  it('splits where a letter without case meets a letter with case, either way', () => {
    for (const name of [
      '아이디ID',
      '회원ID',
      '회원Id',
      'ユーザーID',
      '人々ID',
      '用户ID',
      'IDカード',
      '회원id',
      'id회원',
    ]) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('reads that meeting across digits and marks, as it reads case', () => {
    for (const name of ['회원2ID', 'ID2カード', 'आईडीID']) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('lets a combining mark join the word it sits in, spacing or not', () => {
    for (const name of [
      'आईडी',
      'ไอดี',
      'cafe\u0301',
      'E\u0301cole',
      'E\u0301TAT',
    ]) {
      expect(isSingleWord(name), name).toBe(true);
    }
  });

  it('reads case across a combining mark, as across a digit', () => {
    for (const name of ['cafe\u0301Id', 'ide\u0301Card', 'CAFE\u0301Name']) {
      expect(isSingleWord(name), name).toBe(false);
    }
  });

  it('takes no empty name as a word', () => {
    expect(isSingleWord('')).toBe(false);
  });
});

describe('prefixKeyName', () => {
  it('prefixes a single word key with the table name and an underscore', () => {
    expect(prefixKeyName('users', 'id')).toBe('users_id');
    expect(prefixKeyName('public.users', 'id')).toBe('public.users_id');
    expect(prefixKeyName(' users ', ' ID ')).toBe('users_ID');
  });

  it('keeps a key of several words, one equal to the table name, or any key of a blank table', () => {
    expect(prefixKeyName('users', 'user_id')).toBe('user_id');
    expect(prefixKeyName('user', 'User')).toBe('User');
    expect(prefixKeyName('  ', 'id')).toBe('id');
  });

  it('names no column it numbers, which toForeignKeyNames does against the taken names', () => {
    expect(prefixKeyName('users', 'id')).toBe(
      toForeignKeyNames('users', ['id'], [])[0]
    );
    expect(toForeignKeyNames('users', ['id'], ['users_id'])).toEqual([
      'users_id_2',
    ]);
  });
});

describe('toNameKey', () => {
  it('compares names trimmed and without case', () => {
    expect(toNameKey('  User_ID ')).toBe('user_id');
    expect(toNameKey('')).toBe('');
  });
});

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
    expect(toForeignKeyNames('public.users', ['id'], [])).toEqual([
      'public.users_id',
    ]);
  });

  it('prefixes users.id, keeps member_id, userId and user_id, numbers a second users_id', () => {
    expect(toForeignKeyNames('users', ['id'], [])).toEqual(['users_id']);
    expect(toForeignKeyNames('members', ['member_id'], [])).toEqual([
      'member_id',
    ]);
    expect(toForeignKeyNames('user', ['userId'], [])).toEqual(['userId']);
    expect(toForeignKeyNames('users', ['user_id'], [])).toEqual(['user_id']);
    expect(toForeignKeyNames('users', ['id'], ['users_id'])).toEqual([
      'users_id_2',
    ]);
  });

  it('prefixes a single word key, acronyms and digits included', () => {
    expect(
      ['ID', 'Id', 'uuid', 'UUID', 'id2', 'ID2'].map(
        key => toForeignKeyNames('users', [key], [])[0]
      )
    ).toEqual([
      'users_ID',
      'users_Id',
      'users_uuid',
      'users_UUID',
      'users_id2',
      'users_ID2',
    ]);
  });

  it('keeps a key name of several words as it is, whatever table it names', () => {
    for (const key of [
      'member_id',
      'user_id',
      'USER_CODE',
      'order_no',
      'userId',
      'UserID',
      'tenantCode',
      'IDCard',
      'order no',
      'order-no',
      'ID2code',
      'SHA256sum',
    ]) {
      expect(toForeignKeyNames('user', [key], []), key).toEqual([key]);
    }
  });

  it('prefixes a compound written in one case, which has no break to keep', () => {
    expect(toForeignKeyNames('members', ['memberid'], [])).toEqual([
      'members_memberid',
    ]);
    expect(toForeignKeyNames('users', ['USERID'], [])).toEqual([
      'users_USERID',
    ]);
    expect(toForeignKeyNames('files', ['md5sum'], [])).toEqual([
      'files_md5sum',
    ]);
  });

  it('keeps a plural or versioned acronym and prefixes a capitalized plural', () => {
    expect(
      ['IDs', 'UUIDv4', 'Ids'].map(
        key => toForeignKeyNames('users', [key], [])[0]
      )
    ).toEqual(['IDs', 'UUIDv4', 'users_Ids']);
  });

  it('keeps a key with a leading underscore, numbered against the same name in the child', () => {
    expect(toForeignKeyNames('users', ['_id'], [])).toEqual(['_id']);
    expect(toForeignKeyNames('users', ['_id'], ['_id'])).toEqual(['_id_2']);
  });

  it('prefixes a key in a script without case unless a separator splits it', () => {
    expect(toForeignKeyNames('회원', ['아이디'], [])).toEqual(['회원_아이디']);
    expect(toForeignKeyNames('회원', ['회원_아이디'], [])).toEqual([
      '회원_아이디',
    ]);
  });

  it('keeps a key where a script without case meets one with case', () => {
    expect(toForeignKeyNames('members', ['회원ID'], [])).toEqual(['회원ID']);
    expect(
      ['ユーザーID', '用户ID', 'IDカード'].map(
        key => toForeignKeyNames('users', [key], [])[0]
      )
    ).toEqual(['ユーザーID', '用户ID', 'IDカード']);
    expect(toForeignKeyNames('members', ['회원ID'], ['회원ID'])).toEqual([
      '회원ID_2',
    ]);
  });

  it('prefixes a single word key written with combining marks, and keeps one they split', () => {
    expect(
      ['आईडी', 'ไอดี', 'cafe\u0301', 'cafe\u0301Id'].map(
        key => toForeignKeyNames('users', [key], [])[0]
      )
    ).toEqual(['users_आईडी', 'users_ไอดี', 'users_cafe\u0301', 'cafe\u0301Id']);
  });

  it('keeps a single word key equal to the table name, without case', () => {
    expect(toForeignKeyNames('user', ['user'], [])).toEqual(['user']);
    expect(toForeignKeyNames('user', ['USER'], [])).toEqual(['USER']);
  });

  it('prefixes a single word key that holds the table name, which only an equal name escapes', () => {
    expect(toForeignKeyNames('user', ['username'], [])).toEqual([
      'user_username',
    ]);
    expect(toForeignKeyNames('user', ['userid'], [])).toEqual(['user_userid']);
    expect(toForeignKeyNames('회원', ['회원번호'], [])).toEqual([
      '회원_회원번호',
    ]);
  });

  it('tests each member of a composite key on its own', () => {
    expect(toForeignKeyNames('orders', ['tenant_id', 'id'], [])).toEqual([
      'tenant_id',
      'orders_id',
    ]);
    expect(toForeignKeyNames('orders', ['orderNo', 'ID'], [])).toEqual([
      'orderNo',
      'orders_ID',
    ]);
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

  it('numbers a kept key name the end table already holds', () => {
    expect(toForeignKeyNames('user', ['user_id'], ['user_id'])).toEqual([
      'user_id_2',
    ]);
    expect(toForeignKeyNames('members', ['member_id'], ['member_id'])).toEqual([
      'member_id_2',
    ]);
  });

  it('keeps the composite members apart from each other', () => {
    expect(toForeignKeyNames('user', ['id', 'ID'], [])).toEqual([
      'user_id',
      'user_ID_2',
    ]);
    expect(toForeignKeyNames('user', ['id', 'id_2'], ['user_id'])).toEqual([
      'user_id_2',
      'id_2',
    ]);
    expect(toForeignKeyNames('user', ['id', 'user_id_2'], ['user_id'])).toEqual(
      ['user_id_3', 'user_id_2']
    );
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

  it('lets a member whose name is free keep it before another is numbered onto it', () => {
    expect(
      toForeignKeyNames('friends', ['member_id', 'member_id_2'], ['member_id'])
    ).toEqual(['member_id_3', 'member_id_2']);
    expect(
      toForeignKeyNames('', ['id', 'id_2', 'id_3'], ['id', 'id_2'])
    ).toEqual(['id_4', 'id_2_2', 'id_3']);
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
        database: Database.MySQL,
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
      { ...unnamed, endColumnNames: ['id'] }
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

  it('types the copy of a serial key with the integer it stores', () => {
    const startColumns = [
      makeColumn({ id: 'c1', tableId: 't1', name: 'id', dataType: 'serial' }),
      makeColumn({ id: 'c2', tableId: 't1', name: 'no', dataType: 'SERIAL8' }),
      makeColumn({
        id: 'c3',
        tableId: 't1',
        name: 'at',
        dataType: 'serial(4)',
      }),
    ];
    const dataTypes = (database: number) =>
      toForeignKeyActions(startColumns, 't2', ['f1', 'f2', 'f3'], {
        ...unnamed,
        database,
      })
        .filter(({ type }) => type === changeColumnDataTypeAction.type)
        .map(({ payload }) => payload.value);

    expect(dataTypes(Database.PostgreSQL)).toEqual([
      'integer',
      'BIGINT',
      'serial(4)',
    ]);
    expect(dataTypes(Database.MySQL)).toEqual([
      'bigint unsigned',
      'BIGINT',
      'serial(4)',
    ]);
    expect(dataTypes(Database.SQLite)).toEqual([
      'serial',
      'BIGINT',
      'serial(4)',
    ]);
  });
});
