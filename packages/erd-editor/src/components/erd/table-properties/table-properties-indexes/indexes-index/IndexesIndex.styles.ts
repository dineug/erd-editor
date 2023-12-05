import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  fill: transparent;
  color: transparent;
  padding: 0 ${TABLE_PADDING}px;

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
    background-color: var(--column-hover);
  }

  &.selected {
    background-color: var(--column-select);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }
`;

export const input = css`
  width: 100%;
`;

export const unique = css`
  cursor: pointer;
`;

export const iconButton = css`
  cursor: pointer;
  margin-left: auto;

  &:hover {
    fill: var(--active);
    color: var(--active);
  }
`;
