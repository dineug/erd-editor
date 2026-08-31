import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Viewport from '@/components/erd/minimap/viewport/Viewport';
import Toast from '@/components/primitives/toast/Toast';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('harness', () => {
  it('renders a context-free FC', async () => {
    mounted = await mountAndFlush(
      html`<${Toast} title=${'hello'} description=${'world'} />`
    );
    expect(mounted.container.textContent).toContain('hello');
    expect(mounted.container.textContent).toContain('world');
  });

  it('renders an FC that consumes appContext', async () => {
    mounted = await mountAndFlush(html`<${Viewport} selected=${false} />`);

    const el = mounted.container.querySelector(
      '.minimap-viewport'
    ) as HTMLElement;
    expect(el).toBeTruthy();
    // the 1200 by 675 default viewport at the 150 / 2000 minimap ratio
    expect(el.style.width).toBe('90px');
    expect(el.style.height).toBe('50.625px');
  });
});
