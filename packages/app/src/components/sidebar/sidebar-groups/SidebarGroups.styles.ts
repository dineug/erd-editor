import { css } from '@emotion/react';

export const contentArea = css`
  width: 260px;
  min-width: 260px;
  padding: 0 12px;
`;

export const group = css`
  & + & {
    margin-top: 16px;
  }
`;

export const groupLabel = css`
  padding: 0 var(--space-3);
  margin-bottom: 4px;
  font-weight: 500;
`;

export const noResults = css`
  padding: 0 var(--space-3);
`;
