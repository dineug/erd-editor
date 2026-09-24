import { css } from '@emotion/react';

// Bottom left of the canvas, clear of the editor's floating toolbar in the
// middle and of the update prompt on the right.
export const root = css`
  position: absolute;
  left: 16px;
  bottom: 24px;
  z-index: 5;
  padding: 4px 10px;
  border: 1px solid var(--gray-6);
  border-radius: var(--radius-3);
  background-color: var(--color-panel-solid);
  color: var(--gray-11);
  box-shadow: var(--shadow-2);
  pointer-events: auto;
`;
