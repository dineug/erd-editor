import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import { CodeFontFamily, TextFontFamily } from '@/styles/fonts.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const styleTexts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('style')).map(
    style => style.textContent ?? ''
  );

describe('GlobalStyles', () => {
  it('renders every global style sheet as a style element', async () => {
    mounted = await mountAndFlush(html`<${GlobalStyles} />`);

    expect(mounted.container.querySelectorAll('style')).toHaveLength(5);
  });

  it('includes the reset sheet', async () => {
    mounted = await mountAndFlush(html`<${GlobalStyles} />`);
    const texts = styleTexts(mounted.container);

    expect(texts.some(text => text.includes('box-sizing: border-box'))).toBe(
      true
    );
    expect(
      texts.some(text => text.includes('font-family: var(--text-font-family)'))
    ).toBe(true);
  });

  it('includes the font family custom properties', async () => {
    mounted = await mountAndFlush(html`<${GlobalStyles} />`);
    const texts = styleTexts(mounted.container);

    expect(
      texts.some(
        text =>
          text.includes(`--text-font-family: ${TextFontFamily}`) &&
          text.includes(`--code-font-family: ${CodeFontFamily}`)
      )
    ).toBe(true);
  });

  it('includes the typography tokens', async () => {
    mounted = await mountAndFlush(html`<${GlobalStyles} />`);
    const texts = styleTexts(mounted.container);

    expect(texts.some(text => text.includes('--font-size-1:'))).toBe(true);
    expect(texts.some(text => text.includes('--font-weight-bold: 700'))).toBe(
      true
    );
  });

  it('includes the scrollbar and color picker sheets', async () => {
    mounted = await mountAndFlush(html`<${GlobalStyles} />`);
    const texts = styleTexts(mounted.container);

    expect(texts.some(text => text.includes('::-webkit-scrollbar'))).toBe(true);
    expect(texts.some(text => text.includes('.easylogic-colorpicker'))).toBe(
      true
    );
  });

  it('creates a fresh set of style elements per instance', async () => {
    const first = await mountAndFlush(html`<${GlobalStyles} />`);
    const second = await mountAndFlush(html`<${GlobalStyles} />`);

    const firstStyles = Array.from(first.container.querySelectorAll('style'));
    const secondStyles = Array.from(second.container.querySelectorAll('style'));

    expect(firstStyles).toHaveLength(5);
    expect(secondStyles).toHaveLength(5);
    firstStyles.forEach((style, index) => {
      expect(style).not.toBe(secondStyles[index]);
      expect(style.textContent).toBe(secondStyles[index].textContent);
    });

    first.unmount();
    second.unmount();
  });
});
