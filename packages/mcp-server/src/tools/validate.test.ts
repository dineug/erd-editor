import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import {
  columnNamed,
  documentFromSql,
  SHOP_SQL,
  tableNamed,
} from '@/__test-utils__/documents';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { readDocument } from '@/tools/read';
import type { ToolArg } from '@/tools/registry';
import { runTool } from '@/tools/run';
import { validateToolArgs } from '@/tools/validate';

const peer = createPeerStore({ nickname: 'agent', presence: false });
peer.setInitialValue(documentFromSql(SHOP_SQL));

const imported = JSON.parse(readDocument(peer.state, 'snapshot'));
const users = tableNamed(imported, 'users');
const orders = tableNamed(imported, 'orders');
const [memoId] = runTool(peer, 'erd_add_memo', {}).createdIds;
const [indexId] = runTool(peer, 'erd_add_index', {
  tableId: orders.id,
}).createdIds;
const [indexColumnId] = runTool(peer, 'erd_add_index_column', {
  indexId,
  columnId: columnNamed(orders, 'total').id,
}).createdIds;

/** The ids the liveness cases name, all of them live in the seeded document. */
const SEED = {
  users: users.id,
  orders: orders.id,
  userEmail: columnNamed(users, 'email').id,
  orderTotal: columnNamed(orders, 'total').id,
  relationship: imported.relationships[0].id,
  index: indexId,
  indexColumn: indexColumnId,
  memo: memoId,
};

const state = peer.state;

afterAll(() => peer.destroy());

const tool = (
  args: ToolArg[],
  refine?: (values: any) => string | undefined
) => ({
  name: 'erd_test',
  args,
  refine,
});

const arg = (
  name: string,
  kind: ToolArg['kind'],
  required = true
): ToolArg => ({ name, kind, required });

