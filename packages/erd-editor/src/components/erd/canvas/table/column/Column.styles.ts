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
  padding: 0 ${TABLE_PADDING}px;

  &:hover {
    fill: var(--foreground);
    color: var(--foreground);
    background-color: var(--column-hover);
  }

  &[data-hover] {
    background-color: var(--column-hover);
  }

  &[data-selected] {
    background-color: var(--column-select);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }

  &.none-hover {
    background-color: transparent;
  }

  &[data-dragging] {
    opacity: 0.5;
  }

  &[data-ghost] {
    visibility: hidden;
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
