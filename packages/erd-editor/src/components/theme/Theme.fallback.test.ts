import { addCSSHost, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import Theme from '@/components/theme/Theme';

// A browser that adopts no constructed sheet, which the module asks once per call.
vi.mock('@dineug/r-html', async importOriginal => ({
  ...(await importOriginal<typeof import('@dineug/r-html')>()),
  canAdoptStyleSheets: () => false,
}));

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('Theme where no constructed sheet is adopted', () => {
  it('falls back to a style element in the shadow root and adopts no sheet of its own', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const shadow = element.attachShadow({ mode: 'open' });
    addCSSHost(shadow);
    const shared = [...shadow.adoptedStyleSheets];

    mounted = mount(
      html`<${Theme} theme=${{ foreground: '#111111' } as any} />`,
      createTestAppContext(),
      shadow
    );
    await flush();

    expect(shadow.querySelector('style')?.textContent).toContain(
      '--foreground: var(--erd-editor-foreground, #111111);'
    );
    expect(shadow.adoptedStyleSheets).toEqual(shared);
  });
});
