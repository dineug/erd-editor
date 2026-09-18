import { css } from '@dineug/r-html';

/*
 * A row keeps its height in a menu cut to the window, which scrolls instead.
 */
export const item = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  flex-shrink: 0;
  cursor: default;
  border-radius: 4px;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }

  &.selected {
    background-color: var(--context-menu-select);
  }
`;
