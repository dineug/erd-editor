import { css } from '@emotion/react';

export const root = css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: var(--gray-3);
`;

export const scope = css`
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

export const overlay = css`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--gray-3);
`;
