import { css } from '@dineug/r-html';

export const wrap = css`
  display: inline-flex;
  height: 100%;
  align-items: center;
`;

/* Not stroke: it is always currentColor, so only color ever changes. */
export const icon = css`
  transition: color 0.15s;
`;
