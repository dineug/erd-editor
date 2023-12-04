import { css } from '@dineug/r-html';

export const tabs = css`
  display: flex;
  padding: 12px;
  min-height: 56px;
`;

export const tab = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  border-radius: 4px;
  cursor: default;
  white-space: nowrap;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
    fill: var(--active);
  }

  &.selected {
    background-color: var(--context-menu-select);
    color: var(--active);
    fill: var(--active);
  }
`;
