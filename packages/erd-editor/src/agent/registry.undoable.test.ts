// @vitest-environment node

import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { actionTools } from '@/agent/registry';
import { validateToolArgs } from '@/agent/validate';
import { createEngineContext } from '@/engine/context';
import { pushUndoHistoryMap } from '@/engine/history.actions';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { createRxStore } from '@/engine/rx-store';
import { defaultToWidth } from '@/engine/to-width';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
});

/**
 * The history cursor's move when the tool's actions go through a bare store
 * on the seed, measured apart from the peer so the peer's count is checked
 * against the engine rather than against itself.
 */
function cursorDelta(name: string): number {
  const store = createRxStore(
    createEngineContext({ toWidth: defaultToWidth }),
    { manualStreamFlush: true, observable: false }
  );
  cleanups.push(store.destroy);
  store.dispatchSync(
    changeViewportAction({ width: 0, height: 0 }),
    initialLoadJsonAction$(createSeedValue())
  );

  const tool = actionTools.find(tool => tool.name === name)!;
  const values = validateToolArgs(tool, TOOL_SCENARIOS[name], store.state);
  const before = store.history.cursor;

  store.dispatchSync(
    compositionActionsFlat(store.state, store.context, [
      ...tool.toActions(values),
    ])
  );
  store.flushStreamBuffers();

  return store.history.cursor - before;
}

describe('undoable is what the engine measures (AC-P2)', () => {
  it.each(actionTools.map(({ name }) => name))(
    '%s moves the history cursor exactly when it says it is undoable',
    async name => {
      const tool = actionTools.find(tool => tool.name === name)!;
      const delta = cursorDelta(name);

      expect(delta > 0).toBe(tool.undoable);

      const peer: AgentPeer = createAgentPeer({
        nickname: 'agent',
        presence: false,
      });
      cleanups.push(peer.destroy);
      peer.setInitialValue(createSeedValue());
      const run = await peer.runTool(name, TOOL_SCENARIOS[name]);

      expect(run.historyEntries).toBe(delta);
    }
  );

  it('leaves no undo entry only where AC-E9 lists the exception', () => {
    const exempt = (type: string) =>
      type === 'memo.resize' ||
      (type.startsWith('settings.') && !(type in pushUndoHistoryMap));
    const sort = actionTools.find(({ name }) => name === 'erd_sort_tables')!;

    for (const tool of actionTools.filter(({ undoable }) => !undoable)) {
      expect(tool.actionTypes.every(exempt), tool.name).toBe(true);
    }
    expect(sort.undoable).toBe(true);
    expect(sort.actionTypes).toEqual(['table.moveTo']);
  });

  it('keeps erd_set_show the one settings tool the engine can undo', () => {
    const settings = actionTools.filter(({ actionTypes }) =>
      actionTypes.every(type => type.startsWith('settings.'))
    );

    expect(settings).toHaveLength(12);
    expect(
      settings.filter(({ undoable }) => undoable).map(({ name }) => name)
    ).toEqual(['erd_set_show']);
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
