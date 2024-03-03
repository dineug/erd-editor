import { css } from '@emotion/react';

export const sash = (open: boolean) => css`
  position: absolute;
  top: 0;
  ${open
    ? css`
        left: calc(260px - 5px / 2);
      `
    : css`
        left: 0;
      `}
  width: 5px;
  height: 100%;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;

  &:hover {
    background-color: var(--accent-9);
  }
`;

export const icon = (open: boolean) => css`
  left: 4px;
  position: absolute;
`;
