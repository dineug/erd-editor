import { css } from '@dineug/r-html';

export const warp = css`
  display: flex;
  width: 100%;
  height: 100%;

  .ghost-text {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: 13px;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
  }
`;
