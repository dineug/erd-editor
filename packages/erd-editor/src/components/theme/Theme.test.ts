import { addCSSHost, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
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

describe('Theme outside a shadow root', () => {
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

/** The theme mounted in a closed shadow root that joined the shared sheets, as both elements mount it. */
async function mountInShadow(theme: any) {
  const element = document.createElement('div');
  document.body.append(element);
  const shadow = element.attachShadow({ mode: 'closed' });
  addCSSHost(shadow);
  mounted = mount(
    html`<${Theme} theme=${theme} />`,
    createTestAppContext(),
    shadow
  );
  await flush();
  return shadow;
}

const sheetText = (sheet: CSSStyleSheet | undefined) =>
  Array.from(sheet?.cssRules ?? [])
    .map(rule => rule.cssText)
    .join('');

describe('Theme in a shadow root', () => {
  it('puts the tokens in a sheet of the shadow root, ahead of the shared sheets, and renders no style element', async () => {
    const shadow = await mountInShadow({
      foreground: '#111111',
      active: '#222222',
    });
    const [own] = shadow.adoptedStyleSheets;

    expect(sheetText(own)).toContain(':host');
    expect(sheetText(own)).toContain(
      '--foreground: var(--erd-editor-foreground, #111111)'
    );
    expect(sheetText(own)).toContain(
      '--active: var(--erd-editor-active, #222222)'
    );
    expect(shadow.querySelector('style')).toBeNull();
  });

  it('writes the sheet again when the observable theme changes', async () => {
    const theme = observable({ foreground: '#000000' }) as any;
    const shadow = await mountInShadow(theme);
    const [own] = shadow.adoptedStyleSheets;

    theme.foreground = '#ffffff';
    await flush();

    expect(shadow.adoptedStyleSheets[0]).toBe(own);
    expect(sheetText(own)).toContain(
      '--foreground: var(--erd-editor-foreground, #ffffff)'
    );
  });

  it('drops its sheet from the shadow root as it unmounts', async () => {
    const shadow = await mountInShadow({ foreground: '#111111' });
    const [own] = shadow.adoptedStyleSheets;

    mounted?.unmount();
    mounted = null;

    expect(shadow.adoptedStyleSheets).not.toContain(own);
  });
});
