import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesIndex.styles', () => {
  it('exports the row, name cell, input, unique, alternateKey and iconButton tokens', () => {
    expect(Object.keys(styles)).toEqual([
      'row',
      'nameCell',
      'input',
      'unique',
      'alternateKey',
      'iconButton',
    ]);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(6);
  });

  it('draws the alternate key number as an accent chip on one line', () => {
    const text = staticText(styles.alternateKey);

    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('display: inline-flex');
    expect(text).toContain('height: 16px');
    expect(text).toContain('padding: 0 6px');
    expect(text).toContain('margin-left: 4px');
    expect(text).toContain('border: 1px solid var(--accent-color-8)');
    expect(text).toContain('border-radius: 9999px');
    expect(text).toContain('background-color: var(--accent-color-3)');
    expect(text).toContain('color: var(--accent-color-11)');
    expect(text).toContain('font-size: 10px');
    expect(text).toContain('white-space: nowrap');
    expect(text).toContain('font-variant-numeric: tabular-nums');
    expect(text).not.toContain('var(--placeholder)');
  });

  it('keeps the remove icon in sight, dimmed until the row is hovered', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('color: var(--placeholder)');
    expect(text).not.toContain('color: transparent');
    expect(text).toContain('cursor: pointer');
    expect(text).toMatch(
      /&:hover \{\s*color: var\(--foreground\);\s*background-color: var\(--column-hover\);\s*\}/
    );
  });

  it('lines the name field of a hovered row while it has no caret', () => {
    expect(staticText(styles.row)).toMatch(
      /&:hover input:not\(:focus\) \{\s*box-shadow: inset 0 -1px 0 var\(--context-menu-border\);\s*\}/
    );
  });

  it('marks the picked row with the tint and a bar along its left edge', () => {
    const text = staticText(styles.row);

    expect(text).toMatch(
      /&\.selected \{\s*background-color: var\(--column-select\);\s*box-shadow: inset 3px 0 0 var\(--accent-color-10\);\s*\}/
    );
    expect(text).toMatch(
      /&\.selected:hover \{\s*background-color: var\(--column-select-hover\);\s*\}/
    );
    expect(text).toContain('& > .column-col');
  });

  it('interpolates the shared layout constants into the row', () => {
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('lets the name cell take what the row leaves', () => {
    const text = staticText(styles.nameCell);

    expect(text).toContain('flex: 1 1 auto');
    expect(text).toContain('min-width: 0');
  });

  it('sets the name in the row size and underlines it in the input colour while typing', () => {
    const text = staticText(styles.input);

    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 20px');
    expect(text).toContain('padding: 0 4px');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toMatch(
      /&:focus \{\s*box-shadow: inset 0 -1\.5px 0 var\(--input-active\);\s*\}/
    );
    expect(text).not.toContain('var(--focus)');
    expect(styles.input.values).toEqual([typography.paragraph]);
  });

  it('makes the unique cell and the remove icon clickable', () => {
    expect(staticText(styles.unique)).toContain('cursor: pointer');

    const iconButton = staticText(styles.iconButton);
    expect(iconButton).toContain('cursor: pointer');
    expect(iconButton).toContain('margin-left: auto');
    expect(iconButton).toContain('flex-shrink: 0');
    expect(iconButton).toContain('width: 20px');
    expect(iconButton).toContain('height: 20px');
    expect(iconButton).toContain('justify-content: center');
    expect(iconButton).toContain('border-radius: 4px');
    expect(iconButton).toMatch(
      /&:hover \{\s*color: var\(--active\);\s*background-color: var\(--context-menu-hover\);\s*\}/
    );
  });
});
