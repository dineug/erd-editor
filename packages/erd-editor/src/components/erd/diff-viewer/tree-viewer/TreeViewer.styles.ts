import { css } from '@dineug/r-html';

import { DIFF_TREE_WIDTH } from '@/constants/layout';

export const root = css`
  display: flex;
  flex-direction: column;
  width: ${DIFF_TREE_WIDTH}px;
  min-width: ${DIFF_TREE_WIDTH}px;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: var(--context-menu-background);
  padding: 14px 0;
`;

const item = css`
  display: flex;
  align-items: center;
  cursor: pointer;

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
    fill: var(--active);
  }
`;

export const icon = css`
  display: flex;
  align-items: center;
  min-width: 14px;
  margin-right: 8px;

  &.diff-insert {
    fill: var(--diff-insert-foreground);
  }

  &.diff-delete {
    fill: var(--diff-delete-foreground);
  }

  &.diff-cross {
    fill: var(--diff-cross-foreground);
  }
`;

export const table = css`
  ${item};
  height: 36px;
  min-height: 36px;
  padding: 0 12px;
`;

export const column = css`
  ${item};
  height: 24px;
  min-height: 24px;
  padding: 0 12px 0 24px;
`;

export const ellipsis = css`
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
