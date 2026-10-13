import { css } from '@dineug/r-html';

export const root = css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  outline: none;
  background-color: var(--tree-background);
  color: var(--foreground);
  font-size: 13px;
  user-select: none;
`;

export const space = css`
  position: relative;
  width: 100%;
`;

export const row = css`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  .tree:focus &.active:not(.current) {
    background-color: var(--tree-row-hover);
    color: var(--active);
  }

  &.current {
    background-color: var(--tree-row-current);
  }

  @media (forced-colors: active) {
    .tree:focus &.active {
      outline: 1px solid Highlight;
      outline-offset: -1px;
    }
  }
`;

export const twisty = css`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--tree-muted);

  .tree[dir='rtl'] &.collapsed {
    transform: scaleX(-1);
  }
`;
