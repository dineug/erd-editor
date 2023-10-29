import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

export const root = css`
  display: inline-flex;
  height: 20px;
  box-sizing: border-box;
  align-items: center;
  vertical-align: middle;
  color: var(--active);
  background-color: transparent;
  border-bottom: solid transparent 1.5px;
  ${typography.paragraph};
  line-height: normal;

  &.placeholder {
    color: var(--placeholder);
  }

  &.focus {
    border-bottom: solid var(--focus) 1.5px;
  }

  &.edit {
    border-bottom: solid var(--input-active) 1.5px;
  }
`;

export const cursor = css`
  cursor: default;
`;

export const userSelect = css`
  user-select: none;
`;
