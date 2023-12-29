import { css } from '@dineug/r-html';

export const cursor = css`
  position: absolute;
  max-width: 100px;
  overflow: hidden;
  display: flex;
  pointer-events: none;
  z-index: 2147483647;

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
