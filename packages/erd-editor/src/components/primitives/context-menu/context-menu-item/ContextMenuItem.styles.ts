import { css } from '@dineug/r-html';

export const item = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  cursor: default;
  border-radius: 4px;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }

  &[data-show='true'] {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }
`;
