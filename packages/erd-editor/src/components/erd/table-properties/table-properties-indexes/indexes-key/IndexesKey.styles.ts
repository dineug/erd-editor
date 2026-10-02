import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/**
 * An index row's box, picked as an index is: a bar along its left edge
 * carries the selection where the light theme's tint is too faint alone.
 */
export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  color: var(--foreground);
  padding: 0 ${TABLE_PADDING}px;
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
  }

  &.selected {
    color: var(--active);
    background-color: var(--column-select);
    box-shadow: inset 3px 0 0 var(--accent-color-10);
  }

  &.selected:hover {
    background-color: var(--column-select-hover);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }
`;

/**
 * A filled tag, where an index row has its UQ toggle and as wide, so the
 * names start in one line; filled, it reads as a label and never as a toggle.
 */
export const tag = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${COLUMN_UNIQUE_WIDTH}px;
  height: 16px;
  border-radius: 3px;
  background-color: var(--gray-color-5);
  color: var(--active);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  line-height: 1;
  user-select: none;
`;

/* Its text starts where an index name's does, past the input's own padding. */
export const name = css`
  ${typography.paragraph};
  min-width: 0;
  padding-left: 4px;
  padding-right: ${INPUT_MARGIN_RIGHT}px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* The box an index row's remove button takes, at the end of the row. */
export const lock = css`
  flex-shrink: 0;
  margin-left: auto;
  width: 20px;
  justify-content: center;
  color: var(--placeholder);
`;
