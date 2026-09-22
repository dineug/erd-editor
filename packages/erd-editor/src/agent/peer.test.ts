// @vitest-environment node

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createSeedValue, SEED, settle } from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { toolByName } from '@/agent/registry';

const peers: AgentPeer[] = [];

function peerOf(options: Partial<Parameters<typeof createAgentPeer>[0]> = {}) {
  const peer = createAgentPeer({
    nickname: 'agent',
    presence: false,
    ...options,
  });
  peers.push(peer);
  return peer;
}

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
  vi.restoreAllMocks();
});

async function refusal(call: () => unknown): Promise<AgentToolError> {
  try {
    await call();
  } catch (error) {
    if (error instanceof AgentToolError) return error;
    throw error;
  }
  throw new Error('the call was not refused');
}

describe('agent peer tool calls over the peer store', () => {
  it('runs one tool as one dispatch and reports it under the tool name', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    const run = await peer.runTool('erd_change_table_name', {
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

  it('focuses the column a column tool names', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    await peer.runTool('erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'full_name',
    });

    expect(peer.state.editor.focusTable).toMatchObject({
      tableId: SEED.users,
      columnId: SEED.userName,
      focusType: 'columnName',
    });
  });

  it('reports a mismatch when the measured counts leave the declared range', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    const tool = toolByName.get('erd_change_table_name') as {
      expectedHistory: unknown;
    };
    const declared = tool.expectedHistory;
    tool.expectedHistory = { min: 2, max: 3 };

    try {
      const run = await peer.runTool('erd_change_table_name', {
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

  it('names the tool an undo or redo reverted, and the calls it passed over', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });
    await peer.runTool('erd_set_column_not_null', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: true,
    });

    expect(await peer.undo()).toEqual({
      toolName: 'erd_change_table_name',
      entries: 1,
      skipped: ['erd_set_column_not_null'],
    });
    expect(await peer.redo()).toEqual({
      toolName: 'erd_change_table_name',
      entries: 1,
      skipped: [],
    });
    expect(await peer.redo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: [],
    });
  });

  it('reads the document in each format while open', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    await settle();

    expect(JSON.parse(peer.read('json'))).toEqual(JSON.parse(peer.value));
    expect(peer.read('sql', 'PostgreSQL')).toContain('CREATE TABLE');
  });

  it('holds a no-op to the declared range of a value-setting tool', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    const run = await peer.runTool('erd_set_column_not_null', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: true,
    });

    expect(run).toMatchObject({ batches: 0, historyEntries: 0, actions: [] });
    expect(run.mismatch).toBeUndefined();
  });

  it('holds a sort of a document with no table to its declared range', async () => {
    const peer = peerOf();
    peer.setInitialValue('');

    const run = await peer.runTool('erd_sort_tables', {});

    expect(run).toMatchObject({ batches: 0, historyEntries: 0, actions: [] });
    expect(run.mismatch).toBeUndefined();
  });

  it('passes a peer batch, the clock, readonly and subscriptions through', async () => {
    const peer = peerOf();
    const other = peerOf({ nickname: 'other' });
    peer.setInitialValue(createSeedValue());
    other.setInitialValue(createSeedValue());
    const remote: AnyAction[][] = [];
    other.subscribe(actions => remote.push(actions));
    await other.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });
    const sent: string[][] = [];
    const unsubscribe = peer.subscribe(actions =>
      sent.push(actions.map(({ type }) => type))
    );

    peer.mergeClock(500);
    const run = await peer.runTool('erd_add_table', {});
    remote.forEach(batch => peer.dispatch(batch));
    unsubscribe();
    const heard = sent.length;
    await peer.runTool('erd_add_table', {});
    peer.setReadonly(true);

    expect(run.actions[0].version).toBeGreaterThan(500);
    expect(sent.some(types => types.includes('table.add'))).toBe(true);
    expect(sent).toHaveLength(heard);
    expect(peer.state.collections.tableEntities[SEED.users].name).toBe(
      'members'
    );
    expect(peer.isReadonly).toBe(true);
    expect(peer.editorId).toBe(peer.state.editor.id);
  });
});

