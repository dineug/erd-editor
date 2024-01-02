import { css } from '@emotion/react';

export const collaborative = css`
  color: var(--gray-a10);
  display: flex;
  cursor: pointer;
  margin-left: auto;

  &[data-active='true'] {
    color: var(--gray-12);
    visibility: visible;
  }
`;

export const link = css`
  cursor: pointer;

  & > * {
    pointer-events: none;
  }
`;
