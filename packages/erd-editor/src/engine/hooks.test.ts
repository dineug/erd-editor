import { cancel, channel, go, put, take } from '@dineug/go';
import { AnyAction, createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import type { CO, Hook } from '@/engine/hooks';
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

describe('CO contract', () => {
  it('receives the channel, a state getter and the engine context', async () => {
    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    const received: AnyAction[] = [];
    let seenState: RootState | null = null;
    let seenWidth = -1;

    const co: CO = function* (ch, getState, ctx) {
      const action: AnyAction = yield take(ch);
      received.push(action);
      seenState = getState();
      seenWidth = ctx.toWidth('abc');
    };

    const ch = channel<AnyAction>();
    const ctx: EngineContext = store.context;
    const proc = go(co, ch, () => store.state, ctx);

    put(ch, pingAction({ value: 1 }));
    await proc;

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('test.ping');
    expect(received[0].payload).toEqual({ value: 1 });
    expect(seenState).toBe(store.state);
    expect(seenWidth).toBe(30);
    store.destroy();
  });

  it('can be cancelled while it is parked on the channel', async () => {
    const co: CO = function* (ch) {
      while (true) {
        yield take(ch);
      }
    };

    const ch = channel<AnyAction>();
    const proc = go(co, ch, () => ({}) as RootState, {} as EngineContext);

    cancel(proc);

    await expect(proc).rejects.toBeDefined();
  });
});

describe('Hook contract', () => {
  it('pairs an action pattern with a coroutine', async () => {
    const seen: string[] = [];
    const co: CO = function* (ch) {
      const action: AnyAction = yield take(ch);
      seen.push(action.type);
    };
    const hook: Hook = [[pingAction, 'test.other'], co];

    const [pattern, hookCo] = hook;

    expect(pattern.map(String)).toEqual(['test.ping', 'test.other']);
    expect(hookCo).toBe(co);

    const has = arrayHas(pattern.map(String));
    expect(has('test.ping')).toBe(true);
    expect(has('test.other')).toBe(true);
    expect(has('test.unknown')).toBe(false);

    const ch = channel<AnyAction>();
    const proc = go(hookCo, ch, () => ({}) as RootState, {} as EngineContext);
    put(ch, pingAction({ value: 2 }));
    await proc;

    expect(seen).toEqual(['test.ping']);
  });

  it('is the shape the table module already ships', () => {
    expect(tableHooks.length).toBeGreaterThan(0);

    for (const [pattern, co] of tableHooks) {
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBeGreaterThan(0);
      expect(typeof co).toBe('function');
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
