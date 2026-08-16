import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuItem from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem';
import * as itemStyles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import ContextMenuRoot from '@/components/primitives/context-menu/context-menu-root/ContextMenuRoot';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Menu from '@/components/primitives/context-menu/menu/Menu';

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
      <div
        class="surface"
        @contextmenu=${(api as Api).onContextmenu}
        @mousedown=${(api as Api).onMousedown}
      >
        <${ContextMenu.Root} children=${props.children} />
      </div>
    `;
  };

  return { Host, getApi: () => api as Api };
}

describe('ContextMenu', () => {
  it('exposes Root, Item and Menu as the composed surface', () => {
    expect(ContextMenu.Root).toBe(ContextMenuRoot);
    expect(ContextMenu.Item).toBe(ContextMenuItem);
    expect(ContextMenu.Menu).toBe(Menu);
    expect(Object.keys(ContextMenu).sort()).toEqual(['Item', 'Menu', 'Root']);
  });

  it('opens the composed menu on right click and renders its rows', async () => {
    const { Host } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`
          <${ContextMenu.Item}
            children=${html`<${ContextMenu.Menu}
              icon=${'C'}
              name=${'Copy'}
              right=${'Ctrl+C'}
            />`}
          />
        `}
      />`
    );

    expect(mounted.container.querySelector('.context-menu-content')).toBeNull();

    const surface = mounted.container.querySelector('.surface') as HTMLElement;
    surface.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 30,
        clientY: 40,
      })
    );
    await flush();

    const content = mounted.container.querySelector(
      '.context-menu-content'
    ) as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.style.left).toBe('30px');
    expect(content.style.top).toBe('40px');
    expect(content.textContent).toContain('Copy');
    expect(content.textContent).toContain('Ctrl+C');
  });

  it('runs the row handler and closes when a composed item is clicked', async () => {
    const { Host, getApi } = createHost();
    const onClick = vi.fn(() => {
      getApi().state.show = false;
    });

    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenu.Item}
          children=${'Delete'}
          .onClick=${onClick}
        />`}
      />`
    );

    getApi().state.show = true;
    await flush();

    const item = mounted.container.querySelector(
      `.${String(itemStyles.item)}`
    ) as HTMLElement;
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(mounted.container.querySelector('.context-menu-content')).toBeNull();
  });

  it('closes the composed menu on a mousedown outside the content', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenu.Item} children=${'A'} />`}
      />`
    );

    getApi().state.show = true;
    await flush();
    expect(
      mounted.container.querySelector('.context-menu-content')
    ).toBeTruthy();

    const surface = mounted.container.querySelector('.surface') as HTMLElement;
    surface.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();

    expect(mounted.container.querySelector('.context-menu-content')).toBeNull();
  });

  it('nests a composed submenu below its parent row', async () => {
    const { Host, getApi } = createHost();
    mounted = await mountAndFlush(
      html`<${Host}
        children=${html`<${ContextMenu.Item}
          children=${'Export'}
          subChildren=${html`<${ContextMenu.Item} children=${'SQL DDL'} />`}
        />`}
      />`
    );

    getApi().state.show = true;
    await flush();

    const parentRow = mounted.container.querySelector(
      `.${String(itemStyles.item)}`
    ) as HTMLElement;
    parentRow.dispatchEvent(new MouseEvent('mouseenter'));
    await flush();

    const contents = mounted.container.querySelectorAll(
      '.context-menu-content'
    );
    expect(contents).toHaveLength(2);
    expect(contents[1].getAttribute('data-id')).toBe(parentRow.dataset.id);
    expect(contents[1].textContent).toContain('SQL DDL');
  });
});
