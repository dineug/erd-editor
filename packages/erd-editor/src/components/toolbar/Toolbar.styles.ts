import { css } from '@dineug/r-html';

export const root = css`
  display: flex;
  width: 100%;
  height: 30px;
  min-height: 30px;
  padding: 0 15px;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  background-color: var(--toolbar-background);

  & > input {
    margin-right: 15px;
  }
`;

export const vertical = css`
  width: 10px;
  height: 100%;
`;

export const menu = css`
  cursor: pointer;
  padding: 0 5px;
  display: flex;
  align-items: center;
  height: 100%;

  &.active {
    fill: var(--active);
  }
  &:hover {
    fill: var(--active);
  }

  &.undo-redo {
    cursor: not-allowed;
    fill: var(--foreground);
  }

  &.undo-redo.active {
    cursor: pointer;
    fill: var(--active);
  }
`;
