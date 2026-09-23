// @vitest-environment node

import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  type PeerScenario,
  play,
  renameTable,
  resizeMemo,
  SEED_SCENARIOS,
} from '@/__test-utils__/peerScenarios';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import { createEngineContext } from '@/engine/context';
import { pushUndoHistoryMap } from '@/engine/history.actions';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { createRxStore } from '@/engine/rx-store';
import { defaultToWidth } from '@/engine/to-width';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
});

const names = Object.keys(SEED_SCENARIOS);

/**
 * The history cursor's move when a scenario's actions go through a bare store
 * on the seed, measured apart from the peer store so its reported count is
 * checked against the engine rather than against itself.
 */
function cursorDelta(scenario: PeerScenario): number {
  const store = createRxStore(
    createEngineContext({ toWidth: defaultToWidth }),
    { manualStreamFlush: true, observable: false }
  );
  cleanups.push(store.destroy);
  store.dispatchSync(
    changeViewportAction({ width: 0, height: 0 }),
    initialLoadJsonAction$(createSeedValue())
  );

  const before = store.history.cursor;

  store.dispatchSync(
    compositionActionsFlat(store.state, store.context, [...scenario.actions])
  );
  store.flushStreamBuffers();

  return store.history.cursor - before;
}

function seededPeer(): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(createSeedValue());
  return peer;
}

describe('a dispatch reports the undo entries the engine makes (AC-P2)', () => {
  it.each(names)(
    '%s moves a bare store’s history cursor as far as the peer reports',
    name => {
      const delta = cursorDelta(SEED_SCENARIOS[name]());

      const report = play(seededPeer(), SEED_SCENARIOS[name]());

      expect(report.historyEntries).toBe(delta);
    }
  );

  it('records an entry for every scenario but a memo resize and the settings the engine cannot undo', () => {
    const withoutEntry = names.filter(
      name => play(seededPeer(), SEED_SCENARIOS[name]()).historyEntries === 0
    );

    expect(withoutEntry).toEqual([
      'resizeMemo',
      'setDatabaseName',
      'setDatabase',
      'setLanguage',
      'setTableNameCase',
      'setColumnNameCase',
      'setBracketType',
      'setRelationshipDataTypeSync',
      'setRelationshipOptimization',
      'setColumnOrder',
      'setMaxWidthComment',
      'setIgnoreSaveSettings',
    ]);
  });

  it('leaves no entry only where the undo map holds none of the types sent', () => {
    for (const name of names) {
      const report = play(seededPeer(), SEED_SCENARIOS[name]());
      if (report.historyEntries) continue;

      expect(
        report.actions.map(({ type }) => type in pushUndoHistoryMap),
        name
      ).toEqual(report.actions.map(() => false));
    }
  });

  it('reverts exactly the entries it reported, one dispatch at a time', () => {
    const peer = seededPeer();
    const rename = play(peer, renameTable(SEED.users, 'members'));
    const resize = play(peer, resizeMemo(SEED.memo, 320, 240));

    expect([rename.historyEntries, resize.historyEntries]).toEqual([1, 0]);
    expect(peer.undo()).toEqual({
      label: 'renameTable',
      entries: rename.historyEntries,
      skipped: ['resizeMemo'],
    });
    expect(peer.state.collections.tableEntities[SEED.users].name).toBe('users');
  });
});
