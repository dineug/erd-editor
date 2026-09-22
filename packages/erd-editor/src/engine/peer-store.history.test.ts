// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addColumn,
  colorTable,
  moveTable,
  play,
  renameTable,
  resizeMemo,
  setColumnNotNull,
  setColumnPrimaryKey,
  setDatabase,
} from '@/__test-utils__/peerScenarios';
import {
  comparable,
  createSeedValue,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import { Database } from '@/constants/schema';
import {
  changeTableColorAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { HISTORY_LIMIT } from '@/engine/rx-store';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.useRealTimers();
});

function seededPeer(): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(createSeedValue());
  return peer;
}

function session(): Session {
  const opened = createSession();
  cleanups.push(opened.destroy);
  return opened;
}

const tableName = (peer: PeerStore, id: string) =>
  peer.state.collections.tableEntities[id].name;

const renameUsers = (peer: PeerStore, value: string) =>
  play(peer, renameTable(SEED.users, value));

/** Sets a flag the seed already holds, a dispatch the engine makes no entry for. */
const setIdNotNull = (peer: PeerStore) =>
  play(peer, setColumnNotNull(SEED.users, SEED.userId, true));

describe('peer undo reverts the peer’s last dispatch only (AC-E8)', () => {
  it('undoes the last of three dispatches and leaves the first two', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    play(peer, renameTable(SEED.orders, 'purchases'));
    const column = play(peer, addColumn(SEED.empty));

    const result = peer.undo();

    expect(result).toEqual({
      label: 'addColumn',
      entries: 1,
      skipped: [],
    });
    expect(peer.state.collections.tableEntities[SEED.empty].columnIds).toEqual(
      []
    );
    expect(column.createdIds).toHaveLength(1);
    expect(tableName(peer, SEED.users)).toBe('members');
    expect(tableName(peer, SEED.orders)).toBe('purchases');
  });

  it('propagates the undo while the user store keeps its own history empty', async () => {
    const opened = session();
    await settle();
    const { peer, user } = opened;

    renameUsers(peer, 'members');
    play(peer, addColumn(SEED.empty));
    await settle();
    expect(user.rxStore.history.size).toBe(0);

    peer.undo();
    await settle();

    expect(user.rxStore.history.size).toBe(0);
    expect(
      user.rxStore.state.collections.tableEntities[SEED.empty].columnIds
    ).toEqual([]);
    expect(comparable(peer.value)).toEqual(
      comparable(toJson(user.rxStore.state))
    );
  });

  it('reverts a color at once, flushing the stream action the undo sends', async () => {
    const opened = session();
    await settle();
    vi.useFakeTimers();
    const { peer, user } = opened;
    const colorOf = () =>
      user.rxStore.state.collections.tableEntities[SEED.users].ui.color;

    play(peer, colorTable(SEED.users, '#abcdef'));
    await Promise.resolve();
    expect(colorOf()).toBe('#abcdef');

    peer.undo();
    await Promise.resolve();

    expect(colorOf()).toBe('');
  });

  it('passes over dispatches the engine made no entry for and names them', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    setIdNotNull(peer);
    const noop = play(peer, setColumnPrimaryKey(SEED.users, SEED.userId, true));

    const result = peer.undo();

    expect(noop.historyEntries).toBe(0);
    expect(result).toEqual({
      label: 'renameTable',
      entries: 1,
      skipped: ['setColumnPrimaryKey', 'setColumnNotNull'],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
  });

  it('passes over settings and resizes, which the engine never records', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    const database = play(peer, setDatabase(Database.PostgreSQL));
    const resize = play(peer, resizeMemo(SEED.memo, 300, 200));

    const result = peer.undo();

    expect([database.historyEntries, resize.historyEntries]).toEqual([0, 0]);
    expect(result).toEqual({
      label: 'renameTable',
      entries: 1,
      skipped: ['resizeMemo', 'setDatabase'],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
    expect(peer.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('reverts every entry a dispatch made with one undo, and redoes them all', () => {
    const peer = seededPeer();
    // A stream action beside a plain one: the history groups them apart.
    const report = peer.dispatch(
      [
        changeTableNameAction({ id: SEED.users, value: 'members' }),
        changeTableColorAction({
          id: SEED.users,
          color: '#123456',
          prevColor: '',
        }),
      ],
      { label: 'renameAndColor' }
    );
    const colorOf = () =>
      peer.state.collections.tableEntities[SEED.users].ui.color;

    expect(report.historyEntries).toBe(2);
    expect(peer.undo()).toEqual({
      label: 'renameAndColor',
      entries: 2,
      skipped: [],
    });
    expect([tableName(peer, SEED.users), colorOf()]).toEqual(['users', '']);

    expect(peer.redo().entries).toBe(2);
    expect([tableName(peer, SEED.users), colorOf()]).toEqual([
      'members',
      '#123456',
    ]);
  });

  it('says so when nothing is left to revert', () => {
    const peer = seededPeer();
    setIdNotNull(peer);

    expect(peer.undo()).toEqual({
      label: null,
      entries: 0,
      skipped: ['setColumnNotNull'],
    });
    expect(peer.undo()).toEqual({
      label: null,
      entries: 0,
      skipped: [],
    });
  });

  it('reverts an unlabeled dispatch too, and names no unlabeled one it passes over', () => {
    const peer = seededPeer();
    const { actions } = renameTable(SEED.users, 'members');
    peer.dispatch(actions);
    peer.dispatch(setColumnNotNull(SEED.users, SEED.userId, true).actions);

    expect(peer.undo()).toEqual({ label: null, entries: 1, skipped: [] });
    expect(tableName(peer, SEED.users)).toBe('users');
    expect(peer.redo()).toEqual({ label: null, entries: 1, skipped: [] });
    expect(tableName(peer, SEED.users)).toBe('members');
  });
});

describe('peer redo mirrors undo', () => {
  it('reapplies what the last undo reverted, then has nothing left', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    peer.undo();

    const result = peer.redo();

    expect(result).toEqual({
      label: 'renameTable',
      entries: 1,
      skipped: [],
    });
    expect(tableName(peer, SEED.users)).toBe('members');
    expect(peer.redo()).toEqual({
      label: null,
      entries: 0,
      skipped: [],
    });
    expect(peer.undo().label).toBe('renameTable');
  });

  it('forgets the redo side once a new dispatch makes an entry, as the history does', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    peer.undo();

    play(peer, addColumn(SEED.empty));

    expect(peer.redo().label).toBeNull();
    expect(tableName(peer, SEED.users)).toBe('users');
  });

  it('keeps the redo side across a dispatch that made no entry, as the history does', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    peer.undo();

    const noop = setIdNotNull(peer);
    const result = peer.redo();

    expect(noop.historyEntries).toBe(0);
    expect(result.label).toBe('renameTable');
    expect(tableName(peer, SEED.users)).toBe('members');
  });
});

describe('a reseed starts the history over', () => {
  it('forgets undo entries, labels and the redo side', async () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    play(peer, addColumn(SEED.empty));
    peer.undo();
    await settle();
    expect(peer.state.editor).toMatchObject({ hasUndo: true, hasRedo: true });

    peer.setInitialValue(createSeedValue());
    await settle();

    expect(peer.state.editor).toMatchObject({ hasUndo: false, hasRedo: false });
    expect(peer.undo()).toEqual({
      label: null,
      entries: 0,
      skipped: [],
    });
    expect(peer.redo()).toEqual({
      label: null,
      entries: 0,
      skipped: [],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
  });
});

describe('the labels keep to what the history holds', () => {
  const usersX = (peer: PeerStore) =>
    peer.state.collections.tableEntities[SEED.users].ui.x;

  it('stops naming dispatches once the history has dropped their entries', () => {
    const peer = seededPeer();
    for (let x = 0; x <= HISTORY_LIMIT; x++) {
      play(peer, moveTable(SEED.users, x, 0));
    }

    let reverted = 0;
    while (peer.undo().label) {
      reverted++;
    }

    expect(reverted).toBe(HISTORY_LIMIT);
    expect(usersX(peer)).toBe(0);
    expect(peer.redo()).toMatchObject({ label: 'moveTable' });
    expect(usersX(peer)).toBe(1);
  });

  it('lets the oldest dispatch with no entry go first, keeping the one that has one', () => {
    const peer = seededPeer();
    renameUsers(peer, 'members');
    for (let i = 0; i < HISTORY_LIMIT; i++) {
      setIdNotNull(peer);
    }

    const result = peer.undo();

    expect(result.label).toBe('renameTable');
    expect(result.skipped).toHaveLength(HISTORY_LIMIT - 1);
    expect(tableName(peer, SEED.users)).toBe('users');
  });
});
