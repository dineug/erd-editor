import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import * as styles from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const contentOf = (m: Mounted) =>
  m.container.querySelector('.context-menu-content') as HTMLElement;

describe('ContextMenuContent', () => {
  it('renders a container carrying both the hook class and the styled class', async () => {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${0} y=${0} />`
    );

    const el = contentOf(mounted);
    expect(el).toBeTruthy();
    expect(el.classList.contains('context-menu-content')).toBe(true);
    expect(el.classList.contains(String(styles.content))).toBe(true);
  });

  it('projects the id prop onto data-id so children can find their parent', async () => {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'menu-1'} x=${0} y=${0} />`
    );

    expect(contentOf(mounted).dataset.id).toBe('menu-1');
  });

  it('places the popup using the x and y props as fixed offsets', async () => {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${120} y=${34} />`
    );

    const el = contentOf(mounted);
    expect(el.style.left).toBe('120px');
    expect(el.style.top).toBe('34px');
  });

  it('renders children inside the container', async () => {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent}
        id=${'root'}
        x=${0}
        y=${0}
        children=${html`<span class="child">Item</span>`}
      />`
    );

    const child = contentOf(mounted).querySelector('.child') as HTMLElement;
    expect(child).toBeTruthy();
    expect(child.textContent).toBe('Item');
  });

  it('renders no children when the children prop is omitted', async () => {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${0} y=${0} />`
    );

    expect(contentOf(mounted).textContent).toBe('');
  });

  it('repositions reactively when x and y change', async () => {
    const state = { x: 1, y: 2 };
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${state.x} y=${state.y} />`
    );
    expect(contentOf(mounted).style.left).toBe('1px');

    mounted.unmount();
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${50} y=${60} />`
    );
    await flush();

    expect(contentOf(mounted).style.left).toBe('50px');
    expect(contentOf(mounted).style.top).toBe('60px');
  });
});
