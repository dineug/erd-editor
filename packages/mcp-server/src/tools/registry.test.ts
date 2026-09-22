import {
  createEngineContext,
  createPeerStore,
  defaultToWidth,
} from '@dineug/erd-editor/peer.js';
import { compositionActionsFlat } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { ToolError } from '@/tools/errors';
import { actionTools, toolByName } from '@/tools/registry';
import { runTool, type ToolRun } from '@/tools/run';

const context = createEngineContext({ toWidth: defaultToWidth });

type Peer = ReturnType<typeof createSeededPeer>;

const onPeer = <T>(peer: Peer, task: (peer: Peer) => T): T => {
  try {
    return task(peer);
  } finally {
    peer.destroy();
  }
};

const onSeed = <T>(task: (peer: Peer) => T): T =>
  onPeer(createSeededPeer(), task);

const onEmpty = <T>(task: (peer: Peer) => T): T =>
  onPeer(createPeerStore({ nickname: 'agent', presence: false }), task);

const run = (name: string): ToolRun =>
  onSeed(peer => runTool(peer, name, TOOL_SCENARIOS[name]));

const refusal = (name: string, args: Record<string, unknown>): ToolError =>
  onSeed(peer => {
    try {
      runTool(peer, name, args);
    } catch (error) {
      if (error instanceof ToolError) return error;
      throw error;
    }
    throw new Error(`${name} took arguments it should have refused`);
  });

/** The tools whose generator yields nothing once the value it sets already holds. */
const IDEMPOTENT = [
  'erd_set_column_primary_key',
  'erd_set_column_unique',
  'erd_set_column_not_null',
  'erd_set_column_auto_increment',
  'erd_set_index_unique',
  'erd_set_index_column_order',
  'erd_add_index_column',
  'erd_set_show',
];

describe('the registry', () => {
  it('names every tool once', () => {
    const names = actionTools.map(({ name }) => name);
    expect(names).toHaveLength(53);
    expect(new Set(names).size).toBe(names.length);
  });

  it('declares a reason for every atom, and one for every tool it keeps no undo entry for', () => {
    for (const tool of actionTools) {
      if (tool.kind === 'atom') expect(tool.atomReason).toBeTruthy();
      if (!tool.undoable) expect(tool.undoableReason).toBeTruthy();
      expect(tool.snapshotPaths.length).toBeGreaterThan(0);
      expect(tool.args.every(({ name }) => name !== 'path')).toBe(true);
    }
  });

  it('runs every tool on the seed inside the batch and history counts it declared', () => {
    for (const { name } of actionTools) {
      const outcome = run(name);
      expect([name, outcome.mismatch]).toEqual([name, undefined]);
      expect(outcome.tool).toBe(name);
    }
  });

  it('sends nothing the second time a tool sets a value the document already holds', () => {
    for (const name of IDEMPOTENT) {
      const counts = onSeed(peer => [
        runTool(peer, name, TOOL_SCENARIOS[name]).batches,
        runTool(peer, name, TOOL_SCENARIOS[name]).batches,
      ]);
      expect([name, counts]).toEqual([name, [1, 0]]);
    }
  });

  it('sorts nothing in a document with no table', () => {
    const outcome = onEmpty(peer => runTool(peer, 'erd_sort_tables', {}));
    expect(outcome.batches).toBe(0);
    expect(outcome.mismatch).toBeUndefined();
  });

  it('refuses the calls whose arguments contradict each other', () => {
    const scenario = (name: string) => TOOL_SCENARIOS[name];

    expect(
      refusal('erd_move_column', {
        ...scenario('erd_move_column'),
        targetColumnId: (scenario('erd_move_column') as any).columnId,
      }).message
    ).toBe('targetColumnId must name a different column than columnId');

    expect(
      refusal('erd_move_index_column', {
        ...scenario('erd_move_index_column'),
        targetIndexColumnId: (scenario('erd_move_index_column') as any)
          .indexColumnId,
      }).message
    ).toBe(
      'targetIndexColumnId must name a different index column than indexColumnId'
    );

    expect(
      refusal('erd_set_column_order', {
        columnType: 'columnName',
        targetColumnType: 'columnName',
      }).message
    ).toBe(
      'targetColumnType must name a different column part than columnType'
    );

    expect(
      refusal('erd_link_columns', {
        ...scenario('erd_link_columns'),
        endColumnIds: [SEED.orderId, SEED.orderNote],
      }).message
    ).toBe(
      'startColumnIds and endColumnIds must pair up, one end column for each start column'
    );

    expect(
      refusal('erd_resize_memo', {
        ...scenario('erd_resize_memo'),
        width: 1,
      }).message
    ).toMatch(/^width must be at least /);

    expect(
      refusal('erd_set_max_width_comment', { value: 5000 }).message
    ).toMatch(/^value must be -1 for no limit, /);
  });

  it('refuses an import whose text is empty or is not a document', () => {
    for (const name of [
      'erd_import_sql',
      'erd_import_graphql',
      'erd_import_dbml',
      'erd_import_aml',
    ]) {
      expect([name, refusal(name, { value: '   ' }).message]).toEqual([
        name,
        'value is empty, so nothing was imported',
      ]);
    }

    expect(refusal('erd_import_json', { value: '[]' }).message).toBe(
      'value must be a JSON object, an erd-editor document'
    );
    expect(refusal('erd_import_json', { value: '{' }).message).toMatch(
      /^value is not an erd-editor document: /
    );
    expect(
      onEmpty(peer => runTool(peer, 'erd_import_json', { value: '' }).batches)
    ).toBe(1);
  });
});

describe('the generators a tool adds read the state defensively', () => {
  /** What a tool's composition emits against a document that lacks its entity. */
  const emitOnEmpty = (name: string, args: Record<string, unknown>) =>
    onEmpty(peer =>
      compositionActionsFlat(peer.state, context, [
        ...toolByName.get(name)!.toActions(args),
      ])
    );

  it('recolors a table or a memo that is gone from an empty previous color', () => {
    const [table] = emitOnEmpty('erd_change_table_color', {
      tableId: 'gone',
      color: '#010203',
    });
    const [memo] = emitOnEmpty('erd_change_memo_color', {
      memoId: 'gone',
      color: '#010203',
    });

    expect(table.payload).toEqual({
      id: 'gone',
      color: '#010203',
      prevColor: '',
    });
    expect(memo.payload).toEqual({
      id: 'gone',
      color: '#010203',
      prevColor: '',
    });
  });

  it('yields nothing for an entity that is gone', () => {
    const gone: Array<[string, Record<string, unknown>]> = [
      [
        'erd_set_column_primary_key',
        { tableId: 'x', columnId: 'x', value: true },
      ],
      ['erd_resize_memo', { memoId: 'x', width: 300, height: 200 }],
      ['erd_change_index_name', { indexId: 'x', value: 'x' }],
      ['erd_set_index_unique', { indexId: 'x', value: true }],
      ['erd_add_index_column', { indexId: 'x', columnId: 'x' }],
      ['erd_remove_index_column', { indexId: 'x', indexColumnId: 'x' }],
      [
        'erd_set_index_column_order',
        { indexId: 'x', indexColumnId: 'x', orderType: 2 },
      ],
    ];

    for (const [name, args] of gone) {
      expect([name, emitOnEmpty(name, args)]).toEqual([name, []]);
    }
  });
});
