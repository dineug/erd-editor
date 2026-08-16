import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuRoot from '@/components/primitives/context-menu/context-menu-root/ContextMenuRoot';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

type Api = ReturnType<typeof useContextMenuRootProvider>;
type HostProps = { children?: DOMTemplateLiterals };

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function createHost() {
  let api: Api | null = null;

  const Host: FC<HostProps> = (props, ctx) => {
    api = useContextMenuRootProvider(ctx);

    return () => html`
      <div class="host">
        <${ContextMenuRoot} children=${props.children} />
      </div>
    `;
  };

  return { Host, getApi: () => api as Api };
}

const contentOf = (m: Mounted) =>
  m.container.querySelector('.context-menu-content') as HTMLElement | null;

describe('ContextMenuRoot', () => {
  it('renders nothing while the root context is closed', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host} children=${html`<span class="child">x</span>`} />`
    );

    expect(contentOf(mounted)).toBeNull();
    expect(mounted.container.querySelector('.child')).toBeNull();
  });

  it('renders the content with the id "root" once the context opens', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    getApi().state.show = true;
    await flush();

    const content = contentOf(mounted);
    expect(content).toBeTruthy();
    expect((content as HTMLElement).dataset.id).toBe('root');
  });

  it('forwards the context x and y onto the content position', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);

    const state = getApi().state;
    state.x = 42;
    state.y = 84;
    state.show = true;
    await flush();

    const content = contentOf(mounted) as HTMLElement;
    expect(content.style.left).toBe('42px');
    expect(content.style.top).toBe('84px');
  });

  it('projects children into the opened content', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(
      html`<${Host} children=${html`<span class="child">Item</span>`} />`
    );

    getApi().state.show = true;
    await flush();

    const child = (contentOf(mounted) as HTMLElement).querySelector(
      '.child'
    ) as HTMLElement;
    expect(child).toBeTruthy();
    expect(child.textContent).toBe('Item');
  });

  it('tears the content down again when the context closes', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(
      html`<${Host} children=${html`<span class="child">Item</span>`} />`
    );

    getApi().state.show = true;
    await flush();
    expect(contentOf(mounted)).toBeTruthy();

    getApi().state.show = false;
    await flush();
    expect(contentOf(mounted)).toBeNull();
  });

  it('reopens at the updated position after a second open', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(html`<${Host} />`);
    const state = getApi().state;

    state.x = 1;
    state.y = 2;
    state.show = true;
    await flush();
    expect((contentOf(mounted) as HTMLElement).style.left).toBe('1px');

    state.show = false;
    await flush();

    state.x = 300;
    state.y = 400;
    state.show = true;
    await flush();

    const content = contentOf(mounted) as HTMLElement;
    expect(content.style.left).toBe('300px');
    expect(content.style.top).toBe('400px');
  });
});
