import { css } from '@emotion/react';

// Centred just below the editor's top bar, clear of its minimap in the top
// right corner and of the update prompt in the bottom right one. Sized to its
// line, since left: 50% alone would wrap it at half the viewport.
export const root = css`
  position: fixed;
  top: 44px;
  left: 50%;
  z-index: 10;
  width: max-content;
  max-width: calc(100vw - 32px);
  transform: translateX(-50%);
  align-items: center;
  box-shadow: var(--shadow-4);
`;
