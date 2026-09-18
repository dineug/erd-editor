import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/table-view/Table.styles';
import {
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_ICON_GAP,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_HEADER_PADDING,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const sourceOf = (style: { strings: TemplateStringsArray }) =>
  style.strings.join('');

const blockOf = (source: string, selector: string) => {
  const start = source.indexOf(`${selector} {`);

  return source.slice(start, source.indexOf('}', start));
};

describe('Table.styles', () => {
  it('exports every class the Table template composes', () => {
    expect(Object.keys(styles).sort()).toEqual([
      'header',
      'headerColor',
      'headerInputWrap',
      'root',
    ]);

    for (const style of Object.values(styles)) {
      expect(String(style)).toMatch(/\S/);
    }
  });

  it('absolutely positions the table shell with themed background and border', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('position: absolute');
    expect(source).toContain('background-color: var(--table-background)');
    expect(source).toContain('border: 1px solid var(--table-border)');
    expect(source).toContain('border-radius: 6px');
    expect(source).toContain('color: transparent');
  });

  it('reveals the foreground on hover and switches the border when selected', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('&:hover');
    expect(source).toContain('color: var(--foreground)');
    expect(source).toContain('&[data-selected]');
    expect(source).toContain('border: 1px solid var(--table-select)');
  });

  it('marks a remote peer focus with an outline and underlines the focused header input', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('&[data-shared-focus]');
    expect(source).toContain('outline: 1px solid var(--shared-focus)');
    expect(source).toContain('outline-offset: 0');
    expect(source).toContain('& .input-padding[data-shared-focus]');
    expect(source).toContain(
      'box-shadow: inset 0 -1.5px 0 var(--shared-focus)'
    );
  });

  it('leaves the two border writes to the base and selected rules', () => {
    const source = sourceOf(styles.root);

    expect(source.match(/border:/g)).toHaveLength(2);
    expect(blockOf(source, '&[data-shared-focus]')).not.toContain('border');
    expect(
      blockOf(source, '& .input-padding[data-shared-focus]')
    ).not.toContain('border');
  });

  it('declares the column-row-move transition the flip animation toggles', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('.column-row-move');
    expect(source).toContain('transition: transform 0.3s');
  });

  it('pads nothing around the card, which ends at its last row, and inherits the paragraph typography', () => {
    const source = sourceOf(styles.root);

    expect(source).not.toMatch(/^\s*padding:/m);
    expect(styles.root.values).toEqual([typography.paragraph]);
  });

  it('rules a line under every row but the last, without growing the row', () => {
    const source = sourceOf(styles.root);

    expect(source).toContain('.column-row:not(:last-child)');
    expect(source).toContain('box-shadow: inset 0 -1px 0 var(--table-border)');
  });

  it('bands the header in its own token and sets the icon beside the name', () => {
    const source = sourceOf(styles.header);

    expect(source).toContain('display: flex');
    expect(source).toContain('align-items: center');
    expect(source).toContain(
      'background-color: var(--table-header-background)'
    );
    expect(source).toContain('border-radius: 5px 5px 0 0');
    expect(source).toContain('&:last-child');
    expect(source).toContain('& > .icon');
    expect(styles.header.values).toEqual([
      TABLE_HEADER_ICON_GAP,
      TABLE_HEADER_BAND_PADDING,
      TABLE_PADDING,
    ]);
  });

  it('runs the colour edge down the left border, cut from a box wide enough to round its corners', () => {
    const source = sourceOf(styles.headerColor);

    expect(source).toContain('position: absolute');
    expect(source).toContain('top: -1px');
    expect(source).toContain('bottom: -1px');
    expect(source).toContain('left: -1px');
    expect(source).toContain('border-radius: 6px 0 0 6px');
    expect(source).toContain('clip-path: inset(0');
    // A 12 unit box cut back by 8 leaves the 4 unit strip the scene draws.
    expect(styles.headerColor.values).toEqual([12, 8]);
  });

  it('centers the header inputs and pads each input-padding wrapper', () => {
    const source = sourceOf(styles.headerInputWrap);

    expect(source).toContain('align-items: center');
    expect(source).toContain('& > .input-padding');
    expect(styles.headerInputWrap.values).toEqual([
      TABLE_HEADER_INPUT_HEIGHT,
      TABLE_HEADER_PADDING,
      INPUT_MARGIN_RIGHT,
      TABLE_HEADER_PADDING,
    ]);
  });
});
