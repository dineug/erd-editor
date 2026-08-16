import { AnyAction, createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import type { Hook, HookEffect } from '@/engine/hooks';
import * as hooksModule from '@/engine/hooks';
import { hooks as tableHooks } from '@/engine/modules/table/hooks';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';

const pingAction = createAction<{ value: number }>('test.ping');

describe('hooks module', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(hooksModule)).toEqual([]);
  });
});

describe('HookEffect contract', () => {
  it('receives the action stream, a state getter and the engine context', () => {
    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    const received: AnyAction[] = [];
    let seenState: RootState | null = null;
    let seenWidth = -1;

    const effect: HookEffect = (action$, getState, ctx) =>
      action$.subscribe(action => {
        received.push(action);
        seenState = getState();
        seenWidth = ctx.toWidth('abc');
      });

    const action$ = new Subject<AnyAction>();
    const ctx: EngineContext = store.context;
    const subscription = effect(action$, () => store.state, ctx);

    action$.next(pingAction({ value: 1 }));

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('test.ping');
    expect(received[0].payload).toEqual({ value: 1 });
    expect(seenState).toBe(store.state);
    expect(seenWidth).toBe(30);

    subscription.unsubscribe();
    store.destroy();
  });

  it('stops receiving actions once its subscription is torn down', () => {
    const seen: string[] = [];
    const effect: HookEffect = action$ =>
      action$.subscribe(action => {
        seen.push(action.type);
      });

    const action$ = new Subject<AnyAction>();
    const subscription = effect(
      action$,
      () => ({}) as RootState,
      {} as EngineContext
    );

    action$.next(pingAction({ value: 1 }));
    subscription.unsubscribe();
    action$.next(pingAction({ value: 2 }));

    expect(subscription.closed).toBe(true);
    expect(seen).toEqual(['test.ping']);
  });
});

describe('Hook contract', () => {
  it('pairs an action pattern with an effect', () => {
    const seen: string[] = [];
    const effect: HookEffect = action$ =>
      action$.subscribe(action => {
        seen.push(action.type);
      });
    const hook: Hook = [[pingAction, 'test.other'], effect];

    const [pattern, hookEffect] = hook;

    expect(pattern.map(String)).toEqual(['test.ping', 'test.other']);
    expect(hookEffect).toBe(effect);

    const has = arrayHas(pattern.map(String));
    expect(has('test.ping')).toBe(true);
    expect(has('test.other')).toBe(true);
    expect(has('test.unknown')).toBe(false);

    const action$ = new Subject<AnyAction>();
    const subscription = hookEffect(
      action$,
      () => ({}) as RootState,
      {} as EngineContext
    );
    action$.next(pingAction({ value: 2 }));
    subscription.unsubscribe();

    expect(seen).toEqual(['test.ping']);
  });

  it('is the shape the table module already ships', () => {
    expect(tableHooks.length).toBeGreaterThan(0);

    for (const [pattern, effect] of tableHooks) {
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBeGreaterThan(0);
      expect(typeof effect).toBe('function');
      for (const entry of pattern) {
        expect(typeof String(entry)).toBe('string');
        expect(String(entry)).not.toBe('');
      }
    }

    expect(tableHooks[0][0].map(String)).toEqual([
      'editor.loadJson',
      'editor.initialLoadJson',
    ]);
  });
});
