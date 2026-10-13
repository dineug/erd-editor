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

  &:hover {
    background-color: var(--tree-row-hover);
  }

  &.current {
    background-color: var(--tree-row-current);
  }

  .tree:focus &.active {
    box-shadow: inset 0 0 0 1px var(--tree-row-active);
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
