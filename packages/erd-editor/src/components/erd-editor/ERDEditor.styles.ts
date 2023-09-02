import { css } from '@dineug/r-html';

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
  font-family: var(--text-font-family);
  color: var(--foreground);

  .ghost-text {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: 13px;
    font-family: var(--text-font-family);
    white-space: nowrap;
  }
`;

export const main = css`
  ${container};
`;
