import { css } from '@dineug/r-html';

/**
 * The stage container, which is viewport sized and is the canvas. The document
 * has no edge to draw any more, so the colour the scene used to paint on a
 * document sized rect is painted here instead and reaches every corner.
 */
export const stage = css`
  position: relative;
  background-color: var(--canvas-background);
  top: 0;
  left: 0;
  will-change: transform;
`;

/**
 * The minimap's thumbnail, which is a picture of that same canvas and so is
 * painted by the very same rules. It keeps a name of its own because the
 * minimap asks for it by one.
 */
export const root = stage;

export const controller = css`
  will-change: transform;
`;
