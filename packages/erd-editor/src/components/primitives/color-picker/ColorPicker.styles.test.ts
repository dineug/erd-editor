import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/color-picker/ColorPicker.styles';

const sourceOf = (template: { strings: { raw: ReadonlyArray<string> } }) =>
  template.strings.raw.join('');

const RING =
  /&:focus-visible\s*\{\s*outline: 2px solid var\(--input-active\);\s*outline-offset: -?\d+px;\s*\}/;

describe('ColorPicker.styles', () => {
  it('absolutely positions the container so top/left inline styles apply', () => {
    expect(styles.container.values).toEqual([]);
    expect(sourceOf(styles.container)).toContain('position: absolute');
  });

  it('stacks one panel of the menu surface over the floating toolbar', () => {
    const panel = sourceOf(styles.panel);

    expect(panel).toContain('z-index: 2');
    expect(panel).toContain('width: 220px');
    expect(panel).toContain('user-select: none');
    expect(panel).toContain('border: 1px solid var(--context-menu-border)');
    expect(panel).toContain('background-color: var(--context-menu-background)');
  });

  it.each(['area', 'hue', 'iconButton', 'clear', 'swatch'] as const)(
    'rings %s while it holds the keyboard, as the reset takes every outline',
    name => {
      expect(sourceOf(styles[name])).toMatch(RING);
    }
  );

  it('borders each field, the border taking the accent while it is focused', () => {
    const input = sourceOf(styles.input);

    expect(input).toContain('border: 1px solid var(--context-menu-border)');
    expect(input).toMatch(
      /&:focus\s*\{\s*border-color: var\(--input-active\);\s*\}/
    );
  });

  it('draws the checked swatch with a box-shadow ring, leaving the outline to the focus', () => {
    const swatch = sourceOf(styles.swatch);
    const checked = swatch.slice(
      swatch.indexOf("&[aria-checked='true']"),
      swatch.indexOf('&:focus-visible')
    );

    expect(checked).toContain('box-shadow:');
    expect(checked).toContain('0 0 0 3px var(--gray-color-12)');
    expect(checked).not.toContain('outline');
  });

  it('edges the swatches and the preview with the theme border', () => {
    for (const template of [styles.swatch, styles.preview]) {
      expect(sourceOf(template)).toContain(
        'box-shadow: inset 0 0 0 1px var(--context-menu-border)'
      );
    }
  });

  it('keeps a touch drag on the area and the hue from scrolling or zooming the page', () => {
    expect(sourceOf(styles.area)).toContain('touch-action: none');
    expect(sourceOf(styles.hue)).toContain('touch-action: none');
  });

  it('paints no fill in any template, as icons take their color alone', () => {
    for (const template of Object.values(styles)) {
      expect(sourceOf(template)).not.toContain('fill:');
    }
  });

  it('gives every export its own sheet, so no two share a class', () => {
    expect(new Set(Object.values(styles).map(String)).size).toBe(
      Object.keys(styles).length
    );
  });
});
