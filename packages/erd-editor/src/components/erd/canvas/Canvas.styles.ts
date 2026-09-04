import { css } from '@dineug/r-html';

/**
 * A document box, painted with the canvas background. The minimap's thumbnail
 * is one of these; the editor's own document box is a konva rect on the scene's
 * bottom layer, because the stage container below is the screen, not the box.
 */
export const root = css`
  position: relative;
  background-color: var(--canvas-background);
  top: 0;
  left: 0;
  will-change: transform;
`;

/**
 * The stage container, which is viewport sized. It paints nothing of its own so
 * that the boundary background of whatever holds the editor shows through
 * wherever the scene has drawn no document.
 */
export const stage = css`
  position: relative;
  top: 0;
  left: 0;
  will-change: transform;
`;

export const controller = css`
  will-change: transform;
`;
