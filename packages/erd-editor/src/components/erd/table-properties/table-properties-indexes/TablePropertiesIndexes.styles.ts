import { css } from '@dineug/r-html';

import { COLUMN_HEIGHT, TABLE_PADDING } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/**
 * The keys and indexes, which keep their width and stand above the columns
 * once the dialog is too narrow for the two panes side by side.
 */
export const leftArea = css`
  flex: 0 1 260px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};
`;

/* The columns, which take what the keys leave and scroll sideways past that. */
export const rightArea = css`
  flex: 1 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  ${typography.paragraph};
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
    color: var(--active);
  }
`;
