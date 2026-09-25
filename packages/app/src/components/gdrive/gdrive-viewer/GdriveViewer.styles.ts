import { css } from '@emotion/react';

export const root = css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: var(--gray-3);
`;

// Centred just below the editor's top bar, like the import notice, which
// sits over them when both show.
export const banners = css`
  position: absolute;
  top: 44px;
  left: 50%;
  z-index: 9;
  width: max-content;
  max-width: calc(100% - 32px);
  transform: translateX(-50%);
`;

export const busy = css`
  position: absolute;
  bottom: 24px;
  right: 16px;
  z-index: 5;
  padding: 4px 10px;
  border-radius: var(--radius-3);
  background-color: var(--color-panel-solid);
  box-shadow: var(--shadow-2);
`;
