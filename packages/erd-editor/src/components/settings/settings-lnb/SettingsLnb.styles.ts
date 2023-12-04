import { css } from '@dineug/r-html';

export const lnb = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

export const list = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
`;

export const item = css`
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  border-radius: 4px;
  cursor: default;

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
