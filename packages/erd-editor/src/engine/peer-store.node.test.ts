// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addColumn,
  addTable,
  colorTable,
  play,
  renameColumn,
  renameTable,
} from '@/__test-utils__/peerScenarios';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import { FocusType } from '@/engine/modules/editor/state';
import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@/engine/peer-store';

const peers: PeerStore[] = [];

function peerOf(options: Partial<Parameters<typeof createPeerStore>[0]> = {}) {
  const peer = createPeerStore({ nickname: 'agent', ...options });
  peers.push(peer);
  return peer;
}

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
  vi.restoreAllMocks();
});

function refusal(call: () => unknown): PeerStoreError {
  try {
    call();
  } catch (error) {
    if (error instanceof PeerStoreError) return error;
    throw error;
  }
  throw new Error('the call was not refused');
}

describe('peer store in a realm with no DOM (AC-E2)', () => {
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

  it('counts a headless batch with nobody subscribed, draining its own pipe', () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    const first = play(peer, addColumn(SEED.empty));
    const second = play(peer, colorTable(SEED.users, '#123456'));

    expect(first.batches).toBe(1);
    expect(second.batches).toBe(1);
    expect([first.historyEntries, second.historyEntries]).toEqual([1, 1]);
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

  it('hands a batch to every subscriber although one of them throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());
    const received: string[][] = [];
    peer.subscribe(() => {
      throw new Error('a broken listener');
    });
    peer.subscribe(actions => received.push(actions.map(({ type }) => type)));

    const report = play(peer, renameTable(SEED.users, 'members'));

    expect(report.batches).toBe(1);
    expect(
      received.filter(types => types.includes('table.changeName'))
    ).toEqual([['table.changeName']]);
    expect(error).toHaveBeenCalledWith(new Error('a broken listener'));
  });

  it('returns the version stamped change actions and leaves out the local ones', () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    const report = play(peer, renameTable(SEED.users, 'members'));

    expect(report.label).toBe('renameTable');
    expect(report.actions.map(({ type }) => type)).toEqual([
      'table.changeName',
    ]);
    expect(report.actions[0].version).toEqual(expect.any(Number));
    expect(report.createdIds).toEqual([]);
  });

  it('labels an unnamed dispatch null and hands back the ids it created', () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    const report = peer.dispatch(addTable().actions);

    expect(report.label).toBeNull();
    expect(report.createdIds).toHaveLength(1);
    expect(peer.state.doc.tableIds).toContain(report.createdIds[0]);
  });

  it('focuses the table or the column a dispatch names before its edit', () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());

    play(peer, renameTable(SEED.orders, 'purchases'));
    expect(peer.state.editor.focusTable).toMatchObject({
      tableId: SEED.orders,
      focusType: FocusType.tableName,
    });

    play(peer, renameColumn(SEED.users, SEED.userName, 'full_name'));
    expect(peer.state.editor.focusTable).toMatchObject({
      tableId: SEED.users,
      columnId: SEED.userName,
      focusType: FocusType.columnName,
    });
  });
});

describe('peer store refusals', () => {
  it('refuses every edit, undo and redo while readonly, and resumes after', () => {
    const peer = peerOf({ readonly: true });
    peer.setInitialValue(createSeedValue());

    expect(peer.isReadonly).toBe(true);
    for (const [operation, call] of [
      ['dispatch', () => play(peer, addTable())],
      ['undo', peer.undo],
      ['redo', peer.redo],
    ] as const) {
      const error = refusal(call);

      expect(error.code).toBe(PeerStoreErrorCode.readonly);
      expect(error.operation).toBe(operation);
      expect(error.name).toBe('PeerStoreError');
      expect(error.message).toBe(
        'the document is readonly, so no edit was made'
      );
    }

    peer.setReadonly(false);
    const report = play(peer, addTable());

    expect(peer.isReadonly).toBe(false);
    expect(report.createdIds).toHaveLength(1);
  });

  it('refuses everything after destroy, and a second destroy is harmless', () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());
    expect(peer.isDestroyed).toBe(false);
    peer.destroy();
    peer.destroy();

    expect(peer.isDestroyed).toBe(true);
    expect(refusal(() => play(peer, addTable())).code).toBe(
      PeerStoreErrorCode.destroyed
    );
    expect(refusal(peer.undo).code).toBe(PeerStoreErrorCode.destroyed);
    expect(refusal(() => peer.setInitialValue('')).operation).toBe(
      'setInitialValue'
    );
    expect(refusal(() => peer.subscribe(() => {})).operation).toBe('subscribe');
    expect(refusal(peer.redo).message).toBe(
      'this document session was closed; open the document again'
    );
    expect(() => peer.receive([])).not.toThrow();
    expect(() => peer.flushStreamBuffers()).not.toThrow();
  });

  it('refuses before anything is dispatched, so the document stays as it was', () => {
    const peer = peerOf({ readonly: true, presence: false });
    peer.setInitialValue(createSeedValue());
    const before = peer.value;

    refusal(() => play(peer, renameTable(SEED.users, 'members')));

    expect(peer.value).toBe(before);
  });
});

describe('peer store reseed', () => {
  it('replaces the document and treats an empty value as an empty document', () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    peer.setInitialValue('');

    expect(JSON.parse(peer.value).doc.tableIds).toEqual([]);
  });

  it('drops the focus the old document held', () => {
    const peer = peerOf({ presence: false });
    peer.setInitialValue(createSeedValue());
    play(peer, renameTable(SEED.users, 'members'));

    expect(peer.state.editor.focusTable?.tableId).toBe(SEED.users);
    peer.setInitialValue(createSeedValue());

    expect(peer.state.editor.focusTable).toBeNull();
  });
});
