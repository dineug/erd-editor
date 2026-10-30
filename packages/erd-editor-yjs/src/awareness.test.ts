// @vitest-environment node
import {
  CanvasType,
  FocusType,
  type PeerStore,
  settingsActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { createHarness, type Harness } from '@/__test-utils__/harness';
import {
  AWARENESS_FIELD,
  createPresence,
  nextScreen,
  type PresenceState,
  screenOf,
} from '@/awareness';
import { isTracker } from '@/classify';
import { getLog, isLogEntry } from '@/log';
import type { CollaborationPort, PortAction } from '@/port';

let harness: Harness;
const cleanups: Array<() => void> = [];

afterEach(() => {
  harness?.cleanup();
  while (cleanups.length) cleanups.pop()!();
});

const presenceOf = (awareness: Awareness, clientId: number) =>
  awareness.getStates().get(clientId)?.[AWARENESS_FIELD] as
    | PresenceState
    | null
    | undefined;

/** Two presence peers in one room, each bound with its client's Awareness. */
const presenceRoom = () => {
  harness = createHarness();
  const { room, peer, bind } = harness;
  const a = peer('alice', { presence: true });
  const b = peer('bob', { presence: true });
  const clientA = room.join();
  const clientB = room.join();
  const bindingA = bind(a, clientA.doc, { awareness: clientA.awareness });
  bindingA.seed();
  const bindingB = bind(b, clientB.doc, { awareness: clientB.awareness });
  const [table] = a.dispatch([tableActions$.addTableAction$()]).createdIds;
  return { a, b, clientA, clientB, bindingA, bindingB, table };
};

const focusOn = (peer: PeerStore, tableId: string) =>
  peer.dispatch([], { focus: { tableId, focusType: FocusType.tableName } });

describe('presence', () => {
  it('AC-A4 the trackers travel through Awareness alone, and a client that disconnects is forgotten at once', async () => {
    const { a, b, clientA, table } = presenceRoom();

    focusOn(a, table);
    await vi.waitFor(() =>
      expect(b.state.editor.sharedFocusTrackerMap[a.editorId]).toBeDefined()
    );
    // The element sends these three; a peer store sends them as any batch.
    a.dispatch([
      { type: 'editor.sharedMouseTracker', payload: { x: 4, y: 8 } },
    ]);
    a.dispatch([
      {
        type: 'editor.sharedSelectionTracker',
        payload: { selectedIds: [table] },
      },
    ]);
    a.dispatch([
      {
        type: 'editor.sharedDragSelectTracker',
        payload: { rect: { x: 0, y: 0, w: 10, h: 10 } },
      },
    ]);
    const { editor } = b.state;
    expect(editor.sharedMouseTrackerMap[a.editorId]).toMatchObject({
      x: 4,
      y: 8,
      nickname: 'alice',
    });
    expect(editor.sharedSelectionTrackerMap[a.editorId]).toBeDefined();
    expect(editor.sharedDragSelectTrackerMap[a.editorId]).toBeDefined();

    const logged = getLog(clientA.doc)
      .toArray()
      .filter(isLogEntry)
      .flatMap(entry => entry.actions);
    expect(logged.some(action => isTracker(action.type))).toBe(false);

    clientA.disconnect();
    expect(editor.sharedFocusTrackerMap[a.editorId]).toBeUndefined();
    expect(editor.sharedMouseTrackerMap[a.editorId]).toBeUndefined();
    expect(editor.sharedSelectionTrackerMap[a.editorId]).toBeUndefined();
    expect(editor.sharedDragSelectTrackerMap[a.editorId]).toBeUndefined();
  });

  it('AC-A4 a tracker sent again as it was reaches the others again, so a held selection outlives its expiry', () => {
    // Installed before the room's Awareness, so its clock is the fake one too.
    vi.useFakeTimers();
    cleanups.push(() => vi.useRealTimers());
    const { a, b, table } = presenceRoom();
    const select = () =>
      a.dispatch([
        {
          type: 'editor.sharedSelectionTracker',
          payload: { selectedIds: [table] },
        },
      ]);

    select();
    vi.advanceTimersByTime(60_000);
    select();
    vi.advanceTimersByTime(60_000);

    expect(b.state.editor.sharedSelectionTrackerMap[a.editorId]).toBeDefined();
  });

  it('AC-A4 a binding destroyed clears its field, and the others forget its trackers', async () => {
    const { a, b, clientA, clientB, bindingA, table } = presenceRoom();
    focusOn(a, table);
    await vi.waitFor(() =>
      expect(b.state.editor.sharedFocusTrackerMap[a.editorId]).toBeDefined()
    );

    bindingA.destroy();
    expect(
      presenceOf(clientA.awareness, clientA.awareness.clientID)
    ).toBeNull();
    expect(
      presenceOf(clientB.awareness, clientA.awareness.clientID)
    ).toBeNull();
    expect(b.state.editor.sharedFocusTrackerMap[a.editorId]).toBeUndefined();
  });

  it('AC-A4 the screen carries the origin, the zoom and the tab the sender shows', () => {
    const { a, clientA, clientB } = presenceRoom();
    a.dispatch([
      settingsActions.scrollToAction({ originX: 120, originY: -40 }),
    ]);
    a.dispatch([settingsActions.changeZoomLevelAction({ value: 0.6 })]);
    a.dispatch([
      settingsActions.changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
    ]);

    const seen = presenceOf(clientB.awareness, clientA.awareness.clientID);
    expect(seen?.screen).toEqual({
      origin: { x: 120, y: -40 },
      zoom: 0.6,
      canvasType: CanvasType.schemaSQL,
    });
    expect(seen).toMatchObject({ editorId: a.editorId, nickname: 'alice' });
  });

  it('AC-A4 a late joiner takes the presence the room already shows', async () => {
    const { a, b, table } = presenceRoom();
    focusOn(a, table);
    await vi.waitFor(() =>
      expect(b.state.editor.sharedFocusTrackerMap[a.editorId]).toBeDefined()
    );

    const late = harness.peer('late', { presence: true });
    const client = harness.room.join();
    harness.bind(late, client.doc, { awareness: client.awareness });
    expect(late.state.editor.sharedFocusTrackerMap[a.editorId]).toBeDefined();
  });
});

describe('createPresence', () => {
  const fakePort = (editorId: string | null) => {
    const received: PortAction[][] = [];
    const forgotten: string[] = [];
    const port = {
      editorId: () => editorId,
      receive: (actions: PortAction[]) => received.push(actions),
      forgetPeer: (id: string) => forgotten.push(id),
    } as unknown as CollaborationPort;
    return { port, received, forgotten };
  };

  const awarenessOf = () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    cleanups.push(() => {
      awareness.destroy();
      doc.destroy();
    });
    return awareness;
  };

  const remoteState = (
    awareness: Awareness,
    clientId: number,
    state: Record<string, unknown> | null
  ) => {
    awareness.states.set(clientId, state ?? {});
    if (state === null) awareness.states.delete(clientId);
    awareness.emit('change', [
      {
        added: [],
        updated: state ? [clientId] : [],
        removed: state ? [] : [clientId],
      },
      'remote',
    ]);
  };

  const mouse = (editorId: string, x: number): PortAction => ({
    type: 'editor.sharedMouseTracker',
    payload: { x, y: 0 },
    tags: 1,
    meta: { editorId, nickname: 'remote' },
  });

  it('marks a compacting binding and starts from the identity the port knows', () => {
    const awareness = awarenessOf();
    const { port } = fakePort('local');
    const screen = { origin: { x: 1, y: 2 }, zoom: 1, canvasType: 'ERD' };
    createPresence(awareness, port, { screen, compactor: true });
    expect(presenceOf(awareness, awareness.clientID)).toEqual({
      editorId: 'local',
      nickname: '',
      trackers: {},
      beats: {},
      screen,
      compactor: true,
    });
  });

  it('withdraws a compacting binding from the election once, and a state that never stood writes nothing', () => {
    const awareness = awarenessOf();
    const { port } = fakePort('local');
    const screen = screenOf('{}');
    const compactor = createPresence(awareness, port, {
      screen,
      compactor: true,
    });
    const writes = vi.fn();
    awareness.on('update', writes);

    compactor.withdraw();
    expect(presenceOf(awareness, awareness.clientID)).toEqual({
      editorId: 'local',
      nickname: '',
      trackers: {},
      beats: {},
      screen,
    });
    compactor.withdraw();
    expect(writes).toHaveBeenCalledTimes(1);

    const other = awarenessOf();
    const plain = createPresence(other, port, { screen });
    const otherWrites = vi.fn();
    other.on('update', otherWrites);
    plain.withdraw();
    expect(otherWrites).not.toHaveBeenCalled();
    expect(presenceOf(other, other.clientID)).not.toHaveProperty('compactor');
  });

  it('forgets an editor id only once no other client shows it', () => {
    const awareness = awarenessOf();
    const { port, received, forgotten } = fakePort(null);
    createPresence(awareness, port, { screen: screenOf('{}') });
    const shown = (x: number) => ({
      [AWARENESS_FIELD]: {
        editorId: 'moved',
        trackers: { 'editor.sharedMouseTracker': mouse('moved', x) },
      },
    });
    // An element bound again to another Y.Doc of the room, whose new client
    // shows before the old one goes.
    remoteState(awareness, 7, shown(1));
    remoteState(awareness, 8, shown(2));

    remoteState(awareness, 7, null);
    expect(forgotten).toEqual([]);
    expect(received).toEqual([[mouse('moved', 1)], [mouse('moved', 2)]]);
    remoteState(awareness, 8, null);
    expect(forgotten).toEqual(['moved']);
  });

  it('applies a tracker once per change and forgets an editor id that changed or went', () => {
    const awareness = awarenessOf();
    awareness.states.set(7, {
      [AWARENESS_FIELD]: {
        editorId: 'first',
        nickname: 'remote',
        trackers: { 'editor.sharedMouseTracker': mouse('first', 1) },
        screen: screenOf('{}'),
      },
    });
    const { port, received, forgotten } = fakePort(null);
    const presence = createPresence(awareness, port, {
      screen: screenOf('{}'),
    });
    expect(received).toEqual([[mouse('first', 1)]]);

    remoteState(awareness, 7, {
      [AWARENESS_FIELD]: {
        editorId: 'first',
        trackers: {
          'editor.sharedMouseTracker': mouse('first', 1),
          'editor.sharedFocusTracker': { type: 'another type' },
        },
      },
    });
    expect(received).toHaveLength(1);

    remoteState(awareness, 7, {
      [AWARENESS_FIELD]: {
        editorId: 'second',
        trackers: { 'editor.sharedMouseTracker': mouse('second', 2) },
      },
    });
    expect(forgotten).toEqual(['first']);
    expect(received[1]).toEqual([mouse('second', 2)]);

    remoteState(awareness, 7, { [AWARENESS_FIELD]: null });
    expect(forgotten).toEqual(['first', 'second']);
    remoteState(awareness, 7, null);
    expect(forgotten).toEqual(['first', 'second']);

    presence.publish([
      {
        type: 'table.add',
        payload: {},
        meta: { editorId: 'local', nickname: 'me' },
      },
    ]);
    expect(presenceOf(awareness, awareness.clientID)).toMatchObject({
      editorId: 'local',
      nickname: 'me',
    });
    presence.publish([{ type: 'table.add', payload: {} }]);
    presence.destroy();
    expect(presenceOf(awareness, awareness.clientID)).toBeNull();
  });
});

