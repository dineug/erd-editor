// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createSeedValue, SEED, settle } from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';

const peers: AgentPeer[] = [];

function peerOf(options: Partial<Parameters<typeof createAgentPeer>[0]> = {}) {
  const peer = createAgentPeer({ nickname: 'agent', ...options });
  peers.push(peer);
  return peer;
}

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
  vi.restoreAllMocks();
});

async function refusal(promise: Promise<unknown>): Promise<AgentToolError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AgentToolError) return error;
    throw error;
  }
  throw new Error('the call was not refused');
}

describe('agent peer in a realm with no DOM (AC-E2)', () => {
  it('runs where window, document and Node are undefined', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof Reflect.get(globalThis, 'Node')).toBe('undefined');

    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    expect(peer.editorId).toBe(peer.state.editor.id);
    expect(JSON.parse(peer.value).doc.tableIds).toEqual([
      SEED.users,
      SEED.orders,
      SEED.empty,
    ]);
  });

  it('counts a headless batch with nobody subscribed, draining its own pipe', async () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    const first = await peer.runTool('erd_add_column', { tableId: SEED.empty });
    const second = await peer.runTool('erd_change_table_color', {
      tableId: SEED.users,
      color: '#123456',
    });

    expect(first.batches).toBe(1);
    expect(second.batches).toBe(1);
    expect(first.mismatch).toBeUndefined();
    expect(second.mismatch).toBeUndefined();
  });

  it('serializes the state the way the element does', () => {
    const peer = peerOf();
    peer.setInitialValue('');

    const value = JSON.parse(peer.value);

    expect(value.version).toBe('3.0.0');
    expect(value.$schema).toContain('schema.json');
    expect(value).not.toHaveProperty('lww');
  });

  it('keeps the origin the file carries, deferring the pull a screen would make', () => {
    const error = vi.spyOn(console, 'error');
    const seed = JSON.parse(createSeedValue());
    seed.settings.originX = -4000;
    seed.settings.originY = -3000;
    const peer = peerOf();

    peer.setInitialValue(JSON.stringify(seed));

    expect(JSON.parse(peer.value).settings).toMatchObject({
      originX: -4000,
      originY: -3000,
    });
    expect(peer.state.editor.scrollPullPending).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('hands a batch to every subscriber although one of them throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());
    const received: string[][] = [];
    peer.subscribe(() => {
      throw new Error('a broken listener');
    });
    peer.subscribe(actions => received.push(actions.map(({ type }) => type)));

    const run = await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(run.batches).toBe(1);
    expect(
      received.filter(types => types.includes('table.changeName'))
    ).toEqual([['table.changeName']]);
    expect(error).toHaveBeenCalledWith(new Error('a broken listener'));
  });

  it('returns the version stamped change actions and leaves out the local ones', async () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    const run = await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(run.tool).toBe('erd_change_table_name');
    expect(run.actions.map(({ type }) => type)).toEqual(['table.changeName']);
    expect(run.actions[0].version).toEqual(expect.any(Number));
    expect(run.createdIds).toEqual([]);
  });
});

describe('agent peer refusals', () => {
  it('names an unknown tool', async () => {
    const peer = peerOf();

    const error = await refusal(peer.runTool('erd_fly', {}));

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

    const missing = await refusal(peer.runTool('erd_change_table_name', {}));
    const dead = await refusal(
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
    for (const call of [
      peer.runTool('erd_add_table', {}),
      peer.undo(),
      peer.redo(),
    ]) {
      expect((await refusal(call)).code).toBe(AgentToolErrorCode.readonly);
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

    expect((await refusal(peer.runTool('erd_add_table', {}))).code).toBe(
      AgentToolErrorCode.destroyed
    );
    expect((await refusal(peer.undo())).code).toBe(
      AgentToolErrorCode.destroyed
    );
    expect(() => peer.setInitialValue('')).toThrow(AgentToolError);
    expect(() => peer.subscribe(() => {})).toThrow(AgentToolError);
    expect(() => peer.dispatch([])).not.toThrow();
  });
});

describe('agent peer reseed', () => {
  it('replaces the document and treats an empty value as an empty document', () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    peer.setInitialValue('');

    expect(JSON.parse(peer.value).doc.tableIds).toEqual([]);
  });

  it('drops the focus the old document held', async () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());
    await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(peer.state.editor.focusTable?.tableId).toBe(SEED.users);
    peer.setInitialValue(createSeedValue());

    expect(peer.state.editor.focusTable).toBeNull();
  });
});
