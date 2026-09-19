import { css } from '@emotion/react';

/*
 * Clear of the editor's minimap in the top corner and its toolbar along the
 * middle of the bottom edge. The z-index clears the editor's own layers, 2 at
 * most outside its menus and toasts.
 */
export const root = css`
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10;
  max-width: calc(100vw - 48px);
`;
