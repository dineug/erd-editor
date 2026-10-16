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

    div[data-focus-border-bottom] {
      border-bottom-color: var(--placeholder) !important;
    }

    input[data-focus-border-bottom] {
      border-bottom-color: var(--placeholder) !important;
    }
  }
`;

export const scope = css`
  ${container};
`;

/** The ERD tab's row: the Explorer, when shown, and the canvas beside it. */
export const erdRow = css`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

/** The canvas's share of the row, all of it the Explorer leaves. */
export const erdScope = css`
  ${container};
  flex: 1 1 0;
  min-width: 0;
`;