describe('agent peer refusals', () => {
  it('names an unknown tool', async () => {
    const peer = peerOf();

    const error = await refusal(() => peer.runTool('erd_fly', {}));

    expect(error.code).toBe(AgentToolErrorCode.unknownTool);
    expect(error.tool).toBe('erd_fly');
    expect(error.name).toBe('AgentToolError');
    expect(error.message).toContain('erd_fly');
  });

  it('refuses bad arguments and a dead id before anything is dispatched', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    await settle();
    const before = peer.value;

    const missing = await refusal(() =>
      peer.runTool('erd_change_table_name', {})
    );
    const dead = await refusal(() =>
      peer.runTool('erd_change_table_name', { tableId: 'gone', value: 'x' })
    );

    expect(missing.code).toBe(AgentToolErrorCode.invalidArgs);
    expect(dead.code).toBe(AgentToolErrorCode.notFound);
    expect(peer.value).toBe(before);
  });

  it('refuses every edit, undo and redo while readonly, and resumes after', async () => {
    const peer = peerOf({ readonly: true });
    peer.setInitialValue(createSeedValue());

    expect(peer.isReadonly).toBe(true);
    for (const [tool, call] of [
      ['erd_add_table', () => peer.runTool('erd_add_table', {})],
      ['undo', peer.undo],
      ['redo', peer.redo],
    ] as const) {
      const error = await refusal(call);

      expect(error.code).toBe(AgentToolErrorCode.readonly);
      expect(error.tool).toBe(tool);
      expect(error.message).toBe(
        'the document is readonly, so no edit was made'
      );
    }

    peer.setReadonly(false);
    const run = await peer.runTool('erd_add_table', {});

    expect(peer.isReadonly).toBe(false);
    expect(run.createdIds).toHaveLength(1);
  });

  it('refuses everything after destroy, and a second destroy is harmless', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    peer.destroy();
    peer.destroy();

    const run = await refusal(() => peer.runTool('erd_add_table', {}));

    expect(run.code).toBe(AgentToolErrorCode.destroyed);
    expect(run.tool).toBe('erd_add_table');
    expect(run.message).toBe(
      'this document session was closed; open the document again'
    );
    expect((await refusal(peer.undo)).code).toBe(AgentToolErrorCode.destroyed);
    expect((await refusal(peer.redo)).tool).toBe('redo');
    expect(() => peer.setInitialValue('')).toThrow(AgentToolError);
    expect(() => peer.subscribe(() => {})).toThrow(AgentToolError);
    expect(() => peer.read('json')).toThrow(AgentToolError);
    expect(() => peer.dispatch([])).not.toThrow();
  });

  it('refuses in the order destroyed, unknown tool, readonly, arguments', async () => {
    const readonly = peerOf({ readonly: true });
    const closed = peerOf({ readonly: true });
    closed.destroy();

    expect((await refusal(() => closed.runTool('erd_fly'))).code).toBe(
      AgentToolErrorCode.destroyed
    );
    expect((await refusal(() => readonly.runTool('erd_fly'))).code).toBe(
      AgentToolErrorCode.unknownTool
    );
    expect(
      (await refusal(() => readonly.runTool('erd_change_table_name', {}))).code
    ).toBe(AgentToolErrorCode.readonly);
  });

  it('lets an error that is no refusal through as it is', () => {
    const peer = peerOf();
    const broken = new Error('a broken listener set');
    // The first thing a subscription does past its guard is add the listener.
    vi.spyOn(Set.prototype, 'add').mockImplementationOnce(() => {
      throw broken;
    });

    expect(() => peer.subscribe(() => {})).toThrow(broken);
  });
});
