import { css } from '@dineug/r-html';

import { edgeShade } from '@/components/erd/table-properties/TableProperties.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_UNIQUE_WIDTH,
  INDEX_ORDER_MAX_ROWS,
  TABLE_PADDING,
  TABLE_PROPERTIES_BODY_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/** What a column row keeps above and below its 14px checkbox. */
const CHECKBOX_ROW_SLACK = (COLUMN_HEIGHT - 14) / 2;

/** The stuck Columns heading, the body padding it reaches over included. */
const COLUMNS_HEAD_HEIGHT = TABLE_PROPERTIES_BODY_PADDING + COLUMN_HEIGHT;

/** The tallest stuck order: its rule, its label, its rows and the padding it reaches over. */
const ORDER_MAX_HEIGHT =
  1 +
  COLUMN_HEIGHT * (1 + INDEX_ORDER_MAX_ROWS) +
  TABLE_PROPERTIES_BODY_PADDING;

/**
 * The room the keys and indexes stick in, which keeps their width. Side by
 * side it stretches as tall as the columns, so they stay in sight while a
 * long list scrolls; stacked above the columns it is only as tall as its rows.
 */
export const leftTrack = css`
  flex: 0 1 260px;
  min-width: 220px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
`;

/* The keys and indexes, stuck to the top of the body for as long as their track lets them. */
export const leftArea = css`
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};
`;

/**
 * The columns, which take what the keys leave and scroll sideways past that.
 * A box the keyboard reaches scrolls clear of the stuck heading and order,
 * which the browser would otherwise count as showing it.
 */
export const rightArea = css`
  flex: 1 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};

  & input[type='checkbox'] {
    scroll-margin: ${COLUMNS_HEAD_HEIGHT + CHECKBOX_ROW_SLACK}px 0
      ${ORDER_MAX_HEIGHT + CHECKBOX_ROW_SLACK}px;
  }
`;

/**
 * The Columns heading, stuck to the top of the body while the rows scroll
 * under it. It reaches back over the body padding, as the order does at the
 * bottom, so no row shows above it.
 */
export const columnsHead = css`
  position: sticky;
  top: -${TABLE_PROPERTIES_BODY_PADDING}px;
  z-index: 1;
  flex-shrink: 0;
  margin-top: -${TABLE_PROPERTIES_BODY_PADDING}px;
  padding-top: ${TABLE_PROPERTIES_BODY_PADDING}px;
  background-color: var(--context-menu-background);
`;

/* A group's name over its rows, a row tall, and what the group shows at its right end. */
export const sectionLabel = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
`;

/* Read, not hinted at: the placeholder colour is too faint for a sentence. */
export const sectionStatus = css`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-regular);
  font-variant-numeric: tabular-nums;
  color: var(--foreground);

  & > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/* The column rows, which scroll sideways on a narrow dialog under the header chips' edge shade. */
export const columns = css`
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  ${edgeShade};
`;

/* Where a list has nothing to show yet, a row saying so. */
export const hint = css`
  display: flex;
  align-items: center;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
`;

export const addIndexButtonArea = css`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  padding: 0 ${TABLE_PADDING}px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
    color: var(--active);
  }
`;

/* The plus in the column of the toggles above it, so the label starts where the names do. */
export const addIcon = css`
  flex-shrink: 0;
  width: ${COLUMN_UNIQUE_WIDTH}px;
  justify-content: center;
`;

/**
 * The selected index's column order, ruled off under the columns. It sticks
 * to the bottom of the body while a long list scrolls, and sits in place
 * under a short one.
 */
export const order = css`
  margin-top: 12px;
  margin-bottom: -${TABLE_PROPERTIES_BODY_PADDING}px;
  padding-bottom: ${TABLE_PROPERTIES_BODY_PADDING}px;
  position: sticky;
  bottom: -${TABLE_PROPERTIES_BODY_PADDING}px;
  z-index: 1;
  background-color: var(--context-menu-background);
  border-top: 1px solid var(--context-menu-border);
`;
