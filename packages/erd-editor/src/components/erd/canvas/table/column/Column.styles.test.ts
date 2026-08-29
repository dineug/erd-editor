import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/table/column/Column.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Column.styles', () => {
  it('exports the root and iconButton tokens as css templates', () => {
    for (const token of [styles.root, styles.iconButton]) {
      expect(token).toBeTruthy();
      expect(typeof token.toString()).toBe('string');
      expect(token.toString().length).toBeGreaterThan(0);
    }
  });

  it('generates a distinct class identifier per token', () => {
    expect(String(styles.root)).not.toBe(String(styles.iconButton));
  });

  it('lays the row out as a full width flex line', () => {
    const text = staticText(styles.root);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('fill: transparent');
    expect(text).toContain('color: transparent');
  });

  it('interpolates the shared layout constants into the row', () => {
    expect(styles.root.values).toContain(COLUMN_HEIGHT);
    expect(styles.root.values).toContain(TABLE_PADDING);
    expect(styles.root.values).toContain(COLUMN_PADDING);
    expect(styles.root.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('carries every data-state selector the Column component toggles', () => {
    const text = staticText(styles.root);

    expect(text).toContain('&:hover');
    expect(text).toContain('&[data-hover]');
    expect(text).toContain('&[data-selected]');
    expect(text).toContain('&[data-dragging]');
    expect(text).toContain('&[data-ghost]');
    expect(text).toContain('&.none-hover');
    expect(text).toContain('& > .column-col');
  });

  it('underlines the single column cell a remote peer has focused', () => {
    const text = staticText(styles.root);

    expect(text).toContain('& > .column-col[data-shared-focus]');
    expect(text).toContain('box-shadow: inset 0 -1.5px 0 var(--shared-focus)');
  });

  it('drives the row colors from the theme custom properties', () => {
    const text = staticText(styles.root);

    expect(text).toContain('var(--foreground)');
    expect(text).toContain('var(--column-hover)');
    expect(text).toContain('var(--column-select)');
    expect(text).toContain('var(--shared-focus)');
  });

  it('hides the dragging row and removes the ghost row from view', () => {
    const text = staticText(styles.root);

    expect(text).toContain('opacity: 0.5');
    expect(text).toContain('visibility: hidden');
  });

  it('makes the remove button a clickable trailing icon', () => {
    const text = staticText(styles.iconButton);

    expect(text).toContain('cursor: pointer');
    expect(text).toContain('margin-left: auto');
    expect(text).toContain('&:hover');
    expect(text).toContain('var(--active)');
  });
});
