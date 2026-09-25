import { css } from '@emotion/react';

// Where the local app's import notice sits: centred below the editor's top
// bar, over the banners, sized to its line.
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
