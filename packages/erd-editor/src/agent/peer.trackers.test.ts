// @vitest-environment node

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { Tag } from '@/engine/tag';

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A batch as another editor's shared store sends it: shared tag, its id and nickname. */
function remoteBatch(editorId: string): AnyAction[] {
  const remote = (type: string, payload: unknown): AnyAction => ({
    type,
    payload,
    version: 1,
    tags: Tag.shared,
    meta: { editorId, nickname: 'user' },
  });

  return [
    remote('editor.sharedMouseTracker', { x: 10, y: 20 }),
    remote('editor.sharedFocusTracker', {
      focus: { tableId: SEED.users, columnId: null, focusType: 'tableName' },
    }),
    remote('editor.sharedSelectionTracker', { selectedIds: [SEED.users] }),
    remote('editor.sharedDragSelectTracker', {
      rect: { x: 0, y: 0, w: 5, h: 5 },
    }),
  ];
}

function trackerMaps({ state: { editor } }: AgentPeer) {
  return [
    editor.sharedMouseTrackerMap,
    editor.sharedFocusTrackerMap,
    editor.sharedSelectionTrackerMap,
    editor.sharedDragSelectTrackerMap,
  ];
}

function trackerTimers(peer: AgentPeer, editorId: string) {
  return trackerMaps(peer).map(trackers => trackers[editorId]?.timeoutId);
}

async function livePeer() {
  vi.useFakeTimers();
  const peer = createAgentPeer({ nickname: 'agent' });
  peers.push(peer);
  peer.setInitialValue(createSeedValue());
  peer.subscribe(() => {});
  // The load's store hooks run on short timers; only the heartbeat outlives them.
  await vi.advanceTimersByTimeAsync(1000);
  return peer;
}

describe('agent peer remote trackers', () => {
  it('holds an expiry timer for each tracker another editor sends', async () => {
    const peer = await livePeer();
    const baseline = vi.getTimerCount();

    peer.dispatch(remoteBatch('vscode-user'));

    expect(trackerTimers(peer, 'vscode-user')).not.toContain(undefined);
    expect(vi.getTimerCount()).toBe(baseline + 4);
  });

  it('clears every tracker timer on destroy, so a closed MCP process can exit', async () => {
    const peer = await livePeer();
    peer.dispatch(remoteBatch('vscode-user'));
    peer.dispatch(remoteBatch('intellij-user'));
    const timers = [
      ...trackerTimers(peer, 'vscode-user'),
      ...trackerTimers(peer, 'intellij-user'),
    ];
    const clear = vi.spyOn(globalThis, 'clearTimeout');

    peer.destroy();

    for (const timer of timers) {
      expect(clear).toHaveBeenCalledWith(timer);
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(trackerMaps(peer).map(trackers => Object.keys(trackers))).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });

  it('sets no timer for a batch that arrives after destroy, and a second destroy is harmless', async () => {
    const peer = await livePeer();
    peer.destroy();

    peer.dispatch(remoteBatch('vscode-user'));
    peer.destroy();

    expect(trackerTimers(peer, 'vscode-user')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
