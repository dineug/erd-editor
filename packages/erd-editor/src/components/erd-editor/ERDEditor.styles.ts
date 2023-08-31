import { css } from '@dineug/r-html';

export const warp = css`
  display: flex;
  width: 100%;
  height: 100%;
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
