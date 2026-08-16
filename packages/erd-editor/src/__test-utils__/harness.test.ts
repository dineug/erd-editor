import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Table from '@/components/erd/minimap/table/Table';
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
    const table = {
      id: 't1',
      name: 'users',
      comment: '',
      columnIds: [],
      seqColumnIds: [],
      ui: {
        x: 10,
        y: 20,
        zIndex: 3,
        widthName: 60,
        widthComment: 60,
        color: '',
      },
      meta: { updateAt: 0, createAt: 0 },
    };

    mounted = await mountAndFlush(html`<${Table} table=${table} />`);

    const el = mounted.container.querySelector('.table') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.top).toBe('20px');
    expect(el.style.left).toBe('10px');
  });
});
