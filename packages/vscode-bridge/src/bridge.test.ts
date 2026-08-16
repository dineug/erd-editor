import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { type AnyAction, Bridge, createCommand } from '@/bridge';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCommand', () => {
  it('creates a command object holding only the given type', () => {
    const command = createCommand<{ value: string }>('foo');

    expect(command).toEqual({ type: 'foo' });
    expect(Object.keys(command)).toEqual(['type']);
  });

  it('creates a distinct object per call even for the same type', () => {
    const a = createCommand('same');
    const b = createCommand('same');

    expect(a).not.toBe(b);
    expect(a.type).toBe(b.type);
  });

  it('supports an empty string type', () => {
    expect(createCommand('').type).toBe('');
  });
});

describe('Bridge.executeCommand', () => {
  it('builds an action from the command type and the payload', () => {
    const command = createCommand<{ value: number }>('bar');

    expect(Bridge.executeCommand(command, { value: 1 })).toEqual({
      type: 'bar',
      payload: { value: 1 },
    });
  });

  it('passes a void payload through as undefined', () => {
    const command = createCommand('void-command');
    const action = Bridge.executeCommand(command, undefined as never);

    expect(action.type).toBe('void-command');
    expect(action.payload).toBeUndefined();
  });

  it('keeps the payload reference identity', () => {
    const payload = { actions: [1, 2, 3] };
    const command = createCommand<typeof payload>('ref');

    expect(Bridge.executeCommand(command, payload).payload).toBe(payload);
  });
});

describe('Bridge.mergeRegister', () => {
  it('returns a dispose that calls every disposable in order', () => {
    const calls: string[] = [];
    const a = vi.fn(() => calls.push('a'));
    const b = vi.fn(() => calls.push('b'));

    const dispose = Bridge.mergeRegister(a, b);

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();

    dispose();

    expect(calls).toEqual(['a', 'b']);
  });

  it('calls each disposable again on repeated dispose calls', () => {
    const a = vi.fn();
    const dispose = Bridge.mergeRegister(a);

    dispose();
    dispose();

    expect(a).toHaveBeenCalledTimes(2);
  });

  it('supports being called with no disposables', () => {
    expect(() => Bridge.mergeRegister()()).not.toThrow();
  });

  it('propagates an error thrown by a disposable and skips the rest', () => {
    const boom = vi.fn(() => {
      throw new Error('boom');
    });
    const after = vi.fn();

    expect(() => Bridge.mergeRegister(boom, after)()).toThrowError('boom');
    expect(after).not.toHaveBeenCalled();
  });
});

describe('Bridge#registerCommand / executeAction', () => {
  it('dispatches the payload to a registered listener', () => {
    const bridge = new Bridge();
    const command = createCommand<{ value: string }>('cmd');
    const listener = vi.fn();

    bridge.registerCommand(command, listener);
    bridge.executeAction(Bridge.executeCommand(command, { value: 'hi' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 'hi' });
  });

  it('dispatches to every listener registered for the same type', () => {
    const bridge = new Bridge();
    const command = createCommand<number>('multi');
    const first = vi.fn();
    const second = vi.fn();

    bridge.registerCommand(command, first);
    bridge.registerCommand(command, second);
    bridge.executeAction({ type: 'multi', payload: 7 });

    expect(first).toHaveBeenCalledWith(7);
    expect(second).toHaveBeenCalledWith(7);
  });

  it('deduplicates the same listener instance registered twice', () => {
    const bridge = new Bridge();
    const command = createCommand<number>('dedupe');
    const listener = vi.fn();

    bridge.registerCommand(command, listener);
    bridge.registerCommand(command, listener);
    bridge.executeAction({ type: 'dedupe', payload: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('matches listeners by type, not by command identity', () => {
    const bridge = new Bridge();
    const listener = vi.fn();

    bridge.registerCommand(createCommand<number>('shared-type'), listener);
    bridge.executeAction(
      Bridge.executeCommand(createCommand<number>('shared-type'), 42)
    );

    expect(listener).toHaveBeenCalledWith(42);
  });

  it('does not notify listeners of a different type', () => {
    const bridge = new Bridge();
    const listener = vi.fn();

    bridge.registerCommand(createCommand('a'), listener);
    bridge.executeAction({ type: 'b', payload: null });

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores an action whose type has no listeners at all', () => {
    const bridge = new Bridge();

    expect(() =>
      bridge.executeAction({ type: 'unknown', payload: 1 })
    ).not.toThrow();
  });

  it('stops notifying a listener after its dispose runs', () => {
    const bridge = new Bridge();
    const command = createCommand<number>('disposable');
    const listener = vi.fn();

    const dispose = bridge.registerCommand(command, listener);
    bridge.executeAction({ type: 'disposable', payload: 1 });
    dispose();
    bridge.executeAction({ type: 'disposable', payload: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('disposes only the targeted listener when several share a type', () => {
    const bridge = new Bridge();
    const command = createCommand<number>('partial');
    const kept = vi.fn();
    const removed = vi.fn();

    bridge.registerCommand(command, kept);
    const dispose = bridge.registerCommand(command, removed);
    dispose();
    bridge.executeAction({ type: 'partial', payload: 3 });

    expect(kept).toHaveBeenCalledWith(3);
    expect(removed).not.toHaveBeenCalled();
  });

  it('is idempotent when dispose is called more than once', () => {
    const bridge = new Bridge();
    const command = createCommand('idempotent');
    const listener = vi.fn();

    const dispose = bridge.registerCommand(command, listener);
    dispose();

    expect(() => dispose()).not.toThrow();

    bridge.executeAction({ type: 'idempotent', payload: undefined });

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps listener sets isolated between bridge instances', () => {
    const a = new Bridge();
    const b = new Bridge();
    const command = createCommand<number>('isolated');
    const listener = vi.fn();

    a.registerCommand(command, listener);
    b.executeAction({ type: 'isolated', payload: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('swallows a listener error and still runs the remaining listeners', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = new Bridge();
    const command = createCommand<number>('throws');
    const failing = vi.fn(() => {
      throw new Error('listener failure');
    });
    const next = vi.fn();

    bridge.registerCommand(command, failing);
    bridge.registerCommand(command, next);

    expect(() =>
      bridge.executeAction({ type: 'throws', payload: 1 })
    ).not.toThrow();
    expect(next).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'ignored'],
    ['a number', 1],
  ])('ignores %s instead of an action object', (_label, value) => {
    const bridge = new Bridge();
    const listener = vi.fn();

    bridge.registerCommand(createCommand('guard'), listener);

    expect(() =>
      bridge.executeAction(value as unknown as AnyAction)
    ).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores an object whose type is not a string', () => {
    const bridge = new Bridge();
    const listener = vi.fn();

    bridge.registerCommand(createCommand('guard'), listener);
    bridge.executeAction({ type: 1, payload: 1 } as unknown as AnyAction);

    expect(listener).not.toHaveBeenCalled();
  });

  it('accepts an action object without a payload property', () => {
    const bridge = new Bridge();
    const listener = vi.fn();

    bridge.registerCommand(createCommand('no-payload'), listener);
    bridge.executeAction({ type: 'no-payload' } as unknown as AnyAction);

    expect(listener).toHaveBeenCalledWith(undefined);
  });
});
