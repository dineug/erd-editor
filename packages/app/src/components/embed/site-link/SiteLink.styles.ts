import { css } from '@emotion/react';

/*
 * A physical corner, since the canvas never mirrors, clear of the scrollbar
 * track, the minimap and, only in a frame wide enough for both, the controls.
 * The colors are Radix's scale on the link's own light or dark class.
 */
export const link = css`
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 1;
  padding: 2px 8px;
  border: 1px solid var(--gray-a5);
  border-radius: 6px;
  background-color: var(--gray-2);
  color: var(--gray-11);
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;

  &:hover {
    color: var(--gray-12);
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--gray-11);
    outline-offset: 2px;
  }
`;
