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
  outline: none;

  &.none-focus {
    div[data-focus-border] {
      border-color: var(--placeholder) !important;
    }
    div[data-focus-border-bottom],
    input[data-focus-border-bottom] {
      border-bottom-color: var(--placeholder) !important;
    }
  }
`;

export const main = css`
  ${container};
`;
