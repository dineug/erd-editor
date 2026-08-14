import { afterEach, describe, expect, it, vi } from 'vitest';

import { reduxDevtools } from '@/reduxDevtools';
import { createAction, createStore, type Store } from '@/store';

const key = '__REDUX_DEVTOOLS_EXTENSION__';

const increase = createAction<number>('increase');
const decrease = createAction<number>('decrease');

type State = { count: number };
type Meta = { increase: number; decrease: number };

const createCounterStore = (): Store<State, {}> =>
  createStore<State, Meta, {}>({
    context: {},
    state: { count: 0 },
    reducers: {
      increase: (state, { payload }) => {
        state.count += payload;
      },
      decrease: (state, { payload }) => {
        state.count -= payload;
      },
    },
  });

const createDevtools = () => ({
  init: vi.fn(),
  send: vi.fn(),
  unsubscribe: vi.fn(),
});

const installExtension = (devTools: any) => {
  const connect = vi.fn(() => devTools);
  Reflect.set(window, key, { connect });
  return connect;
};

describe('reduxDevtools', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, key);
  });

  it('does nothing but stay silent when the extension is missing', () => {
    const store = createCounterStore();

    const unsubscribe = reduxDevtools(store);

    expect(() => store.dispatchSync(increase(1))).not.toThrow();
    expect(store.state.count).toBe(1);
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connects with the given config and initializes with the store state', () => {
    const devTools = createDevtools();
    const connect = installExtension(devTools);
    const store = createCounterStore();
    const config = { name: 'test-store' };

    reduxDevtools(store, config);

    expect(connect).toHaveBeenCalledWith(config);
    expect(devTools.init).toHaveBeenCalledWith(store.state);
  });

  it('connects with undefined when no config is given', () => {
    const devTools = createDevtools();
    const connect = installExtension(devTools);

    reduxDevtools(createCounterStore());

    expect(connect).toHaveBeenCalledWith(undefined);
  });

  it('sends every dispatched batch joined by " |> " with the current state', () => {
    const devTools = createDevtools();
    installExtension(devTools);
    const store = createCounterStore();

    reduxDevtools(store);
    store.dispatchSync(increase(3), decrease(1));

    expect(devTools.send).toHaveBeenCalledTimes(1);
    const [entry, state] = devTools.send.mock.calls[0];
    expect(entry.type).toBe('increase |> decrease');
    expect(entry.actions).toEqual([
      { type: 'increase', payload: 3 },
      { type: 'decrease', payload: 1 },
    ]);
    expect(state).toBe(store.state);
    expect(store.state.count).toBe(2);
  });

  it('sends a single action type without a separator', () => {
    const devTools = createDevtools();
    installExtension(devTools);
    const store = createCounterStore();

    reduxDevtools(store);
    store.dispatchSync(increase(1));

    expect(devTools.send.mock.calls[0][0].type).toBe('increase');
  });

  it('unsubscribes from both the devtools and the store', () => {
    const devTools = createDevtools();
    installExtension(devTools);
    const store = createCounterStore();

    const unsubscribe = reduxDevtools(store);
    store.dispatchSync(increase(1));
    unsubscribe();
    store.dispatchSync(increase(1));

    expect(devTools.unsubscribe).toHaveBeenCalledTimes(1);
    expect(devTools.send).toHaveBeenCalledTimes(1);
    expect(store.state.count).toBe(2);
  });

  it('tolerates an extension whose connect returns nothing', () => {
    const connect = vi.fn(() => undefined);
    Reflect.set(window, key, { connect });
    const store = createCounterStore();

    const unsubscribe = reduxDevtools(store);
    store.dispatchSync(increase(1));

    expect(connect).toHaveBeenCalledTimes(1);
    expect(store.state.count).toBe(1);
    expect(() => unsubscribe()).not.toThrow();
  });
});
