import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/**
 * A row of the canvas table's height. Its remove button stays in sight, in
 * the lock's place on a key row, and a hovered row lines its name field.
 */
export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  color: var(--placeholder);
  padding: 0 ${TABLE_PADDING}px;
  cursor: pointer;

  &:hover {
    color: var(--foreground);
    background-color: var(--column-hover);
  }

  &:hover input:not(:focus):not([readonly]) {
    box-shadow: inset 0 -1px 0 var(--context-menu-border);
  }

  &.selected {
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

/* The name takes what the row leaves, so a long one ends in an ellipsis before the chip. */
export const nameCell = css`
  flex: 1 1 auto;
  min-width: 0;
`;

/* Underlined as the cell editor is while typing, in the colour it uses. */
export const input = css`
  width: 100%;
  height: 20px;
  padding: 0 4px;
  ${typography.paragraph};
  text-overflow: ellipsis;

  &:focus:not([readonly]) {
    box-shadow: inset 0 -1.5px 0 var(--input-active);
  }
`;

export const unique = css`
  cursor: pointer;
`;

/* A chip, so the number never reads as part of the name or as a toggle that is off. */
export const alternateKey = css`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  margin-left: 4px;
  border: 1px solid var(--accent-color-8);
  border-radius: 9999px;
  background-color: var(--accent-color-3);
  color: var(--accent-color-11);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

/* The square Find and Replace's tools take, at the end of the row. */
export const iconButton = css`
  flex-shrink: 0;
  margin-left: auto;
  width: 20px;
  height: 20px;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }
`;
