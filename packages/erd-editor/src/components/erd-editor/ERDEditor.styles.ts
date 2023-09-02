import { css } from '@dineug/r-html';

import { typography } from '@/styles/typography.styles';

const container = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
`;

export const root = css`
  ${container};
  background-color: var(--canvas-boundary-background);

  .ghost-text {
    visibility: hidden;
    position: fixed;
    top: -100px;
    white-space: nowrap;
    font-family: var(--text-font-family);
    ${typography.paragraph};
  }
`;

export const main = css`
  ${container};
`;
