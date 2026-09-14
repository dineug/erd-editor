import { css } from '@dineug/r-html';

import {
  DATA_TYPE_HINT_MAX_ROWS,
  DATA_TYPE_HINT_ROW_HEIGHT,
  INPUT_HEIGHT,
  TABLE_BORDER,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/** The rows the list shows at most, and its border above and below them. */
const HINT_MAX_HEIGHT =
  DATA_TYPE_HINT_ROW_HEIGHT * DATA_TYPE_HINT_MAX_ROWS + TABLE_BORDER * 2;

export const root = css`
  position: relative;
  outline: none;
`;

export const hint = css`
  position: absolute;
  z-index: 1;
  top: ${INPUT_HEIGHT}px;
  left: 0;
  max-height: ${HINT_MAX_HEIGHT}px;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--foreground);
  background-color: var(--table-background);
  border: ${TABLE_BORDER}px solid var(--table-border);
  white-space: nowrap;
  ${typography.paragraph};
`;

export const hintItem = css`
  display: flex;
  align-items: center;
  padding: 0 4px;
  height: ${DATA_TYPE_HINT_ROW_HEIGHT}px;
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
  }

  &.selected {
    background-color: var(--column-select);

    .kbd {
      visibility: visible;
    }
  }

  & > .kbd {
    margin-left: auto;
    padding-left: 6px;
    visibility: hidden;
  }
`;
