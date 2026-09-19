import { css } from '@emotion/react';

export const collaborative = css`
  flex: none;
  margin: 0;
  color: var(--gray-a10);

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
