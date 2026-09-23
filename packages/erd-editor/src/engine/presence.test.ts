// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addTable,
  moveTable,
  play,
  renameColumn,
  renameTable,
} from '@/__test-utils__/peerScenarios';
import {
  createSeedValue,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import { SHARED_FOCUS_TRACKER_TIMEOUT } from '@/engine/modules/editor/atom.actions';
import { createPeerStore } from '@/engine/peer-store';
import { createFocusPresence, FOCUS_HEARTBEAT_MS } from '@/engine/presence';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/**
 * Presence rides a 100 ms throttle and the handshake at wiring time opens its
 * window, so a session starts with that window closed. The clock is faked
 * first, which puts the heartbeat interval on it too.
 */
const PRESENCE_THROTTLE_MS = 100;

async function quietSession(): Promise<Session> {
  vi.useFakeTimers();
  const session = createSession({ presence: true });
  cleanups.push(session.destroy);
  await vi.advanceTimersByTimeAsync(PRESENCE_THROTTLE_MS + 20);
  return session;
}

async function focusedSession(): Promise<Session> {
  const session = await quietSession();

  play(session.peer, renameColumn(SEED.users, SEED.userName, 'full_name'));
  await Promise.resolve();
  await Promise.resolve();
  return session;
}

const focusBatches = ({ sent }: Session) =>
  sent.filter(actions =>
    actions.some(({ type }) => type === 'editor.sharedFocusTracker')
  );

describe('peer focus presence (AC-E10)', () => {
  it('shows the focused cell on the user side, sent under the nickname', async () => {
    const session = await focusedSession();

    expect(
      session.user.rxStore.state.editor.sharedFocusTrackerMap[
        session.peer.editorId
      ]
    ).toMatchObject({
      tableId: SEED.users,
      columnId: SEED.userName,
      focusType: 'columnName',
    });
    expect(focusBatches(session).at(-1)?.[0].meta).toMatchObject({
      editorId: session.peer.editorId,
      nickname: 'agent',
    });
  });

  it('beats again before the user side would expire the cell', async () => {
    const session = await focusedSession();
    const before = focusBatches(session).length;

    expect(FOCUS_HEARTBEAT_MS).toBeLessThan(SHARED_FOCUS_TRACKER_TIMEOUT);
    vi.advanceTimersByTime(FOCUS_HEARTBEAT_MS);
    await Promise.resolve();

    expect(focusBatches(session).length).toBe(before + 1);
    vi.advanceTimersByTime(FOCUS_HEARTBEAT_MS * 2);
    await Promise.resolve();
    expect(
      session.user.rxStore.state.editor.sharedFocusTrackerMap
    ).toHaveProperty(session.peer.editorId);
  });

  it('answers a joining store’s handshake with the cell at once', async () => {
    const session = await focusedSession();
    const before = focusBatches(session).length;
    vi.advanceTimersByTime(150);

    session.peer.receive({
      type: 'editor.getLWW',
      payload: undefined,
      version: 0,
      tags: 1,
      meta: { editorId: 'someone-else' },
    });
    await Promise.resolve();

    expect(focusBatches(session).length).toBe(before + 1);
  });

  it('never sends a mouse, selection or drag selection tracker', async () => {
    const session = await focusedSession();
    play(session.peer, addTable());
    play(session.peer, moveTable(SEED.orders, 10, 10));
    vi.advanceTimersByTime(FOCUS_HEARTBEAT_MS * 2);
    await Promise.resolve();

    const types = new Set(session.sent.flat().map(({ type }) => type));

    expect(types.has('editor.sharedMouseTracker')).toBe(false);
    expect(types.has('editor.sharedSelectionTracker')).toBe(false);
    expect(types.has('editor.sharedDragSelectTracker')).toBe(false);
  });

  it('goes out on its own batch, which the dispatch’s batch count leaves out', async () => {
    const session = await quietSession();
    const before = focusBatches(session).length;

    const report = play(session.peer, renameTable(SEED.orders, 'purchases'));
    await Promise.resolve();

    expect(report.batches).toBe(1);
    expect(focusBatches(session)).toHaveLength(before + 1);
    expect(focusBatches(session)[before].map(({ type }) => type)).toEqual([
      'editor.sharedFocusTracker',
    ]);
  });

  it('sends no focus at all when turned off', async () => {
    const session = createSession({ presence: false });
    cleanups.push(session.destroy);
    await settle();

    play(session.peer, renameTable(SEED.orders, 'purchases'));
    await settle();

    expect(focusBatches(session)).toEqual([]);
  });

  it('stops beating once the peer is destroyed', async () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const peer = createPeerStore({ nickname: 'agent' });
    peer.setInitialValue(createSeedValue());
    const sent: unknown[] = [];
    peer.subscribe(actions => sent.push(actions));
    const heartbeats = interval.mock.calls.flatMap(([, ms], index) =>
      ms === FOCUS_HEARTBEAT_MS ? [interval.mock.results[index].value] : []
    );

    play(peer, renameTable(SEED.users, 'members'));
    peer.destroy();
    const after = sent.length;
    vi.advanceTimersByTime(FOCUS_HEARTBEAT_MS * 3);
    await Promise.resolve();

    expect(heartbeats).toHaveLength(1);
    expect(clear).toHaveBeenCalledWith(heartbeats[0]);
    expect(sent.length).toBe(after);
  });
});

describe('focus presence timers', () => {
  it('releases a Node timer and tolerates a browser one, which is a number', () => {
    const unref = vi.fn();
    const interval = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValueOnce({ unref } as any)
      .mockReturnValueOnce(7 as any);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    const store = {
      state: { editor: { focusTable: null } },
      subscribe: () => () => {},
      dispatch: () => {},
    } as any;

    const node = createFocusPresence(store);
    const browser = createFocusPresence(store);

    expect(interval).toHaveBeenCalledTimes(2);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(() => {
      node.destroy();
      browser.destroy();
    }).not.toThrow();
  });
});
