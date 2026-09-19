import { css } from '@emotion/react';

export const sash = (open: boolean) => css`
  all: unset;
  box-sizing: border-box;
  position: absolute;
  top: 0;
  ${
    open
      ? css`
          left: calc(260px - 5px / 2);
        `
      : css`
          left: 0;
        `
  }
  width: 5px;
  height: 100%;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;

  &:hover,
  &:focus-visible {
    background-color: var(--gray-a7);
  }

  &:focus-visible > span {
    outline: 2px solid var(--focus-8);
    outline-offset: 1px;
  }
`;

// Hangs off the strip's right edge, drawn like a ghost icon button.
export const icon = css`
  position: absolute;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-5);
  height: var(--space-5);
  border-radius: var(--radius-2);
  color: var(--gray-a11);

  button:hover > & {
    color: var(--gray-12);
    background-color: var(--gray-a3);
  }
`;
