import { css } from '@dineug/r-html';

export const minimap = css`
  position: absolute;
  overflow: hidden;
  background-color: var(--canvas-boundary-background);
`;

export const border = css`
  position: absolute;
  box-sizing: content-box;
  pointer-events: none;
  border: 1px solid var(--minimap-border);
  box-shadow: 0 1px 6px var(--minimap-shadow);
  background-color: transparent;
`;

export const canvasSvg = css`
  pointer-events: none;
`;
