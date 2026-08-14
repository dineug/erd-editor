import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type ContextEventDetail,
  contextSubscribeEvent,
  contextUnsubscribeEvent,
  createContext,
} from '@/context/createContext';
import { useProvider } from '@/context/useProvider';
import { Context as Ctx } from '@/render/part/node/component/observableComponent';

const created: HTMLElement[] = [];

// useProvider/useContext accept a bare element at runtime (`ctx instanceof
// HTMLElement`), but the declared Ctx<HTMLElement> type also demands `host`.
const asCtx = (el: HTMLElement) => el as unknown as Ctx<HTMLElement>;

const createElement = (tag = 'div') => {
  const el = document.createElement(tag);
  document.body.append(el);
  created.push(el);
  return el;
};

const subscribe = (target: EventTarget, detail: ContextEventDetail<any>) =>
  target.dispatchEvent(contextSubscribeEvent(detail));

const unsubscribe = (target: EventTarget, detail: ContextEventDetail<any>) =>
  target.dispatchEvent(contextUnsubscribeEvent(detail));

afterEach(() => {
  created.splice(0).forEach(el => el.remove());
});

describe('useProvider', () => {
  it('answers a matching subscribe event with the current value', () => {
    const context = createContext('default', 'theme');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 'dark');
    const observer = vi.fn();

    subscribe(host, { context, observer });

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith('dark');

    provider.destroy();
  });

  it('pushes every set() to subscribed observers', () => {
    const context = createContext(0, 'count');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 1);
    const a = vi.fn();
    const b = vi.fn();

    subscribe(host, { context, observer: a });
    subscribe(host, { context, observer: b });
    provider.set(2);
    provider.set(3);

    expect(a.mock.calls).toEqual([[1], [2], [3]]);
    expect(b.mock.calls).toEqual([[1], [2], [3]]);

    provider.destroy();
  });

  it('keeps serving the initial value on later subscriptions, not the last set value', () => {
    const context = createContext(0, 'count');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 1);
    const late = vi.fn();

    provider.set(99);
    subscribe(host, { context, observer: late });

    expect(late).toHaveBeenCalledWith(1);

    provider.destroy();
  });

  it('stops propagation of a handled subscribe event', () => {
    const context = createContext('default', 'theme');
    const grandParent = createElement();
    const host = document.createElement('div');
    const child = document.createElement('span');
    grandParent.append(host);
    host.append(child);

    const provider = useProvider(asCtx(host), context, 'dark');
    const outer = vi.fn();
    grandParent.addEventListener(contextSubscribeEvent.type, outer);

    subscribe(child, { context, observer: vi.fn() });

    expect(outer).not.toHaveBeenCalled();

    provider.destroy();
  });

  it('ignores events for another context key', () => {
    const context = createContext('a', 'a-key');
    const other = createContext('b', 'b-key');
    const grandParent = createElement();
    const host = document.createElement('div');
    grandParent.append(host);

    const provider = useProvider(asCtx(host), context, 'a-value');
    const observer = vi.fn();
    const outer = vi.fn();
    grandParent.addEventListener(contextSubscribeEvent.type, outer);

    subscribe(host, { context: other, observer });

    expect(observer).not.toHaveBeenCalled();
    expect(outer).toHaveBeenCalledTimes(1);

    provider.destroy();
  });

  it('ignores events without a context detail', () => {
    const context = createContext('a', 'a-key');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 'a-value');

    expect(() =>
      host.dispatchEvent(
        new CustomEvent(contextSubscribeEvent.type, { bubbles: true })
      )
    ).not.toThrow();
    expect(() =>
      host.dispatchEvent(
        new CustomEvent(contextUnsubscribeEvent.type, {
          bubbles: true,
          detail: {},
        })
      )
    ).not.toThrow();

    provider.destroy();
  });

  it('detaches a single observer on unsubscribe and leaves the others', () => {
    const context = createContext(0, 'count');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 1);
    const a = vi.fn();
    const b = vi.fn();

    subscribe(host, { context, observer: a });
    subscribe(host, { context, observer: b });
    unsubscribe(host, { context, observer: a });
    provider.set(2);

    expect(a.mock.calls).toEqual([[1]]);
    expect(b.mock.calls).toEqual([[1], [2]]);

    provider.destroy();
  });

  it('tolerates unsubscribing an observer that was never subscribed', () => {
    const context = createContext(0, 'count');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 1);
    const unknown = vi.fn();

    expect(() =>
      unsubscribe(host, { context, observer: unknown })
    ).not.toThrow();
    provider.set(2);

    expect(unknown).not.toHaveBeenCalled();

    provider.destroy();
  });

  it('stops propagation of a handled unsubscribe event', () => {
    const context = createContext(0, 'count');
    const grandParent = createElement();
    const host = document.createElement('div');
    grandParent.append(host);
    const provider = useProvider(asCtx(host), context, 1);
    const outer = vi.fn();
    grandParent.addEventListener(contextUnsubscribeEvent.type, outer);

    unsubscribe(host, { context, observer: vi.fn() });

    expect(outer).not.toHaveBeenCalled();

    provider.destroy();
  });

  it('destroy() removes listeners and detaches every observer', () => {
    const context = createContext(0, 'count');
    const host = createElement();
    const provider = useProvider(asCtx(host), context, 1);
    const a = vi.fn();
    const b = vi.fn();
    subscribe(host, { context, observer: a });
    subscribe(host, { context, observer: b });

    provider.destroy();
    provider.set(2);

    expect(a.mock.calls).toEqual([[1]]);
    expect(b.mock.calls).toEqual([[1]]);

    const late = vi.fn();
    subscribe(host, { context, observer: late });
    expect(late).not.toHaveBeenCalled();
  });

  it('binds to ctx.parentElement when the ctx is not an element', () => {
    const context = createContext('default', 'theme');
    const parentElement = createElement();
    const host = createElement();
    const ctx: Ctx<{}> = {
      host,
      parentElement,
      dispatchEvent: (event: Event) => parentElement.dispatchEvent(event),
    };

    const provider = useProvider(ctx, context, 'from-parent');
    const observer = vi.fn();

    subscribe(parentElement, { context, observer });
    expect(observer).toHaveBeenCalledWith('from-parent');

    const hostObserver = vi.fn();
    subscribe(host, { context, observer: hostObserver });
    expect(hostObserver).not.toHaveBeenCalled();

    provider.destroy();
  });

  it('falls back to ctx.host when parentElement is null', () => {
    const context = createContext('default', 'theme');
    const host = createElement();
    const ctx: Ctx<{}> = {
      host,
      parentElement: null,
      dispatchEvent: (event: Event) => host.dispatchEvent(event),
    };

    const provider = useProvider(ctx, context, 'from-host');
    const observer = vi.fn();

    subscribe(host, { context, observer });
    expect(observer).toHaveBeenCalledWith('from-host');

    provider.destroy();
  });
});
