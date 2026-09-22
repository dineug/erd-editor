// @vitest-environment node

import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { createAgentPeer } from '@/agent/peer';
import type { ToolArg } from '@/agent/registry';
import { validateToolArgs } from '@/agent/validate';

const peer = createAgentPeer({ nickname: 'agent', presence: false });
peer.setInitialValue(createSeedValue());
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

function refusal(run: () => unknown): AgentToolError {
  try {
    run();
  } catch (error) {
    if (error instanceof AgentToolError) return error;
    throw error;
  }
  throw new Error('the arguments were accepted');
}

describe('argument shapes', () => {
  it('accepts no arguments as an empty object, and nothing else that is not an object', () => {
    expect(validateToolArgs(tool([]), undefined, state)).toEqual({});
    expect(validateToolArgs(tool([]), null, state)).toEqual({});

    for (const bad of [[], 'x', 3]) {
      const error = refusal(() => validateToolArgs(tool([]), bad, state));
      expect(error.code).toBe(AgentToolErrorCode.invalidArgs);
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
    ).toBe(AgentToolErrorCode.invalidArgs);
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
        { tableId: SEED.users, columnIds: [SEED.userId, SEED.userId] },
        state
      )
    ).toEqual({ tableId: SEED.users, columnIds: [SEED.userId] });
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
    ['column', SEED.userName],
    ['indexColumn', SEED.indexColumn],
  ] as const)('finds a live %s by id alone', (entity, id) => {
    expect(live(entity, id)()).toEqual({ id });
    expect(refusal(live(entity, 'gone')).code).toBe(
      AgentToolErrorCode.notFound
    );
  });

  it('finds a column only in the table its parent argument names', () => {
    const inUsers = {
      name: 'tableId',
      entity: 'table',
      id: SEED.users,
    } as const;

    expect(live('column', SEED.userName, inUsers)()).toEqual({
      tableId: SEED.users,
      id: SEED.userName,
    });

    const error = refusal(live('column', SEED.orderNote, inUsers));
    expect(error.code).toBe(AgentToolErrorCode.notFound);
    expect(error.message).toBe(
      'id orders_note names no live column in tableId users; read the document for current ids'
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
      AgentToolErrorCode.notFound
    );
  });

  it('finds a column under an index only in the table the index belongs to', () => {
    const inIndex = {
      name: 'indexId',
      entity: 'index',
      id: SEED.index,
    } as const;

    expect(live('column', SEED.orderId, inIndex)()).toEqual({
      indexId: SEED.index,
      id: SEED.orderId,
    });

    const error = refusal(live('column', SEED.userName, inIndex));
    expect(error.code).toBe(AgentToolErrorCode.notFound);
    expect(error.message).toBe(
      'id users_name names no live column in the table of indexId orders_note_index; read the document for current ids'
    );
    expect(
      refusal(live('column', SEED.orderId, { ...inIndex, id: 'gone' })).message
    ).toContain('indexId gone names no live index');
  });

  it('checks the parent before the child, so a dead table is the one reported', () => {
    const error = refusal(
      live('column', SEED.userName, {
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
        { id: SEED.userName, tableId: 'gone' },
        state
      )
    );

    expect(error.message).toContain('tableId gone names no live table');
  });

  it('treats a removed entity as gone although its record stays behind', async () => {
    const other = createAgentPeer({ nickname: 'agent', presence: false });
    other.setInitialValue(createSeedValue());
    await other.runTool('erd_remove_table', { tableId: SEED.empty });

    expect(other.state.collections.tableEntities[SEED.empty]).toBeDefined();
    expect(
      refusal(() =>
        validateToolArgs(
          tool([arg('id', { type: 'entityId', entity: 'table' })]),
          { id: SEED.empty },
          other.state
        )
      ).code
    ).toBe(AgentToolErrorCode.notFound);

    other.destroy();
  });
});
