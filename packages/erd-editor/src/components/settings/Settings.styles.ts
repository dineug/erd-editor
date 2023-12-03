import { css } from '@dineug/r-html';

import { fontSize6 } from '@/styles/typography.styles';

export const root = css`
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 32px;
`;

export const title = css`
  ${fontSize6};
`;

export const content = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: auto;
  flex-flow: wrap;
`;

export const section = css`
  max-width: 560px;
  margin-right: 32px;
`;

export const row = css`
  display: flex;
  white-space: nowrap;
  height: 24px;
  align-items: center;
  margin-bottom: 16px;
`;

export const vertical = (size: number) => css`
  width: ${size}px;
  height: 100%;
`;
