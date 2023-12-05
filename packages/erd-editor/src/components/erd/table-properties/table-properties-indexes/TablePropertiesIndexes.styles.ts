import { css } from '@dineug/r-html';

import { COLUMN_HEIGHT, TABLE_PADDING } from '@/constants/layout';

export const leftArea = css`
  width: 30%;
  min-width: 240px;
  height: 100%;
  padding-right: 12px;
`;

export const rightArea = css`
  width: 70%;
  min-width: 560px;
  height: 100%;
`;

export const addIndexButtonArea = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  padding: 0 ${TABLE_PADDING}px;
  cursor: pointer;

  &:hover {
    background-color: var(--column-hover);
    fill: var(--active);
    color: var(--active);
  }
`;
