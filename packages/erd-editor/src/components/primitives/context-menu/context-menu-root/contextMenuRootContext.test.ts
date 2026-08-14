import { FC, html } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import {
  ContextMenuRootContext,
  contextMenuRootContext,
  useContextMenuRootContext,
  useContextMenuRootProvider,
} from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

type Api = ReturnType<typeof useContextMenuRootProvider>;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const Consumer: FC<{}> = (props, ctx) => {
  const root = useContextMenuRootContext(ctx);
  return () => html`
    <span class="consumer"
      >${`${root.value.show}:${root.value.x}:${root.value.y}`}</span
    >
  `;
};

function createHost() {
  let api: Api | null = null;

  const Host: FC<{}> = (props, ctx) => {
    api = useContextMenuRootProvider(ctx);

    return () => html`
      <div
        class="host"
        @contextmenu=${(api as Api).onContextmenu}
        @mousedown=${(api as Api).onMousedown}
      >
        <div class="outside">outside</div>
        <div class="context-menu-content">
          <div class="inside">inside</div>
        </div>
        <${Consumer} />
      </div>
    `;
  };

  return { Host, getApi: () => api as Api };
}

describe('contextMenuRootContext', () => {
  it('exposes a closed context with a change subject as the default value', () => {
    const value = contextMenuRootContext.value;

    expect(value.show).toBe(false);
    expect(value.x).toBe(0);
    expect(value.y).toBe(0);
    expect(value.change$).toBeInstanceOf(Subject);
    expect(typeof contextMenuRootContext.key).toBe('symbol');
  });

  it('provides an independent observable state per provider call', async () => {
    const a = createHost();
    const b = createHost();

    mounted = await mountAndFlush(html`<${a.Host} /><${b.Host} />`);

    expect(a.getApi().state).not.toBe(b.getApi().state);
    expect(a.getApi().state.change$).not.toBe(b.getApi().state.change$);
    expect(a.getApi().provider).toBeTruthy();
    expect(typeof a.getApi().provider.destroy).toBe('function');
  });

  it('pushes the provided state down to consumers', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const consumer = mounted.container.querySelector(
      '.consumer'
    ) as HTMLElement;
    expect(consumer.textContent).toBe('false:0:0');

    const state = getApi().state;
    state.show = true;
    state.x = 12;
    state.y = 34;
    await flush();

    expect(consumer.textContent).toBe('true:12:34');
  });

  it('opens at the pointer position on contextmenu and cancels the native menu', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const host = mounted.container.querySelector('.host') as HTMLElement;
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 111,
      clientY: 222,
    });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(getApi().state.x).toBe(111);
    expect(getApi().state.y).toBe(222);

    await flush();
    expect(getApi().state.show).toBe(true);
  });

  it('forces a close/open cycle so an already open menu remounts at the new position', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const state = getApi().state;
    state.show = true;
    await flush();

    const host = mounted.container.querySelector('.host') as HTMLElement;
    host.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 5,
        clientY: 6,
      })
    );

    expect(state.show).toBe(false);

    await flush();
    expect(state.show).toBe(true);
    expect(state.x).toBe(5);
    expect(state.y).toBe(6);
  });

  it('closes on mousedown outside the context menu content', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const state = getApi().state;
    state.show = true;
    await flush();

    const outside = mounted.container.querySelector('.outside') as HTMLElement;
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(state.show).toBe(false);
  });

  it('keeps the menu open on mousedown inside the context menu content', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const state = getApi().state;
    state.show = true;
    await flush();

    const inside = mounted.container.querySelector('.inside') as HTMLElement;
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(state.show).toBe(true);
  });

  it('ignores a mousedown event without a target', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const state = getApi().state;
    state.show = true;
    await flush();

    getApi().onMousedown({ target: null } as unknown as MouseEvent);

    expect(state.show).toBe(true);
  });

  it('broadcasts submenu changes through change$', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const spy = vi.fn();
    const subscription = getApi().state.change$.subscribe(spy);
    const payload: Parameters<ContextMenuRootContext['change$']['next']>[0] = {
      parentId: 'root',
      id: 'item-1',
    };
    getApi().state.change$.next(payload);
    subscription.unsubscribe();

    expect(spy).toHaveBeenCalledWith(payload);
  });
});
