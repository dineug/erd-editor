import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesColumn.styles', () => {
  it('exports the root, row and orderType tokens', () => {
    expect(Object.keys(styles)).toEqual(['root', 'row', 'orderType']);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(3);
  });

  it('declares the flip animation class the component adds while moving', () => {
    const text = staticText(styles.root);

    expect(text).toContain('padding-top: 12px');
    expect(text).toContain('.index-column-order-move');
    expect(text).toContain('transition: transform 0.3s');
  });

  it('renders each index column as a draggable full width line', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('cursor: move');
    expect(text).toContain('color: var(--active)');
    expect(text).toContain('fill: var(--active)');
  });

  it('carries the drag states the dragstart handler toggles', () => {
    const text = staticText(styles.row);

    expect(text).toContain('&:hover');
    expect(text).toContain('var(--column-hover)');
    expect(text).toContain('&.none-hover');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('&.dragging');
    expect(text).toContain('opacity: 0.5');
    expect(text).toContain('& > .column-col');
  });

  it('interpolates the shared layout constants into the row', () => {
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('makes the order type cell clickable', () => {
    expect(staticText(styles.orderType)).toContain('cursor: pointer');
  });
});
