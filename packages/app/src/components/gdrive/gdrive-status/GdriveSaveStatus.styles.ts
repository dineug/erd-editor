import { css, keyframes } from '@emotion/react';

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

const turn = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// A spinner glyph standing still looks frozen, and it is the one sign that work
// goes on, so reduced motion slows the turn instead of stopping it, as Radix's
// own Spinner never stops. Every LoaderCircle in /gdrive takes this.
export const spinning = css`
  transform-origin: center;
  animation: ${turn} 1s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 3s;
  }
`;

// Green step 11 reads 4.7:1 on the light panel and 9.4:1 on the dark one, well
// above the 3:1 a 14px icon needs, where step 9 makes 3.2:1 in light.
export const saved = css`
  color: var(--green-11);
`;
