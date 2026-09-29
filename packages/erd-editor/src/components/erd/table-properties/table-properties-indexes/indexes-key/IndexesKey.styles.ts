import { css } from '@dineug/r-html';

import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/** An index row's box, its text muted: the columns declare this key, and only they edit it. */
export const row = css`
  display: flex;
  width: 100%;
  height: ${COLUMN_HEIGHT}px;
  align-items: center;
  color: var(--placeholder);
  padding: 0 ${TABLE_PADDING}px;
  cursor: default;

  &:hover {
    background-color: var(--column-hover);
  }

  &.selected {
    background-color: var(--column-select);
  }

  & > .column-col {
    padding: ${COLUMN_PADDING}px ${INPUT_MARGIN_RIGHT}px ${COLUMN_PADDING}px 0;
  }
`;

export const name = css`
  ${typography.paragraph};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
