import {
  DOMTemplateLiterals,
  FC,
  html,
  observable,
  useProvider,
} from '@dineug/r-html';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuItem from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem';
import * as styles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import {
  contextMenuRootContext,
  useContextMenuRootProvider,
} from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

type Api = ReturnType<typeof useContextMenuRootProvider>;
type HostProps = { children?: DOMTemplateLiterals };

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function createHost(parentId: string | null = 'root') {
  let api: Api | null = null;

  const Host: FC<HostProps> = (props, ctx) => {
    api = useContextMenuRootProvider(ctx);

    return () =>
      parentId === null
        ? html`<div class="parent">${props.children}</div>`
        : html`<div class="parent" data-id=${parentId}>${props.children}</div>`;
  };

  return { Host, getApi: () => api as Api };
}

const itemsOf = (m: Mounted) =>
  Array.from(
    m.container.querySelectorAll<HTMLElement>(`.${String(styles.item)}`)
  );

const contentsOf = (m: Mounted) =>
  Array.from(
    m.container.querySelectorAll<HTMLElement>('.context-menu-content')
  );

function stubRect(
  el: HTMLElement,
  rect: { width: number; x: number; y: number }
) {
  el.getBoundingClientRect = () =>
    ({
      width: rect.width,
      height: 32,
      x: rect.x,
      y: rect.y,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + 32,
      toJSON: () => ({}),
    }) as DOMRect;
}

const mouseenter = (el: HTMLElement) =>
  el.dispatchEvent(new MouseEvent('mouseenter'));

