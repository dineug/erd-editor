import { css } from '@dineug/r-html';

import { DIFF_TREE_WIDTH } from '@/constants/layout';

export const root = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--canvas-boundary-background);
`;

export const container = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
`;

export const tree = css`
  display: flex;
  flex-direction: column;
  width: ${DIFF_TREE_WIDTH}px;
  min-width: ${DIFF_TREE_WIDTH}px;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: var(--context-menu-background);
`;

export const viewport = css`
  display: flex;
  width: 50%;
  height: 100%;
  overflow: hidden;
  border-left: 1px solid var(--context-menu-border);
`;
