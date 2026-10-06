import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/locale-picker/LocalePicker.styles';
import { floatingShadow } from '@/styles/elevation.styles';
import { typography } from '@/styles/typography.styles';

const sourceOf = (template: { strings: ReadonlyArray<string> }) =>
  template.strings.join('');

describe('LocalePicker.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.title),
      String(styles.list),
      String(styles.pinned),
      String(styles.option),
      String(styles.check),
      String(styles.label),
      String(styles.hint),
    ];

    for (const identifier of identifiers) {
      expect(identifier).toMatch(/\S/);
    }
    expect(new Set(identifiers).size).toBe(8);
  });

  it('hangs the panel where the theme builder hangs, on the side a line starts from', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('position: absolute');
    expect(source).toContain('top: 46px');
    expect(source).toContain('inset-inline-start: 16px');
    expect(source).not.toMatch(/\b(left|right):/);
    expect(source).toContain('z-index: 1');
    expect(source).toContain('width: 260px');
    expect(source).toContain('border-radius: 6px');
    expect(source).toContain(
      'background-color: var(--context-menu-background)'
    );
    expect(source).toContain('border: 1px solid var(--context-menu-border)');
    expect(styles.root.values).toEqual([floatingShadow]);
  });

  it('keeps the panel inside a short editor, the list scrolling in its place', () => {
    const root = sourceOf(styles.root);
    const list = sourceOf(styles.list);

    expect(root).toContain('max-height: calc(100% - 62px)');
    expect(root).toContain('display: flex');
    expect(root).toContain('flex-direction: column');
    expect(sourceOf(styles.title)).toContain('flex-shrink: 0');
    expect(list).toContain('overflow-y: auto');
    expect(list).toContain('overscroll-behavior: contain');
    expect(list).toContain('min-height: 0');
  });

  it('pins System and its rule atop the list, which scrolls a row clear of them', () => {
    const pinned = sourceOf(styles.pinned);

    expect(pinned).toContain('display: flow-root');
    expect(pinned).toContain('position: sticky');
    expect(pinned).toContain('top: 0');
    expect(pinned).toContain(
      'background-color: var(--context-menu-background)'
    );
    expect(sourceOf(styles.list)).toContain('scroll-padding-block-start: 41px');
  });

  it('draws a row 32px high, its text from the start, lit on hover and ringed on a keyboard focus', () => {
    const source = sourceOf(styles.option);

    expect(source).toContain('height: 32px');
    expect(source).toContain('width: 100%');
    expect(source).toContain('text-align: start');
    expect(source).toContain('cursor: pointer');
    expect(source).toContain('&:hover');
    expect(source).toContain('background-color: var(--context-menu-hover)');
    expect(source).toContain('&:focus-visible');
    expect(source).toContain('box-shadow: inset 0 0 0 1px var(--input-active)');
    expect(source).toContain(`&[aria-selected='true']`);
    expect(styles.option.values).toEqual([typography.paragraph]);
    expect(styles.title.values).toEqual([typography.normal]);
  });

  it('keeps room for the check on every row and pushes the System hint to the far end', () => {
    expect(sourceOf(styles.check)).toContain('width: 14px');
    expect(sourceOf(styles.check)).toContain('flex-shrink: 0');
    expect(sourceOf(styles.label)).toContain('text-overflow: ellipsis');
    expect(sourceOf(styles.hint)).toContain('margin-inline-start: auto');
    expect(sourceOf(styles.hint)).toContain('color: var(--placeholder)');
  });

  it('paints nothing with fill, which an icon takes from its color', () => {
    for (const template of Object.values(styles)) {
      expect(sourceOf(template)).not.toMatch(/(^|[^-])fill\s*:/m);
    }
  });
});
