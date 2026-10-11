import { css } from '@emotion/react';

export const trigger = css`
  flex: none;
  margin: 0;
`;

// Faded rather than grayed, so it stays legible on a highlighted row.
export const hint = css`
  margin-inline-start: var(--space-2);
  opacity: 0.7;
`;
