import { css } from '@dineug/r-html';

import { INPUT_HEIGHT } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

export const root = css`
  position: relative;
  outline: none;
`;

export const hint = css`
  position: absolute;
  z-index: 1;
  top: ${INPUT_HEIGHT}px;
  left: 0;
  color: var(--foreground);
  background-color: var(--table-background);
  border: 1px solid var(--table-border);
  white-space: nowrap;
  ${typography.paragraph};
`;

export const hintItem = css`
  display: flex;
  align-items: center;
  padding: 0 4px;
  height: 20px;
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
