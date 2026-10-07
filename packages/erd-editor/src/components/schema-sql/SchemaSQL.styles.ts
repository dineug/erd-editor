import { css } from '@dineug/r-html';

/** The code and, beside it, the options panel. */
export const root = css`
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--canvas-background);
`;

/** The code takes what the panel leaves, and no more. */
export const code = css`
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

/** Show options, over the code's own colour so it reads above the text. */
export const show = css`
  background-color: var(--code-block-background);
`;
