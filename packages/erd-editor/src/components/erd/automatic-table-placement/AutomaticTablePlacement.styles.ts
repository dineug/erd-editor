import { css } from '@dineug/r-html';

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
  pointer-events: none;
`;
