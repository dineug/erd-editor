import { html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Theme from '@/components/theme/Theme';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';
import { ThemeTokens } from '@/themes/tokens';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const styleText = (container: HTMLElement) =>
  container.querySelector('style')?.textContent ?? '';

describe('Theme', () => {
  it('renders a host style block from the given theme', async () => {
    const theme = { foreground: '#111111', active: '#222222' } as any;
    mounted = await mountAndFlush(html`<${Theme} theme=${theme} />`);
    const text = styleText(mounted.container);

    expect(text).toContain(':host');
    expect(text).toContain(
      '--foreground: var(--erd-editor-foreground, #111111);'
    );
    expect(text).toContain('--active: var(--erd-editor-active, #222222);');
  });

  it('kebab-cases camelCase token names', async () => {
    const theme = { grayColor1: '#eeeeee', canvasBackground: '#dddddd' } as any;
    mounted = await mountAndFlush(html`<${Theme} theme=${theme} />`);
    const text = styleText(mounted.container);

    expect(text).toContain(
      '--gray-color-1: var(--erd-editor-gray-color-1, #eeeeee);'
    );
    expect(text).toContain(
      '--canvas-background: var(--erd-editor-canvas-background, #dddddd);'
    );
  });

  it('emits a declaration for every theme token of a real theme', async () => {
    const theme = createTheme({
      appearance: Appearance.dark,
      grayColor: GrayColor.slate,
      accentColor: AccentColor.indigo,
    });
    mounted = await mountAndFlush(html`<${Theme} theme=${theme} />`);
    const text = styleText(mounted.container);

    expect(text.split('\n').filter(line => line.trim()).length).toBeGreaterThan(
      ThemeTokens.length
    );
    ThemeTokens.forEach(token => {
      expect(text).toContain(`var(--erd-editor-`);
      expect(theme[token]).toBeTruthy();
    });
  });

  it('re-renders when the observable theme changes', async () => {
    const theme = observable({ foreground: '#000000' }) as any;
    mounted = await mountAndFlush(html`<${Theme} theme=${theme} />`);

    expect(styleText(mounted.container)).toContain(
      '--foreground: var(--erd-editor-foreground, #000000);'
    );

    theme.foreground = '#ffffff';
    await flush();

    expect(styleText(mounted.container)).toContain(
      '--foreground: var(--erd-editor-foreground, #ffffff);'
    );
  });

  it('renders an empty declaration list for an empty theme', async () => {
    mounted = await mountAndFlush(html`<${Theme} theme=${{} as any} />`);
    const text = styleText(mounted.container);

    expect(text).toContain(':host');
    expect(text).not.toContain('--erd-editor-');
  });
});
