import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/virtual-scroll/VirtualScroll.styles';

const sourceOf = (value: { strings: TemplateStringsArray | string[] }) =>
  Array.from(value.strings).join('');

describe('VirtualScroll.styles', () => {
  it('exports every class the component renders', () => {
    const exported = [
      styles.vertical,
      styles.horizontal,
      styles.ghostThumb,
      styles.verticalThumb,
      styles.horizontalThumb,
    ];

    for (const style of exported) {
      expect(style).toBeTruthy();
      expect(String(style)).toMatch(/\S/);
    }
  });

  it('pins the vertical track to the right edge with an 8px gutter', () => {
    const source = sourceOf(styles.vertical);

    expect(source).toContain('position: absolute');
    expect(source).toContain('right: 0');
    expect(source).toContain('width: 8px');
    expect(source).toContain('height: calc(100% - 8px)');
    expect(source).toContain('padding-top: 4px');
  });

  it('pins the horizontal track to the bottom edge with an 8px gutter', () => {
    const source = sourceOf(styles.horizontal);

    expect(source).toContain('position: absolute');
    expect(source).toContain('bottom: 0');
    expect(source).toContain('height: 8px');
    expect(source).toContain('width: calc(100% - 8px)');
    expect(source).toContain('padding-left: 4px');
  });

  it('highlights the ghost thumb on hover and while it is selected', () => {
    const source = sourceOf(styles.ghostThumb);

    expect(source).toContain('will-change: transform');
    expect(source).toContain('cursor: pointer');
    expect(source).toContain('&:hover > div');
    expect(source).toContain('&[data-selected] > div');
    expect(source.match(/var\(--scrollbar-thumb-hover\)/g)).toHaveLength(2);
  });

  it('composes both thumbs from the shared thumb template', () => {
    expect(styles.verticalThumb.values).toHaveLength(1);
    expect(styles.horizontalThumb.values).toHaveLength(1);

    const sharedFromVertical = styles.verticalThumb.values[0] as {
      strings: string[];
    };
    const sharedFromHorizontal = styles.horizontalThumb.values[0] as {
      strings: string[];
    };
    const shared = sourceOf(sharedFromVertical);

    expect(sourceOf(sharedFromHorizontal)).toBe(shared);
    expect(shared).toContain('background-color: var(--scrollbar-thumb)');
    expect(shared).toContain('border-radius: 4px');
  });

  it('gives each thumb a 4px thickness on its own axis', () => {
    expect(sourceOf(styles.verticalThumb)).toContain('width: 4px');
    expect(sourceOf(styles.verticalThumb)).toContain('height: 100%');
    expect(sourceOf(styles.horizontalThumb)).toContain('width: 100%');
    expect(sourceOf(styles.horizontalThumb)).toContain('height: 4px');
  });
});
