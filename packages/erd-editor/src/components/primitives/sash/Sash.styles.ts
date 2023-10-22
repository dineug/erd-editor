import { css } from '@dineug/r-html';

export const SASH_SIZE = 5;

export const sash = css`
  position: absolute;

  &.vertical {
    width: ${SASH_SIZE}px;
    height: 100%;
    cursor: ew-resize;
  }

  &.horizontal {
    width: 100%;
    height: ${SASH_SIZE}px;
    cursor: ns-resize;
  }

  &.edge {
    width: ${SASH_SIZE}px;
    height: ${SASH_SIZE}px;
  }
`;
