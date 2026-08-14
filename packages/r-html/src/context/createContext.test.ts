import { describe, expect, it, vi } from 'vitest';

import {
  type ContextEventDetail,
  ContextInternalEventType,
  contextSubscribeEvent,
  contextUnsubscribeEvent,
  createContext,
  fragmentContextBridge,
} from '@/context/createContext';

describe('createContext', () => {
  it('creates a frozen context with a unique symbol key by default', () => {
    const a = createContext(10);
    const b = createContext(10);

    expect(a.value).toBe(10);
    expect(typeof a.key).toBe('symbol');
    expect(a.key).not.toBe(b.key);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('does not mutate a frozen context', () => {
    const context = createContext<number>(1, 'frozen-key');

    expect(() => {
      (context as any).value = 2;
    }).toThrow();
    expect(context.value).toBe(1);
  });

  it('uses the given string key', () => {
    const context = createContext({ theme: 'dark' }, 'theme-context');

    expect(context.key).toBe('theme-context');
    expect(context.value).toEqual({ theme: 'dark' });
  });

  it('uses the given symbol key', () => {
    const key = Symbol('shared');
    const context = createContext(null, key);

    expect(context.key).toBe(key);
    expect(context.value).toBeNull();
  });
});

describe('ContextInternalEventType', () => {
  it('exposes the internal event names', () => {
    expect(ContextInternalEventType).toEqual({
      subscribe: '@@r-html/context-subscribe',
      unsubscribe: '@@r-html/context-unsubscribe',
    });
  });
});

describe('context internal events', () => {
  const detail = (): ContextEventDetail<number> => ({
    context: createContext(1, 'k'),
    observer: () => {},
  });

  it('creates a bubbling, composed subscribe event carrying the detail', () => {
    const payload = detail();
    const event = contextSubscribeEvent(payload);

    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe(ContextInternalEventType.subscribe);
    expect(event.detail).toBe(payload);
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('creates a bubbling, composed unsubscribe event carrying the detail', () => {
    const payload = detail();
    const event = contextUnsubscribeEvent(payload);

    expect(event.type).toBe(ContextInternalEventType.unsubscribe);
    expect(event.detail).toBe(payload);
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('lets caller options override the default event options', () => {
    const event = contextSubscribeEvent(detail(), {
      bubbles: false,
      composed: false,
    });

    expect(event.bubbles).toBe(false);
    expect(event.composed).toBe(false);
  });

  it('exposes the type as a static property and via toString', () => {
    expect(contextSubscribeEvent.type).toBe(ContextInternalEventType.subscribe);
    expect(`${contextSubscribeEvent}`).toBe(ContextInternalEventType.subscribe);
    expect(contextUnsubscribeEvent.toString()).toBe(
      ContextInternalEventType.unsubscribe
    );
  });
});

describe('fragmentContextBridge', () => {
  it('re-dispatches subscribe and unsubscribe events from the fragment to the root', () => {
    const fragment = document.createDocumentFragment();
    const root = document.createElement('div');
    const child = document.createElement('span');
    fragment.append(child);

    const subscribeSpy = vi.fn();
    const unsubscribeSpy = vi.fn();
    root.addEventListener(contextSubscribeEvent.type, subscribeSpy);
    root.addEventListener(contextUnsubscribeEvent.type, unsubscribeSpy);

    const dispose = fragmentContextBridge(fragment, root);

    const subscribeDetail: ContextEventDetail<number> = {
      context: createContext(1, 'bridge'),
      observer: () => {},
    };
    child.dispatchEvent(contextSubscribeEvent(subscribeDetail));

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy.mock.calls[0][0].detail).toBe(subscribeDetail);
    expect(subscribeSpy.mock.calls[0][0].target).toBe(root);

    const unsubscribeDetail: ContextEventDetail<number> = {
      context: createContext(2, 'bridge'),
      observer: () => {},
    };
    child.dispatchEvent(contextUnsubscribeEvent(unsubscribeDetail));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy.mock.calls[0][0].detail).toBe(unsubscribeDetail);

    dispose();
  });

  it('stops forwarding once the returned disposer runs', () => {
    const fragment = document.createDocumentFragment();
    const root = document.createElement('div');
    const subscribeSpy = vi.fn();
    const unsubscribeSpy = vi.fn();
    root.addEventListener(contextSubscribeEvent.type, subscribeSpy);
    root.addEventListener(contextUnsubscribeEvent.type, unsubscribeSpy);

    const dispose = fragmentContextBridge(fragment, root);
    dispose();

    const payload: ContextEventDetail<number> = {
      context: createContext(1, 'bridge'),
      observer: () => {},
    };
    fragment.dispatchEvent(contextSubscribeEvent(payload));
    fragment.dispatchEvent(contextUnsubscribeEvent(payload));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });
});
