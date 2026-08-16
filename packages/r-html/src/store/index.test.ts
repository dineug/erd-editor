import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { observer } from '@/observable';
import { nextTick } from '@/observable/scheduler';
import {
  type AnyAction,
  compositionActionsFlat,
  createAction,
  createStore,
  type DispatchOperator,
} from '@/store';

type CounterState = {
  count: number;
  log: string[];
};

type CounterContext = {
  name: string;
};

const increase = createAction<{ value: number }>('increase');
const decrease = createAction<{ value: number }>('decrease');
const appendName = createAction<void>('appendName');

const createCounterStore = (enableObservable = true) =>
  createStore<
    CounterState,
    {
      increase: { value: number };
      decrease: { value: number };
      appendName: void;
    },
    CounterContext
  >({
    context: { name: 'counter' },
    state: { count: 0, log: [] },
    enableObservable,
    reducers: {
      increase: (state, { payload: { value } }) => {
        state.count += value;
      },
      decrease: (state, { payload: { value } }) => {
        state.count -= value;
      },
      appendName: (state, _action, ctx) => {
        state.log.push(ctx.name);
      },
    },
  });

const flushMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve));

describe('createAction', () => {
  it('creates an action with the given type and payload', () => {
    const action = increase({ value: 3 });

    expect(action).toEqual({ type: 'increase', payload: { value: 3 } });
  });

  it('exposes the type both as a property and through toString', () => {
    expect(increase.type).toBe('increase');
    expect(increase.toString()).toBe('increase');
    expect(`${increase}`).toBe('increase');
  });

  it('creates a new action object on every call', () => {
    const a = increase({ value: 1 });
    const b = increase({ value: 1 });

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('compositionActionsFlat', () => {
  it('passes plain actions through unchanged', () => {
    const a = increase({ value: 1 });
    const b = decrease({ value: 2 });

    expect(compositionActionsFlat(null, null, [a, b])).toEqual([a, b]);
  });

  it('flattens deeply nested arrays', () => {
    const a = increase({ value: 1 });
    const b = decrease({ value: 2 });
    const c = appendName();

    expect(compositionActionsFlat(null, null, [[a], [[b], [[c]]]])).toEqual([
      a,
      b,
      c,
    ]);
  });

  it('drains generator actions', () => {
    const a = increase({ value: 1 });
    const b = decrease({ value: 2 });

    function* generatorAction() {
      yield a;
      yield [b];
    }

    expect(compositionActionsFlat(null, null, [generatorAction()])).toEqual([
      a,
      b,
    ]);
  });

  it('calls generator action creators with state and context', () => {
    const state = { count: 10 };
    const ctx = { name: 'ctx' };
    const received: Array<[any, any]> = [];

    function* creator(s: typeof state, c: typeof ctx) {
      received.push([s, c]);
      yield increase({ value: s.count });
      yield decrease({ value: c.name.length });
    }

    expect(compositionActionsFlat(state, ctx, [creator])).toEqual([
      { type: 'increase', payload: { value: 10 } },
      { type: 'decrease', payload: { value: 3 } },
    ]);
    expect(received).toEqual([[state, ctx]]);
  });

  it('recursively resolves creators returned by other creators', () => {
    function* inner(): any {
      yield increase({ value: 1 });
    }

    function* outer(): any {
      yield inner;
      yield [inner()];
    }

    expect(compositionActionsFlat(null, null, [outer])).toEqual([
      { type: 'increase', payload: { value: 1 } },
      { type: 'increase', payload: { value: 1 } },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(compositionActionsFlat(null, null, [])).toEqual([]);
    expect(compositionActionsFlat(null, null, [[], [[]]])).toEqual([]);
  });

  it('yields nullish values as-is because they are neither iterable nor callable', () => {
    expect(
      compositionActionsFlat(null, null, [null as any, undefined as any])
    ).toEqual([null, undefined]);
  });
});

describe('createStore', () => {
  const stores: Array<{ destroy(): void }> = [];

  const track = <T extends { destroy(): void }>(store: T): T => {
    stores.push(store);
    return store;
  };

  afterEach(() => {
    stores.splice(0).forEach(store => store.destroy());
    vi.restoreAllMocks();
  });

  it('exposes the given context', () => {
    const store = track(createCounterStore());

    expect(store.context).toEqual({ name: 'counter' });
  });

  it('wraps the state in an observable proxy by default', () => {
    const state = { count: 0, log: [] };
    const store = track(
      createStore<CounterState, { increase: { value: number } }, {}>({
        context: {},
        state,
        reducers: { increase: () => {} },
      })
    );

    expect(store.state).not.toBe(state);
    expect(store.state.count).toBe(0);
  });

  it('keeps the raw state object when enableObservable is false', () => {
    const state = { count: 0, log: [] };
    const store = track(
      createStore<CounterState, { increase: { value: number } }, {}>({
        context: {},
        state,
        enableObservable: false,
        reducers: { increase: () => {} },
      })
    );

    expect(store.state).toBe(state);
  });

  it('runs the matching reducer synchronously on dispatchSync', () => {
    const store = track(createCounterStore());

    store.dispatchSync(increase({ value: 5 }));

    expect(store.state.count).toBe(5);
  });

  it('passes the context to reducers', () => {
    const store = track(createCounterStore());

    store.dispatchSync(appendName());

    expect(store.state.log).toEqual(['counter']);
  });

  it('applies every action of a composition in order', () => {
    const store = track(createCounterStore());

    store.dispatchSync(increase({ value: 10 }), [
      decrease({ value: 3 }),
      [increase({ value: 1 })],
    ]);

    expect(store.state.count).toBe(8);
  });

  it('resolves generator action creators against the live state', () => {
    const store = track(createCounterStore());
    store.dispatchSync(increase({ value: 4 }));

    function* double(state: CounterState): any {
      yield increase({ value: state.count });
    }

    store.dispatchSync(double);

    expect(store.state.count).toBe(8);
  });

  it('ignores actions without a matching reducer', () => {
    const store = track(createCounterStore());

    expect(() =>
      store.dispatchSync({ type: 'unknown', payload: null })
    ).not.toThrow();
    expect(store.state.count).toBe(0);
  });

  it('catches reducer errors and logs them', () => {
    const error = new Error('boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = track(
      createStore<{ count: number }, { boom: void }, {}>({
        context: {},
        state: { count: 0 },
        reducers: {
          boom: () => {
            throw error;
          },
        },
      })
    );

    expect(() =>
      store.dispatchSync({ type: 'boom', payload: undefined })
    ).not.toThrow();
    expect(spy).toHaveBeenCalledWith(error);
  });

  it('throws when a nullish action reaches the reducer runner', () => {
    const store = track(createCounterStore());

    expect(() => store.dispatchSync(null as any)).toThrow(TypeError);
  });

  it('defers dispatch to a microtask', async () => {
    const store = track(createCounterStore());

    store.dispatch(increase({ value: 2 }));
    expect(store.state.count).toBe(0);

    await flushMicrotasks();
    expect(store.state.count).toBe(2);
  });

  it('notifies subscribers with the flattened actions', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    store.dispatchSync([increase({ value: 1 }), decrease({ value: 1 })]);

    expect(observerFn).toHaveBeenCalledTimes(1);
    expect(observerFn).toHaveBeenCalledWith([
      { type: 'increase', payload: { value: 1 } },
      { type: 'decrease', payload: { value: 1 } },
    ]);
  });

  it('stops notifying after unsubscribe', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    const unsubscribe = store.subscribe(observerFn);

    store.dispatchSync(increase({ value: 1 }));
    unsubscribe();
    store.dispatchSync(increase({ value: 1 }));

    expect(observerFn).toHaveBeenCalledTimes(1);
    expect(store.state.count).toBe(2);
  });

  it('skips empty action batches', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    store.dispatchSync();
    store.dispatchSync([]);

    expect(observerFn).not.toHaveBeenCalled();
  });

  it('runs pipe operators over dispatched actions', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    const tag: DispatchOperator = function* (source) {
      for (const actions of source) {
        yield actions.map(action => ({ ...action, tags: 1 }));
      }
    };

    store.pipe(tag);
    store.dispatchSync(increase({ value: 1 }));

    expect(observerFn).toHaveBeenCalledWith([
      { type: 'increase', payload: { value: 1 }, tags: 1 },
    ]);
    expect(store.state.count).toBe(1);
  });

  it('applies operators left to right', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    const first: DispatchOperator = function* (source) {
      for (const actions of source) {
        yield actions.map(action => ({ ...action, meta: { order: ['a'] } }));
      }
    };
    const second: DispatchOperator = function* (source) {
      for (const actions of source) {
        yield actions.map(action => ({
          ...action,
          meta: { order: [...(action.meta?.order ?? []), 'b'] },
        }));
      }
    };

    store.pipe(first, second);
    store.dispatchSync(increase({ value: 1 }));

    const [[actions]] = observerFn.mock.calls as [[AnyAction[]]];
    expect(actions[0].meta).toEqual({ order: ['a', 'b'] });
  });

  it('drops batches that an operator empties', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    const dropAll: DispatchOperator = function* (source) {
      for (const _actions of source) {
        yield [];
      }
    };

    store.pipe(dropAll);
    store.dispatchSync(increase({ value: 1 }));

    expect(observerFn).not.toHaveBeenCalled();
    expect(store.state.count).toBe(0);
  });

  it('restores the default operator when the pipe unsubscribe runs', () => {
    const store = track(createCounterStore());
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    const dropAll: DispatchOperator = function* (source) {
      for (const _actions of source) {
        yield [];
      }
    };

    const unpipe = store.pipe(dropAll);
    store.dispatchSync(increase({ value: 1 }));
    expect(store.state.count).toBe(0);

    unpipe();
    store.dispatchSync(increase({ value: 1 }));

    expect(store.state.count).toBe(1);
    expect(observerFn).toHaveBeenCalledTimes(1);
  });

  it('stops processing dispatches after destroy', () => {
    const store = createCounterStore();
    const observerFn = vi.fn();
    store.subscribe(observerFn);

    store.destroy();
    store.dispatchSync(increase({ value: 1 }));

    expect(observerFn).not.toHaveBeenCalled();
    expect(store.state.count).toBe(0);
  });

  it('re-runs observers when a reducer mutates the observable state', async () => {
    const store = track(createCounterStore());
    const seen: number[] = [];
    observer(() => {
      seen.push(store.state.count);
    });

    expect(seen).toEqual([0]);

    store.dispatchSync(increase({ value: 7 }));
    await nextTick(() => {});

    expect(seen).toEqual([0, 7]);
  });
});
