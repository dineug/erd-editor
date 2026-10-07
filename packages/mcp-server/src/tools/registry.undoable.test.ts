import type { PeerStore } from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { APPEND_SCENARIOS, TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer } from '@/__test-utils__/seed';
import { actionTools } from '@/tools/registry';
import { runTool } from '@/tools/run';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
}

const historyEntries = (name: string): number =>
  runTool(seededPeer(), name, TOOL_SCENARIOS[name]).historyEntries;

/**
 * The declaration half of AC-B4: what a run on the real engine reports is held
 * against the flag the agent is told. erd-editor's peer-store.undoable.test.ts
 * measures that report against a bare store's history cursor.
 */
describe('undoable is what a run on the engine measures (AC-B4)', () => {
  it.each(actionTools.map(({ name }) => name))(
    '%s records an undo entry exactly when it says it is undoable',
    name => {
      const tool = actionTools.find(tool => tool.name === name)!;

      expect([name, historyEntries(name) > 0]).toEqual([name, tool.undoable]);
    }
  );

  it.each(Object.keys(APPEND_SCENARIOS))(
    '%s with mode append records the one undo entry it says it is undoable by',
    name => {
      const run = runTool(seededPeer(), name, APPEND_SCENARIOS[name]);

      expect(run.historyEntries).toBe(1);
    }
  );

  it('leaves no undo entry only where AC-E9 lists the exception', () => {
    const exempt = (type: string) =>
      type === 'memo.resize' || type.startsWith('settings.');
    const sort = actionTools.find(({ name }) => name === 'erd_sort_tables')!;

    for (const tool of actionTools.filter(({ undoable }) => !undoable)) {
      expect(tool.actionTypes.every(exempt), tool.name).toBe(true);
    }
    expect(sort.undoable).toBe(true);
    expect(sort.actionTypes).toEqual(['table.moveTo']);
  });

  it('keeps the database settings out of the editor history and the scripts in it', () => {
    const settings = actionTools.filter(({ actionTypes }) =>
      actionTypes.every(type => type.startsWith('settings.'))
    );

    expect(settings.map(({ name }) => name)).toEqual([
      'erd_set_database_name',
      'erd_set_database',
      'erd_set_ddl_script',
    ]);
    expect(
      settings.filter(({ undoable }) => undoable).map(({ name }) => name)
    ).toEqual(['erd_set_ddl_script']);
  });

  it('says why a lone resize leaves no entry, citing the memo history', () => {
    const resize = actionTools.find(({ name }) => name === 'erd_resize_memo')!;

    expect(resize.undoable).toBe(false);
    expect(resize.undoableReason).toContain('memo/history.ts');
    expect(
      actionTools
        .filter(({ undoable }) => !undoable)
        .map(({ name }) => name)
        .filter(name => !name.startsWith('erd_set_'))
    ).toEqual(['erd_resize_memo']);
  });
});