describe('ContextMenuItem', () => {
  it('renders its children in a styled row carrying a generated data-id', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem} children=${'Copy'} />`}
      />`
    );

    const [item] = itemsOf(mounted);
    expect(item).toBeTruthy();
    expect(item.textContent).toContain('Copy');
    expect(item.dataset.id).toBeTruthy();
    expect(item.classList.contains('selected')).toBe(false);
  });

  it('gives every item a unique id', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`
          <${ContextMenuItem} children=${'A'} />
          <${ContextMenuItem} children=${'B'} />
        `}
      />`
    );

    const ids = itemsOf(mounted).map(item => item.dataset.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('invokes onClick when the row is clicked', async () => {
    const onClick = vi.fn();
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Copy'}
          .onClick=${onClick}
        />`}
      />`
    );

    const [item] = itemsOf(mounted);
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('stays inert when clicked without an onClick prop', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem} children=${'Copy'} />`}
      />`
    );

    const [item] = itemsOf(mounted);
    expect(() =>
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ).not.toThrow();
  });

  it('renders no submenu on hover when subChildren is absent', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem} children=${'Copy'} />`}
      />`
    );

    mouseenter(itemsOf(mounted)[0]);
    await flush();

    expect(contentsOf(mounted)).toHaveLength(0);
  });

  it('opens the submenu on hover, anchored to the right edge and 8px above the row', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Submenu'}
          subChildren=${html`<span class="sub">Sub</span>`}
        />`}
      />`
    );

    const [item] = itemsOf(mounted);
    stubRect(item, { width: 160, x: 40, y: 100 });
    mouseenter(item);
    await flush();

    const [content] = contentsOf(mounted);
    expect(content).toBeTruthy();
    expect(content.dataset.id).toBe(item.dataset.id);
    expect(content.style.left).toBe('200px');
    expect(content.style.top).toBe('92px');
    expect(content.querySelector('.sub')).toBeTruthy();
  });

  it('announces the hover on change$ using the enclosing content id', async () => {
    const { Host, getApi } = createHost('root');
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem} children=${'Copy'} />`}
      />`
    );

    const spy = vi.fn();
    const subscription = getApi().state.change$.subscribe(spy);

    const [item] = itemsOf(mounted);
    mouseenter(item);
    await flush();
    subscription.unsubscribe();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      parentId: 'root',
      id: item.dataset.id,
    });
  });

  it('skips the announcement when the enclosing element has no data-id', async () => {
    const { Host, getApi } = createHost(null);
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Submenu'}
          subChildren=${html`<span class="sub">Sub</span>`}
        />`}
      />`
    );

    const spy = vi.fn();
    const subscription = getApi().state.change$.subscribe(spy);

    mouseenter(itemsOf(mounted)[0]);
    await flush();
    subscription.unsubscribe();

    expect(spy).not.toHaveBeenCalled();
    expect(contentsOf(mounted)).toHaveLength(1);
  });

  it('closes a sibling submenu when another item in the same content is hovered', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`
          <${ContextMenuItem}
            children=${'First'}
            subChildren=${html`<span class="sub-a">A</span>`}
          />
          <${ContextMenuItem}
            children=${'Second'}
            subChildren=${html`<span class="sub-b">B</span>`}
          />
        `}
      />`
    );

    const [first, second] = itemsOf(mounted);

    mouseenter(first);
    await flush();
    expect(mounted.container.querySelector('.sub-a')).toBeTruthy();

    mouseenter(second);
    await flush();

    expect(mounted.container.querySelector('.sub-a')).toBeNull();
    expect(mounted.container.querySelector('.sub-b')).toBeTruthy();
  });

  it('marks an item selected while one of its own submenu rows is hovered', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Submenu'}
          subChildren=${html`<${ContextMenuItem} children=${'Nested'} />`}
        />`}
      />`
    );

    const [parent] = itemsOf(mounted);
    mouseenter(parent);
    await flush();

    const nested = itemsOf(mounted).find(
      item => item.dataset.id !== parent.dataset.id
    ) as HTMLElement;
    expect(nested).toBeTruthy();

    mouseenter(nested);
    await flush();

    expect(parent.classList.contains('selected')).toBe(true);
  });

  it('clears the selected flag once the hover moves back to a sibling row', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`
          <${ContextMenuItem}
            children=${'Submenu'}
            subChildren=${html`<${ContextMenuItem} children=${'Nested'} />`}
          />
          <${ContextMenuItem} children=${'Plain'} />
        `}
      />`
    );

    const [parent] = itemsOf(mounted);
    mouseenter(parent);
    await flush();

    const nested = itemsOf(mounted).find(
      item =>
        item.dataset.id !== parent.dataset.id &&
        item.textContent?.includes('Nested')
    ) as HTMLElement;
    mouseenter(nested);
    await flush();
    expect(parent.classList.contains('selected')).toBe(true);

    getApi().state.change$.next({ parentId: 'root', id: parent.dataset.id! });
    await flush();

    expect(parent.classList.contains('selected')).toBe(false);
  });

  it('unsubscribes from change$ when the item is removed from the tree', async () => {
    // A plain (non observable) context value is used here so that rxjs
    // bookkeeping such as `observed` stays readable; reading `change$` through
    // the observable proxy hands back a proxied Subject whose `observed` flag
    // no longer tracks removals.
    const change$ = new Subject<{ parentId: string; id: string }>();
    const toggle = observable({ visible: true });

    const Host: FC<HostProps> = (props, ctx) => {
      useProvider(ctx, contextMenuRootContext, {
        show: true,
        x: 0,
        y: 0,
        change$,
      });

      return () => html`
        <div class="parent" data-id="root">
          ${toggle.visible ? props.children : null}
        </div>
      `;
    };

    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Submenu'}
          subChildren=${html`<span class="sub">Sub</span>`}
        />`}
      />`
    );

    expect(change$.observed).toBe(true);

    toggle.visible = false;
    await flush();

    expect(itemsOf(mounted)).toHaveLength(0);
    expect(change$.observed).toBe(false);
  });

  it('tolerates change$ traffic while the row is detached from a content parent', async () => {
    const change$ = new Subject<{ parentId: string; id: string }>();

    const Host: FC<HostProps> = (props, ctx) => {
      useProvider(ctx, contextMenuRootContext, {
        show: true,
        x: 0,
        y: 0,
        change$,
      });

      return () => html`<div class="parent">${props.children}</div>`;
    };

    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenuItem}
          children=${'Submenu'}
          subChildren=${html`<span class="sub">Sub</span>`}
        />`}
      />`
    );

    const [item] = itemsOf(mounted);
    expect(() =>
      change$.next({ parentId: 'somewhere-else', id: 'other' })
    ).not.toThrow();
    await flush();

    expect(item.classList.contains('selected')).toBe(false);
    expect(contentsOf(mounted)).toHaveLength(0);
  });
});
