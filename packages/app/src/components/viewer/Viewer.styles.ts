import { css } from '@emotion/react';

export const root = css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: var(--gray-3);
`;

export const empty = css`
  max-width: 100%;
  padding: 0 16px;
  text-align: center;
`;

export const actions = css`
  max-width: 100%;
`;

export const separator = css`
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  color: var(--gray-9);
`;
