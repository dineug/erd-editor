import { css } from '@dineug/r-html';

/**
 * Overflow is hidden rather than scrolled: the graph pans and zooms on its own
 * Stage, so nothing here is ever larger than the box it sits in.
 */
export const root = css`
  position: relative;
  height: 100%;
  overflow: hidden;
  background-color: var(--canvas-background);
`;

/** The Stage container, viewport sized, which konva fills with its own canvas. */
export const stage = css`
  position: relative;
  top: 0;
  left: 0;
`;
