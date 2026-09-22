// @vitest-environment node

import { compositionActionsFlat } from '@dineug/r-html';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { createAgentPeer } from '@/agent/peer';
import { toolByName } from '@/agent/registry';
import { defaultToWidth } from '@/agent/toWidth';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { OrderType, Show } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';

const context = createEngineContext({ toWidth: defaultToWidth });
const empty = createAgentPeer({ nickname: 'agent', presence: false });
empty.setInitialValue('');

afterAll(() => empty.destroy());

/** What a tool's composition emits against a document that lacks its entity. */
const emitOnEmpty = (name: string, args: Record<string, unknown>) =>
  compositionActionsFlat(empty.state, context, [
    ...toolByName.get(name)!.toActions(args),
  ]);

describe('the generators the tools add read the state defensively', () => {
  it('recolors from an empty previous color when the table is gone', () => {
    const [action] = emitOnEmpty('erd_change_table_color', {
      tableId: 'gone',
      color: '#010203',
    });

    expect(action.payload).toEqual({
      id: 'gone',
      color: '#010203',
      prevColor: '',
    });
  });

  it('sets no flag on a column that is gone', () => {
    for (const name of [
      'erd_set_column_primary_key',
      'erd_set_column_unique',
      'erd_set_column_not_null',
      'erd_set_column_auto_increment',
    ]) {
      expect(
        emitOnEmpty(name, { tableId: 'gone', columnId: 'gone', value: true }),
        name
      ).toEqual([]);
    }
  });

  it('sets a flag that changes and skips one that already holds', () => {
    const peer = createAgentPeer({ nickname: 'agent', presence: false });
    peer.setInitialValue(createSeedValue());
    const flag = (columnId: string, value: boolean) =>
      compositionActionsFlat(peer.state, context, [
        ...toolByName.get('erd_set_column_unique')!.toActions({
          tableId: SEED.users,
          columnId,
          value,
        }),
      ]).map(({ type }) => type);

    expect(flag(SEED.userName, true)).toEqual(['column.changeUnique']);
    expect(flag(SEED.userName, false)).toEqual([]);

    peer.destroy();
  });
});

describe('the 3b generators read the state defensively', () => {
  it('recolors a memo that is gone from an empty previous color', () => {
    const [action] = emitOnEmpty('erd_change_memo_color', {
      memoId: 'gone',
      color: '#010203',
    });

    expect(action.payload).toEqual({
      id: 'gone',
      color: '#010203',
      prevColor: '',
    });
  });

  it.each([
    ['erd_resize_memo', { memoId: 'gone', width: 300, height: 200 }],
    ['erd_change_index_name', { indexId: 'gone', value: 'x' }],
    ['erd_set_index_unique', { indexId: 'gone', value: true }],
    ['erd_add_index_column', { indexId: 'gone', columnId: 'gone' }],
    ['erd_remove_index_column', { indexId: 'gone', indexColumnId: 'gone' }],
    [
      'erd_set_index_column_order',
      { indexId: 'gone', indexColumnId: 'gone', orderType: 2 },
    ],
  ])('%s yields nothing for an entity that is gone', (name, args) => {
    expect(emitOnEmpty(name, args)).toEqual([]);
  });
});

describe('the set tools skip a value that already holds', () => {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  peer.setInitialValue(createSeedValue());

  afterAll(() => peer.destroy());

  const emit = (name: string, args: Record<string, unknown>) =>
    compositionActionsFlat(peer.state, context, [
      ...toolByName.get(name)!.toActions(args),
    ]).map(({ type }) => type);

  it.each([
    [
      'erd_set_show',
      { show: Show.columnUnique, value: true },
      { show: Show.columnUnique, value: false },
      'settings.changeShow',
    ],
    [
      'erd_set_index_unique',
      { indexId: SEED.index, value: true },
      { indexId: SEED.index, value: false },
      'index.changeUnique',
    ],
    [
      'erd_set_index_column_order',
      {
        indexId: SEED.index,
        indexColumnId: SEED.indexColumn,
        orderType: OrderType.DESC,
      },
      {
        indexId: SEED.index,
        indexColumnId: SEED.indexColumn,
        orderType: OrderType.ASC,
      },
      'indexColumn.changeOrderType',
    ],
    [
      'erd_add_index_column',
      { indexId: SEED.index, columnId: SEED.orderId },
      { indexId: SEED.index, columnId: SEED.orderNote },
      'indexColumn.add',
    ],
  ])('%s sends a change and skips what holds', (name, changes, holds, type) => {
    expect(emit(name, changes)).toEqual([type]);
    expect(emit(name, holds)).toEqual([]);
  });
});

describe('cross argument rules', () => {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  peer.setInitialValue(createSeedValue());

  afterAll(() => peer.destroy());

  const refused = async (name: string, args: Record<string, unknown>) => {
    const error = (await peer
      .runTool(name, args)
      .catch((error: unknown) => error)) as AgentToolError;

    expect(error).toBeInstanceOf(AgentToolError);
    expect(error.code, name).toBe(AgentToolErrorCode.invalidArgs);
    return error.message;
  };

  it('refuses an index column moved onto itself', async () => {
    expect(
      await refused('erd_move_index_column', {
        indexId: SEED.index,
        indexColumnId: SEED.indexColumn,
        targetIndexColumnId: SEED.indexColumn,
      })
    ).toContain('targetIndexColumnId');
  });

  it('refuses a column part moved onto itself', async () => {
    expect(
      await refused('erd_set_column_order', {
        columnType: 'columnName',
        targetColumnType: 'columnName',
      })
    ).toContain('targetColumnType');
  });

  it('takes a comment width of -1 or inside the range, and nothing else', async () => {
    for (const value of [-2, 59, 201]) {
      expect(await refused('erd_set_max_width_comment', { value })).toBe(
        'value must be -1 for no limit, or from 60 to 200'
      );
    }
    for (const value of [-1, 60, 200]) {
      const run = await peer.runTool('erd_set_max_width_comment', { value });

      expect(run.batches, String(value)).toBe(1);
      expect(peer.state.settings.maxWidthComment).toBe(value);
    }
  });

  it('refuses a memo smaller than the resize handles allow', async () => {
    for (const [width, height] of [
      [MEMO_MIN_WIDTH - 1, 200],
      [300, MEMO_MIN_HEIGHT - 1],
    ]) {
      expect(
        await refused('erd_resize_memo', { memoId: SEED.memo, width, height })
      ).toBe(
        `width must be at least ${MEMO_MIN_WIDTH} and height at least ${MEMO_MIN_HEIGHT}`
      );
    }
  });

  it('refuses to move a column onto itself', async () => {
    const peer = createAgentPeer({ nickname: 'agent', presence: false });
    peer.setInitialValue(createSeedValue());

    const error = await peer
      .runTool('erd_move_column', {
        tableId: SEED.orders,
        columnId: SEED.orderNote,
        targetColumnId: SEED.orderNote,
      })
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(AgentToolError);
    expect((error as AgentToolError).code).toBe(AgentToolErrorCode.invalidArgs);
    expect((error as AgentToolError).message).toContain('targetColumnId');

    peer.destroy();
  });
});
