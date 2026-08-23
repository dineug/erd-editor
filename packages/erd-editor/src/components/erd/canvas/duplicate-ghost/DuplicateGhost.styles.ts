import { css } from '@dineug/r-html';

export const ghostLayer = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
  opacity: 0.6;
`;

// `display: contents` generates no box, so the entity inside keeps resolving its
// absolute position against the canvas root.
export const ghostItem = css`
  display: contents;
`;
