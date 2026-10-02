import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INDEX_ORDER_MAX_ROWS,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/* Three rows, then the rest scrolls, so a stuck order leaves a low body most of its columns. */
export const root = css`
  max-height: ${COLUMN_HEIGHT * INDEX_ORDER_MAX_ROWS}px;
  overflow-y: auto;

  .index-column-order-move {
    transition: transform 0.3s;
  }
`;

export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  color: var(--active);
  padding: 0 ${TABLE_PADDING}px;
  cursor: move;
  ${typography.paragraph};

  &:hover {
    background-color: var(--column-hover);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }

  &.none-hover {
    background-color: transparent;
  }

  &.dragging {
    opacity: 0.5;
  }

  &[data-readonly] {
    cursor: default;
  }
`;

/* The handle, as wide as a checkbox cell above it and quieter than the names. */
export const grip = css`
  color: var(--placeholder);
`;

export const orderType = css`
  cursor: pointer;
`;

/* The mark the canvas draws on this column, AK1.2 for the second of AK1, at the end of the row. */
export const mark = css`
  margin-left: auto;
  color: var(--accent-color-11);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;
