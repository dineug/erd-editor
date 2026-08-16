import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { BEFORE_MOUNT, UNMOUNTED } from '@/constants';
import { createContext } from '@/context/createContext';
import { useContext } from '@/context/useContext';
import { useProvider } from '@/context/useProvider';
import { observer } from '@/observable';
import { nextTick } from '@/observable/scheduler';
import { render } from '@/render';
import {
  lifecycleHooks,
  setCurrentInstance,
} from '@/render/part/node/component/hooks';
import {
  Context as Ctx,
  FC,
} from '@/render/part/node/component/observableComponent';
import { html } from '@/template/html';

const created: HTMLElement[] = [];

// useProvider/useContext accept a bare element at runtime (`ctx instanceof
// HTMLElement`), but the declared Ctx<HTMLElement> type also demands `host`.
const asCtx = (el: HTMLElement) => el as unknown as Ctx<HTMLElement>;

const createElement = () => {
  const el = document.createElement('div');
  document.body.append(el);
  created.push(el);
  return el;
};

afterEach(() => {
  setCurrentInstance(null);
  created.splice(0).forEach(el => el.remove());
});

describe('useContext', () => {
  it('falls back to the context default value when nothing provides it', () => {
    const context = createContext('default', 'theme');
    const el = createElement();

    const ref = useContext(asCtx(el), context);

    expect(ref.value).toBe('default');
  });

  it('reads the provided value synchronously on creation', () => {
    const context = createContext('default', 'theme');
    const el = createElement();
    const provider = useProvider(asCtx(el), context, 'dark');

    const ref = useContext(asCtx(el), context);

    expect(ref.value).toBe('dark');

    provider.destroy();
  });

  it('tracks later provider updates', () => {
    const context = createContext(0, 'count');
    const el = createElement();
    const provider = useProvider(asCtx(el), context, 1);

    const ref = useContext(asCtx(el), context);
    provider.set(2);

    expect(ref.value).toBe(2);

    provider.destroy();
  });

  it('returns a reactive observable ref', async () => {
    const context = createContext(0, 'count');
    const el = createElement();
    const provider = useProvider(asCtx(el), context, 1);
    const ref = useContext(asCtx(el), context);

    const seen: number[] = [];
    const unobserve = observer(() => {
      seen.push(ref.value);
    });

    expect(seen).toEqual([1]);

    provider.set(2);
    await nextTick(() => {});

    expect(seen).toEqual([1, 2]);

    unobserve();
    provider.destroy();
  });

  it('bubbles the subscribe request up to an ancestor provider', () => {
    const context = createContext('default', 'theme');
    const ancestor = createElement();
    const parent = document.createElement('div');
    const el = document.createElement('span');
    ancestor.append(parent);
    parent.append(el);
    const provider = useProvider(asCtx(ancestor), context, 'dark');

    const ref = useContext(asCtx(el), context);

    expect(ref.value).toBe('dark');

    provider.destroy();
  });

  it('ignores providers registered for a different context key', () => {
    const context = createContext('default', 'theme');
    const other = createContext('other-default', 'other');
    const el = createElement();
    const provider = useProvider(asCtx(el), other, 'other-value');

    const ref = useContext(asCtx(el), context);

    expect(ref.value).toBe('default');

    provider.destroy();
  });

  it('resubscribes on the before-mount lifecycle hook', () => {
    const context = createContext('default', 'theme');
    const el = createElement();
    const provider = useProvider(asCtx(el), context, 'dark');
    const instance: any = {};

    setCurrentInstance(instance);
    const ref = useContext(asCtx(el), context);
    setCurrentInstance(null);

    provider.set('light');
    expect(ref.value).toBe('light');

    lifecycleHooks(instance, BEFORE_MOUNT);
    expect(ref.value).toBe('dark');

    provider.destroy();
  });

  it('unsubscribes from the provider on the unmounted lifecycle hook', () => {
    const context = createContext(0, 'count');
    const el = createElement();
    const provider = useProvider(asCtx(el), context, 1);
    const instance: any = {};

    setCurrentInstance(instance);
    const ref = useContext(asCtx(el), context);
    setCurrentInstance(null);

    lifecycleHooks(instance, UNMOUNTED);
    provider.set(2);

    expect(ref.value).toBe(1);

    provider.destroy();
  });

  it('resolves the target lazily so a moved ctx unsubscribes from its current parent', () => {
    const context = createContext(0, 'count');
    const firstParent = createElement();
    const secondParent = createElement();
    const firstProvider = useProvider(asCtx(firstParent), context, 1);
    const secondProvider = useProvider(asCtx(secondParent), context, 10);
    const ctx: Ctx<{}> = {
      host: document.body,
      parentElement: firstParent,
      dispatchEvent: (event: Event) => document.body.dispatchEvent(event),
    };
    const instance: any = {};

    setCurrentInstance(instance);
    const ref = useContext(ctx, context);
    setCurrentInstance(null);

    expect(ref.value).toBe(1);

    ctx.parentElement = secondParent;
    lifecycleHooks(instance, UNMOUNTED);

    firstProvider.set(2);
    expect(ref.value).toBe(2);

    lifecycleHooks(instance, BEFORE_MOUNT);
    expect(ref.value).toBe(10);

    firstProvider.destroy();
    secondProvider.destroy();
  });

  it('falls back to ctx.host when the ctx has no parent element', () => {
    const context = createContext('default', 'theme');
    const host = createElement();
    const ctx: Ctx<{}> = {
      host,
      parentElement: null,
      dispatchEvent: vi.fn(() => true),
    };
    const provider = useProvider(asCtx(host), context, 'from-host');

    const ref = useContext(ctx, context);

    expect(ref.value).toBe('from-host');
    expect(ctx.dispatchEvent).not.toHaveBeenCalled();

    provider.destroy();
  });

  it('works inside a rendered functional component', async () => {
    const context = createContext('default', 'theme');
    const container = createElement();
    const provider = useProvider(asCtx(container), context, 'dark');

    const Comp: FC = (_props, ctx) => {
      const ref = useContext<string>(ctx, context);
      return () => html`<span>${ref.value}</span>`;
    };

    render(container, html`<${Comp} />`);
    await nextTick(() => {});

    expect(container.textContent).toContain('dark');

    provider.set('light');
    await nextTick(() => {});
    await nextTick(() => {});

    expect(container.textContent).toContain('light');

    render(container, null);
    provider.destroy();
  });
});
