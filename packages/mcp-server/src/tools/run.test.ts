import { readDocument, toolByName } from '@dineug/erd-editor/agent.js';
import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  columnNamed,
  documentFromSql,
  SHOP_SQL,
  tableNamed,
} from '@/__test-utils__/documents';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { runTool } from '@/tools/run';

const SEED_VALUE = documentFromSql(SHOP_SQL);

const peers: PeerStore[] = [];

function peerOf(options: { readonly?: boolean } = {}): PeerStore {
  const peer = createPeerStore({
    nickname: 'agent',
    presence: false,
    ...options,
  });
  peer.setInitialValue(SEED_VALUE);
  peers.push(peer);
  return peer;
}

const probe = peerOf();
const users = tableNamed(
  JSON.parse(readDocument(probe.state, 'snapshot')),
  'users'
);
const SEED = { users: users.id, userEmail: columnNamed(users, 'email').id };

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function refusal(call: () => unknown): ToolError | PeerStoreError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError || error instanceof PeerStoreError) {
      return error;
    }
    throw error;
  }
  throw new Error('the call was not refused');
}

describe('a tool call over a peer store', () => {
  it('runs one tool as one dispatch and reports it under the tool name', () => {
    const peer = peerOf();

    const run = runTool(peer, 'erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(run).toEqual({
      tool: 'erd_change_table_name',
      actions: [expect.objectContaining({ type: 'table.changeName' })],
      createdIds: [],
      batches: 1,
      historyEntries: 1,
    });
    expect(peer.state.editor.focusTable).toMatchObject({
      tableId: SEED.users,
      focusType: 'tableName',
    });
  });

  it('focuses the column a column tool names', () => {
    const peer = peerOf();

    runTool(peer, 'erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userEmail,
      value: 'address',
    });

    expect(peer.state.editor.focusTable).toMatchObject({
      tableId: SEED.users,
      columnId: SEED.userEmail,
      focusType: 'columnName',
    });
  });

  it('reports a mismatch when the measured counts leave the declared range', () => {
    const peer = peerOf();
    const tool = toolByName.get('erd_change_table_name') as {
      expectedHistory: unknown;
    };
    const declared = tool.expectedHistory;
    tool.expectedHistory = { min: 2, max: 3 };

    try {
      const run = runTool(peer, 'erd_change_table_name', {
        tableId: SEED.users,
        value: 'members',
      });

      expect(run.mismatch).toEqual({
        expectedBatches: '1',
        expectedHistory: '2..3',
      });
    } finally {
      tool.expectedHistory = declared;
    }
  });
});

describe('tool call refusals', () => {
  it('names an unknown tool', () => {
    const error = refusal(() => runTool(peerOf(), 'erd_fly', {}));

    expect(error).toMatchObject({
      name: 'ToolError',
      code: ToolErrorCode.unknownTool,
      tool: 'erd_fly',
    });
    expect(error.message).toContain('erd_fly');
  });

  it('refuses bad arguments and a dead id before anything is dispatched', () => {
    const peer = peerOf();
    const before = peer.value;

    const missing = refusal(() => runTool(peer, 'erd_change_table_name', {}));
    const dead = refusal(() =>
      runTool(peer, 'erd_change_table_name', { tableId: 'gone', value: 'x' })
    );

    expect(missing.code).toBe(ToolErrorCode.invalidArgs);
    expect(dead.code).toBe(ToolErrorCode.notFound);
    expect(peer.value).toBe(before);
  });

  it('refuses an edit while readonly, and runs it once the flag is off', () => {
    const peer = peerOf({ readonly: true });

    const error = refusal(() => runTool(peer, 'erd_add_table', {}));
    expect(error).toMatchObject({
      name: 'PeerStoreError',
      code: PeerStoreErrorCode.readonly,
      operation: 'erd_add_table',
    });
    expect(error.message).toBe('the document is readonly, so no edit was made');

    peer.setReadonly(false);
    expect(runTool(peer, 'erd_add_table', {}).createdIds).toHaveLength(1);
  });

  it('refuses every call once the store is destroyed', () => {
    const peer = peerOf();
    peer.destroy();

    const error = refusal(() => runTool(peer, 'erd_add_table', {}));

    expect(error).toMatchObject({
      name: 'PeerStoreError',
      code: PeerStoreErrorCode.destroyed,
      operation: 'erd_add_table',
    });
    expect(error.message).toBe(
      'this document session was closed; open the document again'
    );
  });

  it('refuses in the order destroyed, unknown tool, readonly, arguments', () => {
    const readonly = peerOf({ readonly: true });
    const closed = peerOf({ readonly: true });
    closed.destroy();

    expect(refusal(() => runTool(closed, 'erd_fly')).code).toBe(
      PeerStoreErrorCode.destroyed
    );
    expect(refusal(() => runTool(readonly, 'erd_fly')).code).toBe(
      ToolErrorCode.unknownTool
    );
    expect(
      refusal(() => runTool(readonly, 'erd_change_table_name', {})).code
    ).toBe(PeerStoreErrorCode.readonly);
  });
});
