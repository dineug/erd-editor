import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

export const root = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  fill: transparent;
  color: transparent;
  padding: ${COLUMN_PADDING}px ${TABLE_PADDING}px;
  transition: background-color 0.15s;

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
    background-color: var(--column-hover);
  }

  &.selected {
    background-color: var(--column-select);
  }

  & > .column-col {
    margin-right: ${INPUT_MARGIN_RIGHT}px;
  }
`;

export const iconButton = css`
  cursor: pointer;
  margin-left: auto;

  &:hover {
    fill: var(--active);
    color: var(--active);
  }
`;
