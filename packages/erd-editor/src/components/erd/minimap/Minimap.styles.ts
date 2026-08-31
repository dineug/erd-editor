import { css } from '@dineug/r-html';

export const minimap = css`
  position: absolute;
  overflow: hidden;
  background-color: var(--canvas-boundary-background);
  /*
   * The minimap redraws its own copy of the document on every table move, and
   * it sits over the canvas that is redrawing at the same time. Promoting the
   * minimap keeps the two out of one invalidated region: measured 50ms to
   * 16.7ms per frame over a 56-table document, with main-thread blocking down
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
