// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addColumn,
  addTable,
  colorMemo,
  colorTable,
  moveTable,
  type PeerScenario,
  play,
  renameColumn,
  renameTable,
  resizeMemo,
  setColumnNotNull,
  setColumnPrimaryKey,
  setDatabase,
  sortTables,
} from '@/__test-utils__/peerScenarios';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import { Database } from '@/constants/schema';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';

const dispatches = vi.hoisted(() => ({ count: 0 }));

// Counts the calls into the store's own dispatch, the one seam an edit has.
vi.mock('@/engine/rx-store', async importOriginal => {
  const actual = await importOriginal<typeof import('@/engine/rx-store')>();

  return {
    ...actual,
    createRxStore: (...args: Parameters<typeof actual.createRxStore>) => {
      const store = actual.createRxStore(...args);
      return Object.freeze({
        ...store,
        dispatchSync: (...actions: Parameters<typeof store.dispatchSync>) => {
          dispatches.count++;
          store.dispatchSync(...actions);
        },
      });
    },
  };
});

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

/** The same edits the undoable spec measures, focus and generators included. */
const SCENARIOS: Record<string, () => PeerScenario> = {
  addTable: () => addTable(),
  renameTable: () => renameTable(SEED.users, 'members'),
  colorTable: () => colorTable(SEED.users, '#ff8800'),
  moveTable: () => moveTable(SEED.users, 40, 60),
  sortTables: () => sortTables(),
  addColumn: () => addColumn(SEED.empty),
  renameColumn: () => renameColumn(SEED.users, SEED.userName, 'full_name'),
  setColumnNotNull: () => setColumnNotNull(SEED.users, SEED.userName, true),
  setColumnPrimaryKey: () =>
    setColumnPrimaryKey(SEED.users, SEED.userName, true),
  colorMemo: () => colorMemo(SEED.memo, '#336699'),
  resizeMemo: () => resizeMemo(SEED.memo, 320, 240),
  setDatabase: () => setDatabase(Database.PostgreSQL),
};

const names = Object.keys(SCENARIOS);

function seededPeer(): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  peers.push(peer);
  peer.setInitialValue(createSeedValue());
  return peer;
}

describe('one edit is one dispatch into the store (AC-P1)', () => {
  it.each(names)('%s reaches the store exactly once', name => {
    const peer = seededPeer();
    dispatches.count = 0;

    const report = play(peer, SCENARIOS[name]());

    expect(dispatches.count).toBe(1);
    expect(report.batches).toBeLessThanOrEqual(1);
  });

  it('dispatches once however many generators and a focus an edit carries', () => {
    const peer = seededPeer();
    dispatches.count = 0;

    const report = peer.dispatch(
      [
        addTable().actions[0],
        renameColumn(SEED.users, SEED.userName, 'full_name').actions[0],
      ],
      { label: 'two', focus: renameTable(SEED.users, 'members').focus }
    );

    expect(dispatches.count).toBe(1);
    expect(report.batches).toBe(1);
  });

  it('counts a second edit, so the seam it watches is the live one', () => {
    const peer = seededPeer();
    dispatches.count = 0;

    play(peer, renameTable(SEED.users, 'members'));
    play(peer, renameTable(SEED.orders, 'purchases'));

    expect(dispatches.count).toBe(2);
  });

  it('still dispatches once where the generator yields nothing at all', () => {
    const peer = seededPeer();
    dispatches.count = 0;

    const report = play(peer, setColumnNotNull(SEED.users, SEED.userId, true));

    expect(dispatches.count).toBe(1);
    expect(report).toMatchObject({ batches: 0, actions: [] });
  });
});
