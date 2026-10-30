// @vitest-environment node
import {
  type ActionType,
  CanvasType,
  ChangeActionTypes,
  createPeerStore,
  FocusType,
  settingsActions,
  SharedFollowingActionTypes,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { MODULE_SCENARIOS } from '@/__test-utils__/scenarios';
import {
  FOLLOWING_TYPES,
  HANDSHAKE_TYPES,
  isFollowing,
  isHandshake,
  isLogged,
  isTracker,
  TRACKER_TYPES,
} from '@/classify';
import type { PortAction } from '@/port';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe('classify', () => {
  it('names eleven types the engine declares', () => {
    // A type the engine renamed fails to compile here.
    const eleven: ReadonlyArray<ActionType> = [
      ...TRACKER_TYPES,
      ...HANDSHAKE_TYPES,
      ...FOLLOWING_TYPES,
    ];
    expect(new Set(eleven).size).toBe(11);
  });

  it('the five following types are the engine list less the name view, which is logged', () => {
    const following = new Set<string>(FOLLOWING_TYPES);
    expect(
      FOLLOWING_TYPES.every(type => SharedFollowingActionTypes.includes(type))
    ).toBe(true);
    expect(
      SharedFollowingActionTypes.filter(type => !following.has(type))
    ).toEqual(['settings.changeNameViewMode']);
    expect(isLogged('settings.changeNameViewMode')).toBe(true);
  });

  it('puts each of the eleven types in one class and every other type in the log', () => {
    for (const type of TRACKER_TYPES) {
      expect([
        isTracker(type),
        isHandshake(type),
        isFollowing(type),
        isLogged(type),
      ]).toEqual([true, false, false, false]);
    }
    for (const type of HANDSHAKE_TYPES) {
      expect([
        isTracker(type),
        isHandshake(type),
        isFollowing(type),
        isLogged(type),
      ]).toEqual([false, true, false, false]);
    }
    for (const type of FOLLOWING_TYPES) {
      expect([
        isTracker(type),
        isHandshake(type),
        isFollowing(type),
        isLogged(type),
      ]).toEqual([false, false, true, false]);
    }
    const changes = ChangeActionTypes.filter(type => !isFollowing(type));
    expect(changes.every(isLogged)).toBe(true);
  });

  it('classifies everything a presence peer store sends: changes, its focus, the handshake and the viewport', async () => {
    const peer = createPeerStore({ nickname: 'census', presence: true });
    cleanups.push(peer.destroy);
    const responder = createPeerStore({
      nickname: 'responder',
      presence: false,
    });
    cleanups.push(responder.destroy);
    const sent: PortAction[] = [];
    peer.subscribe(actions => sent.push(...actions));

    for (const { steps } of MODULE_SCENARIOS) {
      const ids = {};
      for (const step of steps) step.run(peer, ids);
    }
    const [table] = peer.dispatch([tableActions$.addTableAction$()]).createdIds;
    peer.dispatch([], {
      focus: { tableId: table, focusType: FocusType.tableName },
    });
    // The focus tracker dispatches its presence in a microtask of the store's.
    await vi.waitFor(() =>
      expect(sent.map(action => action.type)).toContain(
        'editor.sharedFocusTracker'
      )
    );
    peer.dispatch([settingsActions.scrollToAction({ originX: 1, originY: 2 })]);
    peer.dispatch([settingsActions.changeZoomLevelAction({ value: 0.9 })]);
    peer.dispatch([
      settingsActions.changeCanvasTypeAction({ value: CanvasType.ERD }),
    ]);

    // Another store's first subscriber asks for registers, which the peer answers.
    responder.subscribe(actions => {
      const ask = actions.find(action => action.type === 'editor.getLWW');
      if (ask) peer.receive([ask]);
    });

    const types = new Set(sent.map(action => action.type));
    const changes = new Set<string>(ChangeActionTypes);
    for (const type of types) {
      const classes = [
        isTracker(type),
        isHandshake(type),
        isFollowing(type),
        isLogged(type),
      ];
      expect(classes.filter(Boolean), type).toHaveLength(1);
      if (isLogged(type)) expect(changes.has(type), type).toBe(true);
    }
    expect(types).toContain('editor.sharedFocusTracker');
    expect(types).toContain('editor.getLWW');
    expect(types).toContain('editor.mergeLWW');
    expect(types).toContain('settings.scrollTo');
    expect(types).toContain('settings.changeNameViewMode');
  });
});
