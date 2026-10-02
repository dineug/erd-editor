import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes.styles';
import * as frameStyles from '@/components/erd/table-properties/TableProperties.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_UNIQUE_WIDTH,
  INDEX_ORDER_MAX_ROWS,
  TABLE_PADDING,
  TABLE_PROPERTIES_BODY_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('TablePropertiesIndexes.styles', () => {
  it('exports the two panes, their labels and hints, the add row and the order', () => {
    expect(Object.keys(styles)).toEqual([
      'leftTrack',
      'leftArea',
      'rightArea',
      'columnsHead',
      'sectionLabel',
      'sectionStatus',
      'columns',
      'hint',
      'addIndexButtonArea',
      'addIcon',
      'order',
    ]);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('keeps the keys at 260px and gives the columns the rest', () => {
    const left = staticText(styles.leftTrack);
    const right = staticText(styles.rightArea);

    expect(left).toContain('flex: 0 1 260px');
    expect(left).toContain('min-width: 220px');
    expect(right).toContain('flex: 1 1 520px');
    expect(right).toContain('min-width: 0');

    for (const text of [left, staticText(styles.leftArea), right]) {
      expect(text).toContain('display: flex');
      expect(text).toContain('flex-direction: column');
      expect(text).not.toMatch(/width: \d+%/);
      expect(text).not.toContain('height: 100%');
      expect(text).not.toContain('padding-right');
    }
  });

  it('stretches the keys track as tall as its flex line, for the keys to stick in', () => {
    const track = staticText(styles.leftTrack);

    expect(track).toContain('align-self: stretch');
    expect(track).not.toContain('position: sticky');
    expect(styles.leftTrack.values).toEqual([]);
  });

  it('sticks the keys and indexes to the top of the body', () => {
    const text = staticText(styles.leftArea);

    expect(text).toContain('position: sticky');
    expect(text).toMatch(/top: 0;/);
  });

  it('sets both panes in the row size of the canvas table', () => {
    expect(styles.leftArea.values).toEqual([typography.paragraph]);
    expect(styles.rightArea.values[0]).toBe(typography.paragraph);
  });

  it('sticks the Columns heading over the body padding, as the order sticks at the bottom', () => {
    const text = staticText(styles.columnsHead);

    expect(text).toContain('position: sticky');
    expect(text).toMatch(/top: -\s+px;/);
    expect(text).toContain('z-index: 1');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toMatch(/margin-top: -\s+px;\s+padding-top:\s+px;/);
    expect(text).toContain('background-color: var(--context-menu-background)');
    expect(styles.columnsHead.values).toEqual([
      TABLE_PROPERTIES_BODY_PADDING,
      TABLE_PROPERTIES_BODY_PADDING,
      TABLE_PROPERTIES_BODY_PADDING,
    ]);
  });

  it('scrolls a box the keyboard reaches clear of the stuck heading and the tallest order', () => {
    const text = staticText(styles.rightArea);
    const slack = (COLUMN_HEIGHT - 14) / 2;

    expect(text).toMatch(
      /& input\[type='checkbox'\] \{\s+scroll-margin:\s+px 0\s+px;\s+\}/
    );
    expect(styles.rightArea.values.slice(1)).toEqual([
      TABLE_PROPERTIES_BODY_PADDING + COLUMN_HEIGHT + slack,
      1 +
        COLUMN_HEIGHT +
        COLUMN_HEIGHT * INDEX_ORDER_MAX_ROWS +
        TABLE_PROPERTIES_BODY_PADDING +
        slack,
    ]);
  });

  it('heads a group with a row tall label, its status at the right end', () => {
    const text = staticText(styles.sectionLabel);

    expect(text).toContain('display: flex');
    expect(text).toContain('align-items: center');
    expect(text).toContain('justify-content: space-between');
    expect(text).toContain('gap: 8px');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('font-weight: var(--font-weight-medium)');
    expect(text).toContain('flex-shrink: 0');
    expect(styles.sectionLabel.values).toEqual([COLUMN_HEIGHT, TABLE_PADDING]);
  });

  it('sets the status as text to read, cut short on one line', () => {
    const text = staticText(styles.sectionStatus);

    expect(text).toContain('min-width: 0');
    expect(text).toContain('gap: 4px');
    expect(text).toContain('overflow: hidden');
    expect(text).toContain('white-space: nowrap');
    // A flex container is no block container, so only the span can draw it.
    expect(text.slice(0, text.indexOf('& > span'))).not.toContain(
      'text-overflow'
    );
    expect(text.slice(text.indexOf('& > span'))).toMatch(
      /& > span \{\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*\}/
    );
    expect(text).toContain('font-weight: var(--font-weight-regular)');
    expect(text).toContain('font-variant-numeric: tabular-nums');
    expect(text).toContain('color: var(--foreground)');
    expect(text).not.toContain('var(--placeholder)');
  });

  it('scrolls the column rows sideways under the edge shade the header chips wear', () => {
    const text = staticText(styles.columns);

    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('overflow-x: auto');
    expect(text).toContain('overflow-y: hidden');
    expect(text).not.toContain('background-image');
    expect(styles.columns.values).toEqual([frameStyles.edgeShade]);
  });

  it('says what an empty list is missing on a row of its own', () => {
    const text = staticText(styles.hint);

    expect(text).toContain('display: flex');
    expect(text).toContain('align-items: center');
    expect(text).toContain('color: var(--foreground)');
    expect(styles.hint.values).toEqual([COLUMN_HEIGHT, TABLE_PADDING]);
  });

  it('makes the add index row a clickable full width line', () => {
    const text = staticText(styles.addIndexButtonArea);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('gap: 12px');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('cursor: pointer');
    expect(text).toMatch(
      /&:hover \{\s*background-color: var\(--column-hover\);\s*color: var\(--active\);\s*\}/
    );
  });

  it('interpolates the shared layout constants into the add button row', () => {
    expect(styles.addIndexButtonArea.values).toContain(COLUMN_HEIGHT);
    expect(styles.addIndexButtonArea.values).toContain(TABLE_PADDING);
  });

  it('stands the plus in the toggle column, so the label starts where the names do', () => {
    const text = staticText(styles.addIcon);

    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('justify-content: center');
    expect(styles.addIcon.values).toEqual([COLUMN_UNIQUE_WIDTH]);
  });

  it('rules the order off and sticks it to the bottom of the body', () => {
    const text = staticText(styles.order);

    expect(text).toContain('margin-top: 12px');
    expect(text).toContain('position: sticky');
    expect(text).toContain('z-index: 1');
    expect(text).toContain('background-color: var(--context-menu-background)');
    expect(text).toContain('border-top: 1px solid var(--context-menu-border)');
  });

  it('covers the body padding under a stuck order and adds no room under one in place', () => {
    const text = staticText(styles.order);

    // The order sticks past the body's padding edge onto its scrollport edge
    // and pads its rows clear of it, and a negative margin takes that padding
    // back out of the flow, so an order in place leaves the scroll height be.
    expect(text).toMatch(/margin-bottom: -\s+px;\s+padding-bottom:\s+px;/);
    expect(text).toMatch(/bottom: -\s+px;/);
    expect(styles.order.values).toEqual([
      TABLE_PROPERTIES_BODY_PADDING,
      TABLE_PROPERTIES_BODY_PADDING,
      TABLE_PROPERTIES_BODY_PADDING,
    ]);
  });
});
