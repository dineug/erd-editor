import { describe, expect, it, vi } from 'vite-plus/test';

import {
  addSchemaEntityAction,
  bridge,
  collaborativeDispatchAction,
  deleteSchemaEntityAction,
  dispatch,
  dispatchAll,
  replicationSchemaEntityAction,
  startSessionAction,
  stopSessionAction,
} from '@/utils/broadcastChannel';

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

describe('bridge action creators', () => {
  it('builds a { type, payload } pair that survives a structured clone', () => {
    const action = startSessionAction({
      schemaId: 'schema-1',
      roomId: 'room-1',
      secretKey: 'secret-1',
    });

    expect(action).toEqual({
      type: 'startSession',
      payload: {
        schemaId: 'schema-1',
        roomId: 'room-1',
        secretKey: 'secret-1',
      },
    });
    expect(structuredClone(action)).toEqual(action);
  });

  it('exposes its type both as a property and via toString', () => {
    expect(stopSessionAction.type).toBe('stopSession');
    expect(`${stopSessionAction}`).toBe('stopSession');
  });

  it('names every action on the cross-tab protocol', () => {
    expect([
      replicationSchemaEntityAction.type,
      addSchemaEntityAction.type,
      deleteSchemaEntityAction.type,
      startSessionAction.type,
      stopSessionAction.type,
      collaborativeDispatchAction.type,
    ]).toEqual([
      'replicationSchemaEntity',
      'addSchemaEntity',
      'deleteSchemaEntity',
      'startSession',
      'stopSession',
      'collaborativeDispatch',
    ]);
  });
});

describe('bridge', () => {
  it('routes an action to the reducer registered for its type', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const unsubscribe = bridge.on({
      startSession: onStart,
      stopSession: onStop,
    });

    bridge.emit(stopSessionAction({ schemaId: 'schema-1' }));

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops delivering once unsubscribed', () => {
    const onStop = vi.fn();

    bridge.on({ stopSession: onStop })();
    bridge.emit(stopSessionAction({ schemaId: 'schema-1' }));

    expect(onStop).not.toHaveBeenCalled();
  });

  it('registers the same reducer map only once', () => {
    const onStop = vi.fn();
    const reducers = { stopSession: onStop };

    bridge.on(reducers);
    const unsubscribe = bridge.on(reducers);
    bridge.emit(stopSessionAction({ schemaId: 'schema-1' }));

    expect(onStop).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignores anything that is not an action object', () => {
    const onStop = vi.fn();
    const unsubscribe = bridge.on({ stopSession: onStop });

    bridge.emit(null as any);
    bridge.emit('stopSession' as any);

    expect(onStop).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps a throwing reducer from starving the other observers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onStop = vi.fn();
    const unsubscribeFirst = bridge.on({
      stopSession: () => {
        throw new Error('boom');
      },
    });
    const unsubscribeSecond = bridge.on({ stopSession: onStop });

    bridge.emit(stopSessionAction({ schemaId: 'schema-1' }));

    expect(onStop).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
    vi.restoreAllMocks();
  });
});

describe('dispatch', () => {
  it('leaves this context alone — a BroadcastChannel never echoes back', async () => {
    const onStop = vi.fn();
    const unsubscribe = bridge.on({ stopSession: onStop });

    dispatch(stopSessionAction({ schemaId: 'schema-1' }));
    await settle();

    expect(onStop).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('replays an action posted by another tab into the local bridge', async () => {
    const onStop = vi.fn();
    const unsubscribe = bridge.on({ stopSession: onStop });
    const otherTab = new BroadcastChannel('@@bridge');

    otherTab.postMessage(stopSessionAction({ schemaId: 'schema-1' }));
    await settle();

    expect(onStop).toHaveBeenCalledWith({
      type: 'stopSession',
      payload: { schemaId: 'schema-1' },
    });
    otherTab.close();
    unsubscribe();
  });
});

describe('dispatchAll', () => {
  it('also delivers to this context, so the posting tab reacts too', async () => {
    const onDispatch = vi.fn();
    const unsubscribe = bridge.on({ collaborativeDispatch: onDispatch });

    dispatchAll(
      collaborativeDispatchAction({ schemaId: 'schema-1', actions: [] })
    );

    expect(onDispatch).toHaveBeenCalledTimes(1);
    await settle();
    // Exactly once — the local emit is not doubled by a channel round trip.
    expect(onDispatch).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
