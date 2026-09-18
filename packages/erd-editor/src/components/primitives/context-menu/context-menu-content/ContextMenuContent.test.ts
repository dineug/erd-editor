import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import * as styles from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * Lays every element out as a 200 by 300 box standing where its inline style
 * puts it, shifted by offset, which is all a fitted menu reads of the page.
 */
function layOutAt(offset = { x: 0, y: 0 }) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const left = (parseFloat(this.style.left) || 0) + offset.x;
      const top = (parseFloat(this.style.top) || 0) + offset.y;
      return DOMRect.fromRect({ x: left, y: top, width: 200, height: 300 });
    }
  );
}

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

  it('moves a fitted menu back inside the window once it has a size', async () => {
    layOutAt();
    const x = window.innerWidth - 50;
    const y = window.innerHeight - 100;
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${x} y=${y} fit=${true} />`
    );

    const el = contentOf(mounted);
    expect(el.style.left).toBe(`${window.innerWidth - 200}px`);
    expect(el.style.top).toBe(`${window.innerHeight - 300}px`);
  });

  it('leaves a menu that is not fitted where x and y put it', async () => {
    layOutAt();
    const x = window.innerWidth - 50;
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${x} y=${0} />`
    );

    expect(contentOf(mounted).style.left).toBe(`${x}px`);
  });

  it('fits by the rendered rect, so an offset containing block still ends inside', async () => {
    layOutAt({ x: 100, y: 40 });
    mounted = await mountAndFlush(
      html`<${ContextMenuContent}
        id=${'root'}
        x=${window.innerWidth - 150}
        y=${0}
        fit=${true}
      />`
    );

    const el = contentOf(mounted);
    expect(el.getBoundingClientRect().right).toBe(window.innerWidth);
    expect(el.style.top).toBe('0px');
  });

  it('fits once per position and size, so a box that ignores the move cannot loop', async () => {
    let reads = 0;
    // Left where it flows, as an unstyled box is, for the first 50 reads; a
    // measure that chased it would read that many times before settling.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        reads += 1;
        const top =
          reads < 50
            ? window.innerHeight + 500
            : parseFloat(this.style.top) || 0;
        return DOMRect.fromRect({ x: 0, y: top, width: 200, height: 300 });
      }
    );
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${0} y=${0} fit=${true} />`
    );

    expect(reads).toBeLessThan(5);
  });

  it('opens a fitted submenu the right edge cuts on the left of its row', async () => {
    layOutAt();
    mounted = await mountAndFlush(
      html`<${ContextMenuContent}
        id=${'sub'}
        x=${window.innerWidth - 20}
        y=${0}
        fit=${true}
        flipX=${window.innerWidth - 220}
      />`
    );

    expect(contentOf(mounted).style.left).toBe(`${window.innerWidth - 420}px`);
  });

  it('keeps a wheel over a menu cut to the window from the host, so it scrolls the menu', async () => {
    const onHostWheel = vi.fn();
    mounted = await mountAndFlush(
      html`<${ContextMenuContent} id=${'root'} x=${0} y=${0} fit=${true} />`
    );
    mounted.container.addEventListener('wheel', onHostWheel);
    const el = contentOf(mounted);
    const wheel = () =>
      el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
    const scrollHeight = vi.spyOn(el, 'scrollHeight', 'get');
    vi.spyOn(el, 'clientHeight', 'get').mockReturnValue(300);

    scrollHeight.mockReturnValue(300);
    wheel();
    expect(onHostWheel).toHaveBeenCalledTimes(1);

    scrollHeight.mockReturnValue(400);
    wheel();
    expect(onHostWheel).toHaveBeenCalledTimes(1);
  });

  /**
   * Mounts a fitted menu opened at x and y around one row, and hands back the
   * row's mouseenter and click listeners with a way to fire an event at a point.
   */
  async function mountRowAt(x: number, y: number) {
    mounted = await mountAndFlush(
      html`<${ContextMenuContent}
        id=${'root'}
        x=${x}
        y=${y}
        fit=${true}
        children=${html`<div class="row">Row</div>`}
      />`
    );
    const row = contentOf(mounted).querySelector('.row') as HTMLElement;
    const onEnter = vi.fn();
    const onClick = vi.fn();
    row.addEventListener('mouseenter', onEnter);
    row.addEventListener('click', onClick);
    const fire = (type: string, clientX: number, clientY: number) =>
      row.dispatchEvent(
        new MouseEvent(type, {
          bubbles: type !== 'mouseenter',
          clientX,
          clientY,
        })
      );

    return { onEnter, onClick, fire };
  }

  it('holds the row a fit pushed under the opening pointer until that pointer moves', async () => {
    layOutAt();
    const x = window.innerWidth - 50;
    const y = window.innerHeight - 100;
    const { onEnter, onClick, fire } = await mountRowAt(x, y);

    fire('mouseenter', x, y);
    fire('click', x, y);
    expect(onEnter).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();

    fire('mousemove', x - 4, y);
    fire('mouseenter', x, y);
    fire('click', x, y);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets the opening pointer through a menu the fit did not push back over it', async () => {
    layOutAt();
    const x = window.innerWidth - 50;
    const { onEnter, onClick, fire } = await mountRowAt(x, 0);

    fire('mouseenter', x, 0);
    fire('click', x, 0);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
