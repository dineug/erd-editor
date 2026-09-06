import { css } from '@dineug/r-html';

export const minimap = css`
  position: absolute;
  overflow: hidden;
  /*
   * The minimap redraws its own copy of the document on every table move, and
   * it sits over the canvas that is redrawing at the same time. Promoting the
   * minimap keeps the two out of one invalidated region: measured 50ms to
   * 16.7ms per frame over a 56-table document, with main-thread blocking down
   * by more than a third. See e2e/bench/attribution.bench.ts.
   */
  will-change: transform;
`;

/*
 * The square the thumbnail is centred in. The map keeps the content's own
 * shape, so the thumbnail rarely fills the square, and the frame paints the
 * boundary colour behind it or the scene would show through the letterbox.
 */
export const border = css`
  position: absolute;
  box-sizing: content-box;
  pointer-events: none;
  border: 1px solid var(--minimap-border);
  /*
   * Drawn back from the edge by the negative spread, so what lands is the soft
   * end of the blur rather than the ink beside it: the shadow colour is an
   * opaque black, and the dom minimap only ever showed it through a css scale.
   */
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  background-color: var(--canvas-boundary-background);
`;
