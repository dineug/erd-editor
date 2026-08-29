import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/memo/Memo.styles';
import {
  HEADER_ICON_HEIGHT,
  HEADER_ICON_MARGIN_BOTTOM,
  MEMO_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

describe('Memo.styles', () => {
  it('compiles every export to a non empty class identifier', () => {
    const exported = [
      styles.root,
      styles.container,
      styles.header,
      styles.headerColor,
      styles.headerButtonWrap,
      styles.textarea,
    ];

    for (const style of exported) {
      expect(style).toBeTruthy();
      expect(String(style)).toMatch(/\S/);
    }

    const classNames = exported.map(String);
    expect(new Set(classNames).size).toBe(classNames.length);
  });

  it('absolutely positions the root and themes it through memo custom properties', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('background-color: var(--memo-background)');
    expect(source).toContain('border: 1px solid var(--memo-border)');
    expect(source).toContain('color: transparent');
  });

  it('reveals the foreground on hover and swaps the border when selected', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('&:hover');
    expect(source).toContain('color: var(--foreground)');
    expect(source).toContain('&[data-selected]');
    expect(source).toContain('border: 1px solid var(--memo-select)');
  });

  it('lays the container out as a padded full size column', () => {
    const source = styles.container.strings.join('');

    expect(source).toContain('position: relative');
    expect(source).toContain('flex-direction: column');
    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(styles.container.values).toEqual([MEMO_PADDING]);
  });

  it('stacks the header as a relatively positioned column', () => {
    const source = styles.header.strings.join('');

    expect(source).toContain('display: flex');
    expect(source).toContain('flex-direction: column');
    expect(source).toContain('position: relative');
    expect(styles.header.values).toEqual([]);
  });

  it('bleeds the color bar over the memo padding and rounds its top corners', () => {
    const source = styles.headerColor.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('min-height: 4px');
    expect(source).toContain('border-radius: 6px 6px 0 0');
    expect(source).toContain('cursor: pointer');
    expect(styles.headerColor.values).toEqual([
      MEMO_PADDING + 1,
      MEMO_PADDING,
      MEMO_PADDING * 2,
    ]);
  });

  it('sizes the header button row from the icon layout constants', () => {
    const source = styles.headerButtonWrap.strings.join('');

    expect(source).toContain('justify-content: flex-end');
    expect(source).toContain('cursor: move');
    expect(source).toContain('& > .icon');
    expect(source).toContain('& > .icon:hover');
    expect(source).toContain('color: var(--active)');
    expect(styles.headerButtonWrap.values).toEqual([
      HEADER_ICON_HEIGHT,
      HEADER_ICON_MARGIN_BOTTOM,
    ]);
  });

  it('keeps the textarea transparent, unresizable and on the paragraph scale', () => {
    const source = styles.textarea.strings.join('');

    expect(source).toContain('resize: none');
    expect(source).toContain('background-color: transparent');
    expect(source).toContain('line-height: normal');
    expect(styles.textarea.values).toEqual([typography.paragraph]);
  });
});
