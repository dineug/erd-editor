import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const notNull = css`
  display: inline-flex;
  height: 20px;
  box-sizing: border-box;
  align-items: center;
  color: var(--active);
  background-color: transparent;
  border-bottom: solid transparent 1.5px;
  ${typography.paragraph};
  line-height: normal;
  cursor: default;
  user-select: none;

  &.focus {
    border-bottom: solid var(--focus) 1.5px;
  }
`;
