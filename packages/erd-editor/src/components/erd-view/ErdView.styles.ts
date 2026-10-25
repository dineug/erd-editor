import { css } from '@dineug/r-html';

/*
 * The box the read-only view fills, which the canvas, its scrollbars and its
 * controls stand in. It takes the touch gestures off the browser only while it
 * holds the focus, so before that a finger over bare canvas scrolls the page.
 */
export const root = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;

  &:focus-within {
    touch-action: none;
  }
`;
