import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

export const root = css`
  padding-top: 12px;
`;

export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  color: var(--active);
  fill: var(--active);
  padding: 0 ${TABLE_PADDING}px;
  cursor: move;

  &:hover {
    background-color: var(--column-hover);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }
`;

export const orderType = css`
  cursor: pointer;
`;
