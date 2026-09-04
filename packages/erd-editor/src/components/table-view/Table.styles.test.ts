import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/table-view/Table.styles';
import {
  HEADER_ICON_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_ICON_MARGIN_BOTTOM,
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
      'headerButtonWrap',
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

  it('drives the root padding from TABLE_PADDING and inherits the paragraph typography', () => {
    expect(styles.root.values).toEqual([TABLE_PADDING, typography.paragraph]);
  });

  it('stacks the header contents and pads them by TABLE_PADDING', () => {
    const source = sourceOf(styles.header);

    expect(source).toContain('display: flex');
    expect(source).toContain('flex-direction: column');
    expect(source).toContain('position: relative');
    expect(styles.header.values).toEqual([TABLE_PADDING]);
  });

  it('pins the color bar above the header and marks it clickable', () => {
    const source = sourceOf(styles.headerColor);

    expect(source).toContain('position: absolute');
    expect(source).toContain('left: 0');
    expect(source).toContain('width: 100%');
    expect(source).toContain('min-height: 4px');
    expect(source).toContain('border-radius: 6px 6px 0 0');
    expect(source).toContain('cursor: pointer');
    expect(styles.headerColor.values).toEqual([TABLE_PADDING + 1]);
  });

  it('right aligns the header buttons and highlights icons on hover', () => {
    const source = sourceOf(styles.headerButtonWrap);

    expect(source).toContain('justify-content: flex-end');
    expect(source).toContain('cursor: move');
    expect(source).toContain('& > .icon');
    expect(source).toContain('& > .icon:last-child');
    expect(source).toContain('& > .icon:hover');
    expect(source).toContain('color: var(--active)');
    expect(styles.headerButtonWrap.values).toEqual([
      HEADER_ICON_HEIGHT,
      TABLE_HEADER_ICON_MARGIN_BOTTOM,
      TABLE_HEADER_BUTTON_MARGIN_LEFT,
    ]);
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