function refusal(run: () => unknown): ToolError {
  try {
    run();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the arguments were accepted');
}

describe('argument shapes', () => {
  it('accepts no arguments as an empty object, and nothing else that is not an object', () => {
    expect(validateToolArgs(tool([]), undefined, state)).toEqual({});
    expect(validateToolArgs(tool([]), null, state)).toEqual({});

    for (const bad of [[], 'x', 3, new Date(), new Map(), new (class {})()]) {
      const error = refusal(() => validateToolArgs(tool([]), bad, state));
      expect(error.code).toBe(ToolErrorCode.invalidArgs);
    }
    expect(
      refusal(() => validateToolArgs(tool([]), [], state)).message
    ).toContain('an array');
  });

  it('names an argument the tool does not take, and what it does take', () => {
    const none = refusal(() => validateToolArgs(tool([]), { x: 1 }, state));
    const some = refusal(() =>
      validateToolArgs(tool([arg('a', { type: 'string' })]), { b: 1 }, state)
    );

    expect(none.message).toContain('accepted: none');
    expect(some.message).toContain('unexpected argument b; accepted: a');
  });

  it('requires a required argument and lets an optional one be left out', () => {
    const args = [
      arg('a', { type: 'string' }),
      arg('b', { type: 'string' }, false),
    ];

    expect(validateToolArgs(tool(args), { a: 'x' }, state)).toEqual({ a: 'x' });
    expect(refusal(() => validateToolArgs(tool(args), {}, state)).message).toBe(
      'a is required'
    );
  });

  it.each([
    ['string', { type: 'string' }, 'ok', 3],
    ['number', { type: 'number' }, 1.5, Number.NaN],
    ['integer', { type: 'integer' }, 2, 2.5],
    ['boolean', { type: 'boolean' }, false, 'false'],
  ] as const)('checks a %s', (_, kind, good, bad) => {
    const args = [arg('v', kind)];

    expect(validateToolArgs(tool(args), { v: good }, state)).toEqual({
      v: good,
    });
    expect(
      refusal(() => validateToolArgs(tool(args), { v: bad }, state)).code
    ).toBe(ToolErrorCode.invalidArgs);
  });

  it('says what it got in place of a string', () => {
    const args = [arg('v', { type: 'string' })];

    expect(
      refusal(() => validateToolArgs(tool(args), { v: null }, state)).message
    ).toBe('v must be a string, got null');
    expect(
      refusal(() => validateToolArgs(tool(args), { v: ['a'] }, state)).message
    ).toBe('v must be a string, got an array');
    expect(
      refusal(() => validateToolArgs(tool(args), { v: 1 }, state)).message
    ).toBe('v must be a string, got number');
  });

  it('takes an enum by name and hands on the value the name maps to', () => {
    const args = [arg('type', { type: 'enum', values: { One: 1, Many: 2 } })];

    expect(validateToolArgs(tool(args), { type: 'Many' }, state)).toEqual({
      type: 2,
    });
    expect(
      refusal(() => validateToolArgs(tool(args), { type: 2 }, state)).message
    ).toBe('type must be one of One, Many');
  });

  it('wants an id to be a non-empty string and a list to be a non-empty list of them', () => {
    const one = [arg('tableId', { type: 'entityId', entity: 'table' })];
    const many = [
      arg('tableId', { type: 'entityId', entity: 'table' }),
      arg('columnIds', {
        type: 'entityIdList',
        entity: 'column',
        parentArg: 'tableId',
      }),
    ];

    expect(
      refusal(() => validateToolArgs(tool(one), { tableId: '' }, state)).message
    ).toBe('tableId must be a table id');
    for (const columnIds of [[], 'users_id', [1], ['']]) {
      expect(
        refusal(() =>
          validateToolArgs(
            tool(many),
            { tableId: SEED.users, columnIds },
            state
          )
        ).message
      ).toBe('columnIds must be a non-empty list of column ids');
    }
    expect(
      validateToolArgs(
        tool(many),
        { tableId: SEED.users, columnIds: [SEED.userEmail, SEED.userEmail] },
        state
      )
    ).toEqual({ tableId: SEED.users, columnIds: [SEED.userEmail] });
  });

  it('refuses the call a cross argument rule turns down', () => {
    const args = [arg('a', { type: 'string' }), arg('b', { type: 'string' })];
    const sameRefused = tool(args, ({ a, b }) =>
      a === b ? 'a and b must differ' : undefined
    );

    expect(validateToolArgs(sameRefused, { a: 'x', b: 'y' }, state)).toEqual({
      a: 'x',
      b: 'y',
    });
    expect(
      refusal(() => validateToolArgs(sameRefused, { a: 'x', b: 'x' }, state))
        .message
    ).toBe('a and b must differ');
  });
});

describe('entity liveness', () => {
  const live = (
    entity:
      | 'table'
      | 'relationship'
      | 'index'
      | 'memo'
      | 'column'
      | 'indexColumn',
    id: string,
    parent?: { name: string; entity: 'table' | 'index'; id: string }
  ) => {
    const args: ToolArg[] = parent
      ? [
          arg(parent.name, { type: 'entityId', entity: parent.entity }),
          arg('id', { type: 'entityId', entity, parentArg: parent.name }),
        ]
      : [arg('id', { type: 'entityId', entity })];
    const values = parent ? { [parent.name]: parent.id, id } : { id };

    return () => validateToolArgs(tool(args), values, state);
  };

  it.each([
    ['table', SEED.users],
    ['relationship', SEED.relationship],
    ['index', SEED.index],
    ['memo', SEED.memo],
    ['column', SEED.userEmail],
    ['indexColumn', SEED.indexColumn],
  ] as const)('finds a live %s by id alone', (entity, id) => {
    expect(live(entity, id)()).toEqual({ id });
    expect(refusal(live(entity, 'gone')).code).toBe(ToolErrorCode.notFound);
  });

  it('finds a column only in the table its parent argument names', () => {
    const inUsers = {
      name: 'tableId',
      entity: 'table',
      id: SEED.users,
    } as const;

    expect(live('column', SEED.userEmail, inUsers)()).toEqual({
      tableId: SEED.users,
      id: SEED.userEmail,
    });

    const error = refusal(live('column', SEED.orderTotal, inUsers));
    expect(error.code).toBe(ToolErrorCode.notFound);
    expect(error.message).toBe(
      `id ${SEED.orderTotal} names no live column in tableId ${SEED.users}; read the document for current ids`
    );
  });

  it('finds an index column only in the index its parent argument names', () => {
    const inIndex = {
      name: 'indexId',
      entity: 'index',
      id: SEED.index,
    } as const;

    expect(live('indexColumn', SEED.indexColumn, inIndex)()).toEqual({
      indexId: SEED.index,
      id: SEED.indexColumn,
    });
    expect(refusal(live('indexColumn', 'gone', inIndex)).code).toBe(
      ToolErrorCode.notFound
    );
  });

  it('finds a column under an index only in the table the index belongs to', () => {
    const inIndex = {
      name: 'indexId',
      entity: 'index',
      id: SEED.index,
    } as const;

    expect(live('column', SEED.orderTotal, inIndex)()).toEqual({
      indexId: SEED.index,
      id: SEED.orderTotal,
    });

    const error = refusal(live('column', SEED.userEmail, inIndex));
    expect(error.code).toBe(ToolErrorCode.notFound);
    expect(error.message).toBe(
      `id ${SEED.userEmail} names no live column in the table of indexId ${SEED.index}; read the document for current ids`
    );
    expect(
      refusal(live('column', SEED.orderTotal, { ...inIndex, id: 'gone' }))
        .message
    ).toContain('indexId gone names no live index');
  });

  it('checks the parent before the child, so a dead table is the one reported', () => {
    const error = refusal(
      live('column', SEED.userEmail, {
        name: 'tableId',
        entity: 'table',
        id: 'gone',
      })
    );

    expect(error.message).toContain('tableId gone names no live table');
  });

  it('checks the parent first even when the tool declares the child first', () => {
    const childFirst = tool([
      arg('id', { type: 'entityId', entity: 'column', parentArg: 'tableId' }),
      arg('tableId', { type: 'entityId', entity: 'table' }),
    ]);

    const error = refusal(() =>
      validateToolArgs(
        childFirst,
        { id: SEED.userEmail, tableId: 'gone' },
        state
      )
    );

    expect(error.message).toContain('tableId gone names no live table');
  });

  it('treats a removed entity as gone although its record stays behind', () => {
    const other = createPeerStore({ nickname: 'agent', presence: false });
    other.setInitialValue(documentFromSql(SHOP_SQL));
    const removed = tableNamed(
      JSON.parse(readDocument(other.state, 'snapshot')),
      'orders'
    ).id;
    runTool(other, 'erd_remove_table', { tableId: removed });

    expect(other.state.collections.tableEntities[removed]).toBeDefined();
    expect(
      refusal(() =>
        validateToolArgs(
          tool([arg('id', { type: 'entityId', entity: 'table' })]),
          { id: removed },
          other.state
        )
      ).code
    ).toBe(ToolErrorCode.notFound);

    other.destroy();
  });
});