describe('screen', () => {
  it('reads the settings a value opens on, or the default', () => {
    expect(screenOf('not json')).toEqual(screenOf('{}'));
    expect(screenOf('{"settings":3}')).toEqual(screenOf('{}'));
    expect(
      screenOf(
        JSON.stringify({
          settings: {
            originX: 5,
            originY: 6,
            zoomLevel: 2,
            canvasType: 'settings',
          },
        })
      )
    ).toEqual({ origin: { x: 5, y: 6 }, zoom: 2, canvasType: 'settings' });
    expect(screenOf('{"settings":{"originX":"5"}}')).toEqual(screenOf('{}'));
  });

  it('adds a step where the screen stands and takes an absolute write as it is', () => {
    const start = { origin: { x: 10, y: 10 }, zoom: 1, canvasType: 'ERD' };
    const at = (type: string, payload: unknown) =>
      nextScreen(start, { type, payload });

    expect(
      at('settings.streamScrollTo', { movementX: 5, movementY: -5 }).origin
    ).toEqual({ x: 15, y: 5 });
    expect(at('settings.streamZoomLevel', { value: 0.5 }).zoom).toBe(1.5);
    expect(at('settings.changeZoomLevel', { value: 0.5 }).zoom).toBe(0.5);
    expect(
      at('settings.changeCanvasType', { value: 'settings' }).canvasType
    ).toBe('settings');
    for (const type of [
      'settings.scrollTo',
      'settings.streamScrollTo',
      'settings.changeZoomLevel',
      'settings.streamZoomLevel',
      'settings.changeCanvasType',
      'table.add',
    ]) {
      expect(at(type, { value: null })).toBe(start);
    }
    expect(at('settings.scrollTo', null)).toBe(start);
  });
});
