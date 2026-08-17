import { css } from '@dineug/r-html';

export const minimap = css`
  position: absolute;
  overflow: hidden;
  background-color: var(--canvas-boundary-background);
  /*
   * The minimap holds a full-size copy of the canvas scaled down to a
   * thumbnail. Sharing a compositing layer with the canvas means every table
   * move invalidates both, and the combined region is large enough that a drag
   * over a 56-table document paints at 20fps. Promoting the minimap isolates
   * the two: measured 50ms to 16.7ms per frame, with main-thread blocking down
   * by more than a third. See e2e/bench/attribution.bench.ts.
   */
  will-change: transform;
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
